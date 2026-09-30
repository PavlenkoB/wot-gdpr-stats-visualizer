---
status: complete
phase: 04-activity-time-dashboards
source: [04-VERIFICATION.md, 04-01-SUMMARY.md, 04-02-SUMMARY.md, 04-03-SUMMARY.md, 04-04-SUMMARY.md, 04-05-SUMMARY.md, 04-06-SUMMARY.md, 04-07-SUMMARY.md, 04-08-SUMMARY.md, 04-09-SUMMARY.md, 04-10-SUMMARY.md, 04-11-SUMMARY.md, 04-12-SUMMARY.md, 04-13-SUMMARY.md]
started: 2026-09-30T11:20:56.690724Z
updated: 2026-10-01T00:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Real export → populated Playtime block, split column, value list, excluded count
expected: |
  A populated Activity block: three tiles with non-zero hours/sessions/active-days, a year
  calendar, a 168-cell hour grid and 12 duration bins. A selector reading the export's true
  column name (or no selector, if no column has 2-50 distinct values), and an excluded count
  that equals the number of Sessions.csv rows the app could not use.
result: pass
note: "Real export (1234567): populated Playtime from the per-game files; game selector present. Correction: WOTB (54 rows) and WOWS (10 rows) are NOT header-only - they use bare-CR line endings (no LF), WOT uses CRLF. Earlier notes calling them header-only were wrong (wc -l counted LF only)."
why_human: |
  tests/fixtures/private/ does not exist and no real export was ever available. Every
  Sessions.csv column name and the timestamp shape in this codebase come from the synthetic
  fixture plus a schema note. The mechanical half (given a header with those names, the
  resolver finds them and never touches IP/CLIENT_BUILD) is proven by
  tests/unit/playtime.test.ts:228-371; what that does NOT prove is that a real Wargaming
  export uses those names or that shape.
source_coverage: [04-01:D7, 04-12:REAL-EXPORT-CHECK]

### 2. One real SESSION_START cell appears verbatim in the matching calendar day
expected: |
  The calendar cell for that date shows the same wall-clock time you read out of the CSV.
result: pass
note: "Verified on synthetic 60k zip: May 31, 2013 (Fri) cell exists and its tooltip matches the date; bucketing follows the CSV as written. Expected text is stale: calendar tooltip shows date/hours/sessions only (D-04), never a wall-clock time. Reword in a follow-up."
why_human: |
  TIMESTAMP_RE (src/lib/worker/playtime.ts:91) requires seconds and accepts only an optional
  literal Z - no numeric offset. 04-03 froze two behaviours by DISCOVERY rather than by plan
  text: a timestamp without seconds is rejected, and +00:00 is rejected rather than
  converted (both asserted at tests/unit/playtime.test.ts:202,207). If a real export writes
  2020-06-01 23:30 or ...+00:00, every such row lands in the excluded count and the charts
  are empty.
source_coverage: [04-03:D7, 04-12:REAL-EXPORT-CHECK]

### 3. Calendar shades: ordinary days distinguishable from each other, outlier darkest
expected: |
  The typical days are visibly different shades from each other, not all collapsed to the
  lightest shade, and the outlier day is the darkest one. Adjacent steps should be readable
  as different colours.
result: pass
note: "Synthetic 60k zip: Tue Oct 23, 2018 (39.7 h, 5 sessions) renders in the darkest shade; ordinary days show distinct shades."
why_human: |
  Criterion 2's computable half IS verified: the scale is a nearest-rank percentile scale,
  not min-max, and the ramp is asserted monotonic in lightness with >=1.25:1 contrast between
  adjacent steps. The PERCEPTUAL half - that a reader can actually tell two ordinary days
  apart, and that a 1,095-cell grid (1,748 cells for the 13-year scale fixture) is
  comprehensible - is not something a DOM node-count assertion can decide.
how: |
  Load the 60,000-session scale export (tests/fixtures/sessions-fixtures.ts SCALE_60K_SPEC)
  and LOOK at the calendar. Pick a year with a 40+ hour day next to typical 1-2 hour days
  and compare the two shades.
source_coverage: [04-08:D11, 04-11:D5]

### 4. At 375px, a calendar cell stays clear of the sticky year head and nav after PageUp/PageDown
expected: |
  The focused cell is not hidden behind the sticky year head or the nav after the correction.
result: pass
note: "User confirmed at 375px on synthetic 60k zip."
why_human: |
  The height handed to scrollClear is a real DOM measurement - headHeightFor at
  src/lib/components/CalendarHeatmap.svelte:362-367 reads head.offsetHeight from the focused
  cell's own year block, after focus settles. Correct by construction, but
  tests/unit/playtime-model.test.ts exercises focusScrollDelta with headHeight as an ARGUMENT
  and never reaches the call site, so a mutant that hardcodes the declared 32 passes every
  assertion in the suite. The wrap-at-375px case it exists for has no behavioural proof.
how: |
  At 375px width, Tab into the calendar. PageDown/PageUp until you cross a year boundary,
  then confirm the focused cell is fully visible below the sticky year head and the sticky nav.
source_coverage: [04-11:D4]

### 5. A second tab clearing the cache does not strand the block in 'Updating charts...'
expected: |
  The block either recovers to ready on its own or shows a recoverable state - NOT a
  permanent 'Updating charts...' with no way back short of a reload.
result: pass
note: "Real export: after another tab cleared the cache, selecting a game showed the amber cached-data-cleared notice; block stayed on WOT (4,960 h, 4,200 sessions, 1,190 active days); no stuck Updating state."
why_human: |
  Code-review warning WR-2 (Playtime.svelte:126-127): acceptOutcome could return null for
  an answer stamped with a different importedAt, and load() returned without reconciling
  requested, so derivePlaytimeState kept awaiting true forever. The fix at 707341d now
  reconciles the request in this case - the unit and e2e contracts assert this. But
  nothing currently exercises the SECOND-TAB-CLEARS-CACHE path in a real browser.
how: |
  With the app loaded, open a SECOND browser tab on the same origin and confirm
  'Clear my cached data'. Return to the first tab and change the split selector.
source_coverage: [04-08:D3]

## Auto-passed coverage (54 entries — see 04-VERIFICATION.md for the canonical list)

Source: structured `coverage:` blocks in each plan's `*-SUMMARY.md` were classified by
`gsd-tools query uat.classify-coverage`. Entries below are deterministically covered by
the passing tests in their `verification` refs and are NOT presented to the user.

### auto.1 — D1 (04-01-SUMMARY.md)
expected: A Sessions.csv path runs end to end: aggregated in the import worker, persisted on the meta record, and answered by playtime-query with a header-only file told apart from a missing one
result: pass
source: automated
coverage_id: D1
source_file: 04-01-SUMMARY.md
requirement: ACTIVITY-01
verification_refs:
  - unit: tests/unit/ingest-worker.test.ts#04-01 tracer: playtime-query round trip through the real worker

### auto.2 — D2 (04-01-SUMMARY.md)
expected: The All slice is exact by hand arithmetic and Date.UTC: 3 usable, 2 excluded, 10800 merged seconds, dayIndex [d, d+1], daySeconds [7200, 3600], daySessions [2, 1], and 168/168/12 entries in the three arrays 04-03 fills
result: pass
source: automated
coverage_id: D2
source_file: 04-01-SUMMARY.md
requirement: ACTIVITY-01
verification_refs:
  - unit: tests/unit/ingest-worker.test.ts#the All slice is exact: 3 usable, 2 excluded, 10800 merged seconds, two start days

### auto.3 — D3 (04-01-SUMMARY.md)
expected: The aggregate is stored on the meta record at PLAYTIME_VERSION, carries no field named for the IP column, and never rides the import result
result: pass
source: automated
coverage_id: D3
source_file: 04-01-SUMMARY.md
requirement: ACTIVITY-01
verification_refs:
  - unit: tests/unit/ingest-worker.test.ts#the meta record carries the aggregate at PLAYTIME_VERSION and never the IP (T-04-01)

### auto.4 — D4 (04-01-SUMMARY.md)
expected: A query before any import answers importedAt null and view null, so 'nothing imported' is not conflated with 'this export has no Sessions.csv'
result: pass
source: automated
coverage_id: D4
source_file: 04-01-SUMMARY.md
requirement: ACTIVITY-01
verification_refs:
  - unit: tests/unit/ingest-worker.test.ts#a playtime-query before any import answers importedAt null and no view

### auto.5 — D5 (04-01-SUMMARY.md)
expected: An export with no Sessions.csv answers no-session-file and a header-only Sessions.csv answers no-usable-sessions with excluded 0
result: pass
source: automated
coverage_id: D5
source_file: 04-01-SUMMARY.md
requirement: ACTIVITY-01
verification_refs:
  - unit: tests/unit/ingest-worker.test.ts#an export with no Sessions.csv answers no-session-file, not no-usable-sessions

### auto.6 — D6 (04-01-SUMMARY.md)
expected: PlaytimeClient resolves a query over the real worker and ignores a reply for an unknown queryId without throwing or settling the live query
result: pass
source: automated
coverage_id: D6
source_file: 04-01-SUMMARY.md
requirement: ACTIVITY-01
verification_refs:
  - unit: tests/unit/ingest-worker.test.ts#04-01 client bridge: PlaytimeClient over the real worker

### auto.7 — D1 (04-02-SUMMARY.md)
expected: The six Playtime strings equal the 04-UI-SPEC wording exactly, each test literal copied from a named copy table rather than derived from the constant
result: pass
source: automated
coverage_id: D1
source_file: 04-02-SUMMARY.md
requirement: ACTIVITY-01
verification_refs:
  - unit: tests/unit/ui-copy.test.ts#04-02 tracer: Playtime state strings pinned to the UI-SPEC copy tables

### auto.8 — D2 (04-02-SUMMARY.md)
expected: With the default built set activity-history reads ready and the other three supported sections read pending, and BUILT_DASHBOARDS holds exactly one id
result: pass
source: automated
coverage_id: D2
source_file: 04-02-SUMMARY.md
requirement: ACTIVITY-01
verification_refs:
  - unit: tests/unit/dashboard-status.test.ts#with the default built set activity-history is ready and the other three pending

### auto.9 — D3 (04-02-SUMMARY.md)
expected: A present-but-empty or absent Activity_history is still `empty` / `no-export`, so the DATA-04 ladder does not collapse the moment a dashboard lands
result: pass
source: automated
coverage_id: D3
source_file: 04-02-SUMMARY.md
requirement: ACTIVITY-01
verification_refs:
  - unit: tests/unit/dashboard-status.test.ts#an empty or absent Activity_history is still empty or no-export, never ready

### auto.10 — D4 (04-02-SUMMARY.md)
expected: In the browser the Activity_history card reports data-status ready, renders the playtime block, and the other three supported cards stay pending with their notes
result: pass
source: automated
coverage_id: D4
source_file: 04-02-SUMMARY.md
requirement: ACTIVITY-01
verification_refs:
  - e2e: tests/e2e/dashboard.spec.ts#(sections-pending) three sections pending and Activity_history ready, all four in D-02 order with counts

### auto.11 — D5 (04-02-SUMMARY.md)
expected: A card's import counts are readable without naming the element its status happens to use, and the four-section snapshots still hold four entries before and after a reload
result: pass
source: automated
coverage_id: D5
source_file: 04-02-SUMMARY.md
requirement: ACTIVITY-01
verification_refs:
  - e2e: tests/e2e/persistent-dataset.spec.ts#(reload) the same dashboard comes back from IndexedDB with the same counts

### auto.12 — D6 (04-02-SUMMARY.md)
expected: The page carries exactly one live region besides the import bar's notice slot, and it is the playtime status line
result: pass
source: automated
coverage_id: D6
source_file: 04-02-SUMMARY.md
requirement: ACTIVITY-01
verification_refs:
  - e2e: tests/e2e/dashboard.spec.ts#(slim-variant) after the import the same element is the slim bar

### auto.13 — D1 (04-03-SUMMARY.md)
expected: aggregateSlice fills hourOverlap with the merged seconds each weekday-hour cell actually occupies, peeled a week at a time
result: pass
source: automated
coverage_id: D1
source_file: 04-03-SUMMARY.md
requirement: —
verification_refs:
  - unit: tests/unit/playtime.test.ts#04-03 tracer: overlap, midnight crossing and containment > credits hourOverlap with the hours the merged seconds actually occupy
  - unit: tests/unit/playtime.test.ts#bounded time > handles a 60,000-hour session without a 216-million-iteration loop

### auto.14 — D2 (04-03-SUMMARY.md)
expected: aggregateSlice fills hourStart with the merged seconds of the hour each session started in, alongside the unresolved HOUR_GRID_BASIS constant
result: pass
source: automated
coverage_id: D2
source_file: 04-03-SUMMARY.md
requirement: —
verification_refs:
  - unit: tests/unit/playtime.test.ts#04-03 tracer: overlap, midnight crossing and containment > credits hourStart with the hour each session started in

### auto.15 — D3 (04-03-SUMMARY.md)
expected: aggregateSlice fills the twelve duration bins from each session's raw length, so a fully-overlapped session still counts once
result: pass
source: automated
coverage_id: D3
source_file: 04-03-SUMMARY.md
requirement: —
verification_refs:
  - unit: tests/unit/playtime.test.ts#binOf > places each lower bound in its own bucket, inclusively

### auto.16 — D4 (04-03-SUMMARY.md)
expected: A seeded Sessions.csv generator whose expected aggregation is computed in closed form from its own layout, not by running the aggregator
result: pass
source: automated
coverage_id: D4
source_file: 04-03-SUMMARY.md
requirement: —
verification_refs:
  - unit: tests/unit/sessions-fixtures.test.ts#sessions fixture generator > matches the independent per-second oracle field for field

### auto.17 — D5 (04-03-SUMMARY.md)
expected: An independent oracle that resolves overlap with a per-second bitmap, able to disagree with the implementation's sweep
result: pass
source: automated
coverage_id: D5
source_file: 04-03-SUMMARY.md
requirement: —
verification_refs:
  - unit: tests/unit/playtime.test.ts#seeded cross-check against the oracle > matches field for field on seed %i

### auto.18 — D6 (04-03-SUMMARY.md)
expected: A characterisation matrix over parse, exclusion, column resolution, merge shapes and the T-04-01 IP guarantee
result: pass
source: automated
coverage_id: D6
source_file: 04-03-SUMMARY.md
requirement: —
verification_refs:
  - unit: tests/unit/playtime.test.ts#excluded rows

### auto.19 — D1 (04-04-SUMMARY.md)
expected: A seconds value becomes the exact text a tile shows, through the one hours rule, with the unit decided by the rendered numeral.
result: pass
source: automated
coverage_id: D1
source_file: 04-04-SUMMARY.md
requirement: ACTIVITY-01
verification_refs:
  - unit: tests/unit/ui-copy.test.ts#formatHours (Phase 4, UI-SPEC Page Anatomy 4)

### auto.20 — D2 (04-04-SUMMARY.md)
expected: Every user-visible Phase 4 string exists once in ui-copy.ts with the UI-SPEC's exact wording, including the six 04-02 added, and every singular form is explicit.
result: pass
source: automated
coverage_id: D2
source_file: 04-04-SUMMARY.md
requirement: ACTIVITY-02
verification_refs:
  - unit: tests/unit/ui-copy.test.ts#Phase 4 static copy and count formatters
  - unit: tests/unit/ui-copy.test.ts#04-02 tracer: Playtime state strings pinned to the UI-SPEC copy tables

### auto.21 — D3 (04-04-SUMMARY.md)
expected: The teal ramp is declared once, equals the UI-SPEC table level for level, and its recorded ratios and structural floors are proven rather than asserted.
result: pass
source: automated
coverage_id: D3
source_file: 04-04-SUMMARY.md
requirement: ACTIVITY-03
verification_refs:
  - unit: tests/unit/contrast.test.ts#playtime data ramp (04-UI-SPEC Color)

### auto.22 — D4 (04-04-SUMMARY.md)
expected: Calendar and weekday-hour text is built from the export's recorded date parts and does not move with the process timezone; the hour-basis wording switches on the one constant.
result: pass
source: automated
coverage_id: D4
source_file: 04-04-SUMMARY.md
requirement: ACTIVITY-04
verification_refs:
  - unit: tests/unit/ui-copy.test.ts#Phase 4 date, tooltip and accessible-name formatters

### auto.23 — D1 (04-05-SUMMARY.md)
expected: The colour scale is rank-based over the non-zero integer seconds (D-04): cut k at index min(n-1, ceil(n*k/5)-1), level 0 unshaded, duplicate cuts collapsing, and a legend that lists level 0 plus the levels in use
result: pass
source: automated
coverage_id: D1
source_file: 04-05-SUMMARY.md
requirement: —
verification_refs:
  - unit: tests/unit/playtime-model.test.ts#04-05 tracer: rank scale and a one-day calendar > puts the four cut points at the 20/40/60/80 percentiles of the non-zero values
  - unit: tests/unit/playtime-model.test.ts#04-05 tracer: rank scale and a one-day calendar > spreads a two-value slice across the ramp instead of one cut
  - unit: tests/unit/playtime-model.test.ts#04-05 tracer: rank scale and a one-day calendar > puts a single value in level 1 and a heavy tail in level 5

### auto.24 — D2 (04-05-SUMMARY.md)
expected: The calendar draws every day of every active year at the exact UI-SPEC geometry (2020-12-31 at column 52, row 3, x 604, y 53; 2012 at 54 columns; never more), with twelve month labels, per-year totals that reconcile with the slice, and consecutive empty years collapsed into one block so a stray 1970 or 9999 row cannot draw empty grids
result: pass
source: automated
coverage_id: D2
source_file: 04-05-SUMMARY.md
requirement: —
verification_refs:
  - unit: tests/unit/playtime-model.test.ts#04-05 tracer: rank scale and a one-day calendar > draws 366 cells for one active year and puts 2020-12-31 at column 52, row 3
  - unit: tests/unit/playtime-model.test.ts#calendar layout > gives 2012 the full 54 columns and never asks for a 55th
  - unit: tests/unit/playtime-model.test.ts#calendar layout > absorbs a stray 1970 and a stray 9999 into two gap blocks and 1095 cells
  - unit: tests/unit/playtime-model.test.ts#calendar layout > builds a forty-year model in well under 100 ms

### auto.25 — D3 (04-05-SUMMARY.md)
expected: A day with sessions but zero merged seconds keeps its session count at level 0 and still counts as an active day, so the tooltip can say '0 min, 1 session' (Pitfall 4)
result: pass
source: automated
coverage_id: D3
source_file: 04-05-SUMMARY.md
requirement: —
verification_refs:
  - unit: tests/unit/playtime-model.test.ts#calendar levels and legend > keeps the session count on a day with zero merged seconds and shades it level 0

### auto.26 — D4 (04-05-SUMMARY.md)
expected: The calendar's roving focus for all eight keys: week moves that cross into an adjacent drawn year, Up and Down confined to the same week column, Home and End to the year's first and last day on that weekday, and PageUp/PageDown across collapsed runs with the day of month clamped
result: pass
source: automated
coverage_id: D4
source_file: 04-05-SUMMARY.md
requirement: —
verification_refs:
  - unit: tests/unit/playtime-model.test.ts#calendar navigation > skips collapsed empty years on PageUp and PageDown, and refuses to walk into one with an arrow
  - unit: tests/unit/playtime-model.test.ts#calendar navigation > clamps February 29 to February 28 in a common year
  - unit: tests/unit/playtime-model.test.ts#calendar navigation > refuses to move up off a Monday and off the first day of the year

### auto.27 — D5 (04-05-SUMMARY.md)
expected: The weekday x hour model reads one of the two stored grids through a basis argument defaulting to HOUR_GRID_BASIS, so the open midnight-crossing decision needs no model edit and no re-import
result: pass
source: automated
coverage_id: D5
source_file: 04-05-SUMMARY.md
requirement: —
verification_refs:
  - unit: tests/unit/playtime-model.test.ts#hour grid model and keys > reads the grid the basis argument names, and both grids stay stored
  - unit: tests/unit/playtime-model.test.ts#hour grid model and keys > lays out 168 fixed cells indexed weekday times 24 plus hour

### auto.28 — D6 (04-05-SUMMARY.md)
expected: The hour grid's roving focus stops at all four edges and at Home/End without wrapping, and leaves an index that is not one of the 168 cells alone
result: pass
source: automated
coverage_id: D6
source_file: 04-05-SUMMARY.md
requirement: —
verification_refs:
  - unit: tests/unit/playtime-model.test.ts#hour grid model and keys > moves within the grid and stops at every edge without wrapping

### auto.29 — D7 (04-05-SUMMARY.md)
expected: Twelve duration rows with a percent of the slice and a bar scaled by the largest bin, floored at one unit so a lone session is never invisible, and returning zeros rather than NaN for an empty slice
result: pass
source: automated
coverage_id: D7
source_file: 04-05-SUMMARY.md
requirement: —
verification_refs:
  - unit: tests/unit/playtime-model.test.ts#duration rows > never lets a non-empty bin disappear, and never divides by zero

### auto.30 — D8 (04-05-SUMMARY.md)
expected: The split table is All plus at most eight values with a count of the remainder, so 50 values cannot grow it, and a selection past the eighth row flags no row
result: pass
source: automated
coverage_id: D8
source_file: 04-05-SUMMARY.md
requirement: —
verification_refs:
  - unit: tests/unit/playtime-model.test.ts#split table > shows All plus eight values and counts the rest
  - unit: tests/unit/playtime-model.test.ts#split table > carries the split totals and flags exactly the selected row

### auto.31 — D9 (04-05-SUMMARY.md)
expected: The selection-reset rule as one pure function: a requested value applies only to the dataset it was requested for and only while its index still exists, so a stale value can never render (D-03)
result: pass
source: automated
coverage_id: D9
source_file: 04-05-SUMMARY.md
requirement: —
verification_refs:
  - unit: tests/unit/playtime-model.test.ts#selection reset > applies a requested value only to the dataset it was requested for
  - unit: tests/unit/playtime-model.test.ts#selection reset > applies a requested value only while its index still exists

### auto.32 — D10 (04-05-SUMMARY.md)
expected: Tooltip placement as numbers — centred with an 8px gap, flipped below when the top edge would sit under the sticky nav, clamped 8px from every viewport edge — plus the focus-scroll correction and an hours figure to four decimals
result: pass
source: automated
coverage_id: D10
source_file: 04-05-SUMMARY.md
requirement: —
verification_refs:
  - unit: tests/unit/playtime-model.test.ts#tooltip placement > flips below when the top edge would sit under the sticky nav
  - unit: tests/unit/playtime-model.test.ts#tooltip placement > clamps the bottom on a viewport too short to hold the tooltip
  - unit: tests/unit/playtime-model.test.ts#focus scroll delta and hoursAttribute > reports hours to four decimals with no trailing zeros

### auto.33 — D1 (04-06-SUMMARY.md)
expected: A two-server Sessions.csv travels through the real worker to a per-value slice with merged seconds, session counts and per-value excluded counts
result: pass
source: automated
coverage_id: D1
source_file: 04-06-SUMMARY.md
requirement: ACTIVITY-01
verification_refs:
  - integration: tests/unit/ingest-worker.test.ts#04-06 tracer: split by SERVER_NAME through the real worker

### auto.34 — D2 (04-06-SUMMARY.md)
expected: The column-choice rule, value normalisation, ordering, cross-value non-additivity and the view's invalid-index fallback are pinned by a matrix with hostile values
result: pass
source: automated
coverage_id: D2
source_file: 04-06-SUMMARY.md
requirement: ACTIVITY-01
verification_refs:
  - unit: tests/unit/playtime.test.ts#chooseSplit rule matrix
  - unit: tests/unit/playtime.test.ts#split value handling
  - unit: tests/unit/playtime.test.ts#split slices and ordering
  - unit: tests/unit/playtime.test.ts#viewFromAggregates selection

### auto.35 — D3 (04-06-SUMMARY.md)
expected: Fixtures exist that force the CLIENT_PLATFORM fallback and the null split, and buildSplitTable and effectiveSelection get their first fixture-built coverage on both
result: pass
source: automated
coverage_id: D3
source_file: 04-06-SUMMARY.md
requirement: ACTIVITY-01
verification_refs:
  - unit: tests/unit/playtime.test.ts#04-06: a one-server, two-platform fixture forces the CLIENT_PLATFORM fallback
  - unit: tests/unit/playtime.test.ts#04-06: a one-server, one-platform fixture forces the null split

### auto.36 — D4 (04-06-SUMMARY.md)
expected: Legacy, version-mismatched, null and failed aggregates are rebuilt from the stored rows in one atomic snapshot, written back only while the dataset is unchanged, and a failure reaches the playtime-error channel without touching the dataset
result: pass
source: automated
coverage_id: D4
source_file: 04-06-SUMMARY.md
requirement: ACTIVITY-01
verification_refs:
  - integration: tests/unit/ingest-worker.test.ts#04-06 backfill: legacy, stale and failed playtime aggregates
  - unit: tests/unit/db.test.ts#04-06 — readSessionRowData
  - unit: tests/unit/db.test.ts#04-06 — writePlaytimeIfCurrent

### auto.37 — D1 (04-07-SUMMARY.md)
expected: A pending playtime query always settles — on success, worker error, message error, supersede, unavailable worker, and a throwing post. No path leaves a query hanging.
result: pass
source: automated
coverage_id: D1
source_file: 04-07-SUMMARY.md
requirement: ACTIVITY-01
verification_refs:
  - unit: tests/unit/playtime-client.test.ts#failPending
  - unit: tests/unit/playtime-client.test.ts#latest request wins
  - unit: tests/unit/ingest-client.test.ts#04-07 tracer: a worker failure releases a pending playtime query

### auto.38 — D2 (04-07-SUMMARY.md)
expected: Latest-wins: a stale answer can never overwrite a newer one, and a superseded query is released before any reply arrives.
result: pass
source: automated
coverage_id: D2
source_file: 04-07-SUMMARY.md
requirement: ACTIVITY-01
verification_refs:
  - unit: tests/unit/playtime-client.test.ts#a late reply for a superseded id is ignored, and the newest query still resolves

### auto.39 — D3 (04-07-SUMMARY.md)
expected: The IngestClient jobId counter, state machine, result and settle timer are provably unaffected by playtime messages, in every state.
result: pass
source: automated
coverage_id: D3
source_file: 04-07-SUMMARY.md
requirement: ACTIVITY-01
verification_refs:
  - unit: tests/unit/ingest-client.test.ts#04-07 the ingest state machine ignores playtime traffic

### auto.40 — D4 (04-07-SUMMARY.md)
expected: A worker that died before its ready handshake answers queries as unavailable and posts nothing to the dead worker.
result: pass
source: automated
coverage_id: D4
source_file: 04-07-SUMMARY.md
requirement: ACTIVITY-01
verification_refs:
  - unit: tests/unit/ingest-client.test.ts#a worker that died before ready answers queries as unavailable and posts nothing

### auto.41 — D1 (04-08-SUMMARY.md)
expected: The six-state machine resolves `result`, `error`, `superseded` and every empty state consistently, and a request can only produce `updating` for the dataset on screen.
result: pass
source: automated
coverage_id: D1
source_file: 04-08-SUMMARY.md
requirement: ACTIVITY-01
verification_refs:
  - unit: tests/unit/playtime-state.test.ts#derivePlaytimeState
  - unit: tests/unit/playtime-state.test.ts#every one of the six states is reachable, and only those six
  - unit: tests/unit/playtime-state.test.ts#acceptOutcome

### auto.42 — D2 (04-08-SUMMARY.md)
expected: A blank server name reaches the selector, the table cell and the live region as `(not recorded)`, and a real value that reads like that label stays a real value.
result: pass
source: automated
coverage_id: D2
source_file: 04-08-SUMMARY.md
requirement: ACTIVITY-01
verification_refs:
  - unit: tests/unit/playtime-state.test.ts#splitValue — the blank value crossing back into the display layer
  - unit: tests/unit/playtime-state.test.ts#a blank value announces the blank value's label, not an empty name
  - other: pnpm exec playwright test (throwaway 5k-fixture tracer, 2026-09-30): options and cells read `(not recorded)`

### auto.43 — D4 (04-08-SUMMARY.md)
expected: The split table shows All plus at most eight values with an overflow row, marks the applied row with `aria-current` and a weight change, and wraps a 60-character value without widening the page.
result: pass
source: automated
coverage_id: D4
source_file: 04-08-SUMMARY.md
requirement: ACTIVITY-01
verification_refs:
  - unit: tests/unit/playtime-model.test.ts#buildSplitTable (04-05, the cap and the selected flag this plan renders)
  - other: pnpm exec playwright test (throwaway 12-value fixture tracer, 2026-09-30): 10 rows, 13 options, index 10 marks no row
  - e2e: pnpm exec playwright test tests/e2e/dashboard.spec.ts (41 specs; the migrated 04-02 playtime-status and aria-live-count assertions)

### auto.44 — D5 (04-08-SUMMARY.md)
expected: The status live region is in the DOM in every state, empty and clip-hidden when it has nothing to say, and names the slice when it does.
result: pass
source: automated
coverage_id: D5
source_file: 04-08-SUMMARY.md
requirement: ACTIVITY-01
verification_refs:
  - unit: tests/unit/playtime-state.test.ts#statusLine
  - unit: tests/unit/playtime-state.test.ts#selectionAnnouncement
  - e2e: tests/e2e/dashboard.spec.ts#playtime-status renders and the page has exactly two live regions (04-02, still passing)

### auto.45 — D6 (04-08-SUMMARY.md)
expected: The Activity_history card shows both of D-02's sub-headings in one 24px column, the section shell is unchanged, and the pending note is asserted for activity-history again.
result: pass
source: automated
coverage_id: D6
source_file: 04-08-SUMMARY.md
requirement: ACTIVITY-01
verification_refs:
  - e2e: pnpm exec playwright test tests/e2e/dashboard.spec.ts tests/e2e/scroll-nav.spec.ts (54 passed)
  - other: git diff 40ac5c2 -- src/lib/components/DashboardSection.svelte (empty)

### auto.46 — D1 (04-10-SUMMARY.md)
expected: The calendar is a third sibling <section class="chart"> in PlaytimeCharts, placed BEFORE the weekday-by-hour grid, with one shared ChartTooltip still the container's last child.
result: pass
source: automated
coverage_id: D1
source_file: 04-10-SUMMARY.md
requirement: ACTIVITY-02
verification_refs:
  - unit: tests/unit/playtime-charts.test.ts#the calendar component exists and is a THIRD section, before the hour grid
  - e2e: chromium human-check, deleted after the plan (93/93 e2e green)

### auto.47 — D2 (04-10-SUMMARY.md)
expected: Each year block draws every day of that year, newest year first, on a fixed 626x97 svg with no viewBox, a sticky head and scroller as siblings, the levels from the ONE ramp declaration in app.css, and a run of empty years collapsed to a single line.
result: pass
source: automated
coverage_id: D2
source_file: 04-10-SUMMARY.md
requirement: ACTIVITY-02
verification_refs:
  - unit: tests/unit/playtime-charts.test.ts#04-10 Task 1 (11 contracts)
  - e2e: chromium human-check, 2922 cells for 8 years incl. 2 leap years

### auto.48 — D3 (04-10-SUMMARY.md)
expected: The calendar's day totals reconcile with the independent session oracle on a hand-chosen set crossing a year and on a seeded 600-session export.
result: pass
source: automated
coverage_id: D3
source_file: 04-10-SUMMARY.md
requirement: ACTIVITY-02
verification_refs:
  - unit: tests/unit/playtime-model.test.ts#04-10: the calendar against the independent session oracle

### auto.49 — D4 (04-10-SUMMARY.md)
expected: One tab stop for the whole chart, following focus; the eight navigation keys route through calendarNavigate and are prevented whether or not they move; each day cell is passed to the shared tooltip as its anchor.
result: pass
source: automated
coverage_id: D4
source_file: 04-10-SUMMARY.md
requirement: ACTIVITY-02
verification_refs:
  - unit: tests/unit/playtime-charts.test.ts#04-10 Task 2 (7 contracts)
  - e2e: chromium human-check, key model and hover/focus tooltip

### auto.50 — D1 (04-11-SUMMARY.md)
expected: The nine-row hand fixture and the independent-oracle cross-check that proves every number in it, under both hour bases
result: pass
source: automated
coverage_id: D1
source_file: 04-11-SUMMARY.md
requirement: ACTIVITY-02
verification_refs:
  - unit: tests/unit/playtime-hand-fixture.test.ts

### auto.51 — D2 (04-11-SUMMARY.md)
expected: The 18-row mixed fixture and the 21 tests proving the shapes the browser geometry specs depend on
result: pass
source: automated
coverage_id: D2
source_file: 04-11-SUMMARY.md
requirement: ACTIVITY-03
verification_refs:
  - unit: tests/unit/playtime-mixed-fixture.test.ts

### auto.52 — D3 (04-11-SUMMARY.md)
expected: Sixteen named browser tests over the calendar, the weekday-by-hour grid and the duration list, including the sticky head at two widths, 375px overflow and tooltip clipping
result: pass
source: automated
coverage_id: D3
source_file: 04-11-SUMMARY.md
requirement: ACTIVITY-04
verification_refs:
  - e2e: tests/e2e/playtime-charts.spec.ts

### auto.53 — D1 (04-13-SUMMARY.md)
expected: A unit guard that derives the projected e2e duration from the suite's real test count and fails when any of the three CI limits loses its margin or its place in the order.
result: pass
source: automated
coverage_id: D1
source_file: 04-13-SUMMARY.md
requirement: ACTIVITY-01
verification_refs:
  - unit: tests/unit/ci-budget.test.ts#CI e2e budget

### auto.54 — D2 (04-13-SUMMARY.md)
expected: The three nested limits raised to 15 min / 17 min / 25 min with the derivation beside each value, and the whole 109-test e2e suite green under them.
result: pass
source: automated
coverage_id: D2
source_file: 04-13-SUMMARY.md
requirement: —
verification_refs:
  - unit: tests/unit/ci-budget.test.ts#CI e2e budget > the shell wrapper outlives globalTimeout by at least 90 s
  - e2e: pnpm exec playwright test — 109 passed (40.1s) on three of four full runs; one run had 1 flake, see D4

## Summary

total: 59  # 5 human + 54 auto-passed
passed: 59
issues: 0
pending: 0
skipped: 0
blocked: 0
automated: 54

## Gaps

- gap_id: G-04-1
  truth: "A real Wargaming export produces a populated Playtime block (tiles, calendar, hour grid, duration bins, selector, excluded count)."
  status: resolved
  resolved_by: 04-14-PLAN.md, 04-15-PLAN.md
  resolved_at: 2026-10-01
  reason: "User reported: real export shows the no-session-file empty state. Real files are per-game: Activity_history/{WOT,WOTB,WOWS}_Game_Sessions.csv (plus a WOT .xlsx duplicate), header STARTED_AT;FINISHED_AT;IP, line endings CRLF (WOT) and bare CR (WOTB, WOWS), timestamps DD.MM.YYYY HH:MM. Phase 4 assumed Sessions.csv with SESSION_START;SESSION_END;CLIENT_BUILD;CLIENT_PLATFORM;SERVER_NAME;IP (a schema note + synthetic fixture, never a real export)."
  severity: major
  test: 1
  root_cause: "Phase 4 keys the whole Playtime pipeline on one exact file name (Activity_history/Sessions.csv) and on columns SESSION_START/SESSION_END/SERVER_NAME/CLIENT_PLATFORM, taken from a schema note and a synthetic fixture. Real exports ship per-game files {WOT,WOTB,WOWS}_Game_Sessions.csv with STARTED_AT;FINISHED_AT;IP, so the lookup finds nothing and the block shows the no-session-file state."
  artifacts:
    - path: "src/lib/worker/db.ts"
      issue: "single-key lookup of Sessions.csv (case-insensitive, exact name)"
    - path: "src/lib/worker/playtime.ts"
      issue: "column resolver and TIMESTAMP_RE assume SESSION_START/SESSION_END; timestamp format of real files unverified"
    - path: "src/lib/worker/ingest.worker.ts"
      issue: "hands only Sessions.csv rows to the aggregator"
  missing:
    - "Accept {GAME}_Game_Sessions.csv (WOT, WOTB, WOWS) as session sources; ignore the .xlsx duplicate"
    - "Resolve STARTED_AT/FINISHED_AT alongside the old names; game comes from the file name, so the selector can split by game when more than one file has rows"
    - "Fixture mirroring the real header shape (CRLF endings, DD.MM.YYYY HH:MM timestamps, header-only files) and a real-shape timestamp check"
  debug_session: ""  # diagnosed inline from the real export header

- gap_id: G-04-5
  truth: "After a second tab clears the cache, a selector change in the first tab either recovers or tells the user what happened."
  status: resolved
  resolved_by: 04-16-PLAN.md
  resolved_at: 2026-10-01
  reason: "User reported: changing the region selector in tab 1 does nothing after tab 2 cleared the cached data; no feedback. Current fix (707341d) settles on 'ready' with the old slice and silently drops the selection; tab 1 is never told the cache was cleared."
  severity: minor
  test: 5
  root_cause: "acceptOutcome drops an answer stamped importedAt:null and Playtime.svelte reconciles requested back to shown (707341d). That only prevents the stuck spinner; nothing surfaces that the dataset was cleared elsewhere."
  artifacts:
    - path: "src/lib/components/Playtime.svelte"
      issue: "dropped-answer branch resets silently"
  missing:
    - "On a dropped answer (store gone), show a short notice that the cached data was cleared in another tab, with a way back to the import"
  debug_session: ""  # diagnosed inline

- gap_id: G-04-TDD-EVIDENCE
  truth: 'Every plan in this phase produces machine-verifiable TDD red evidence before the green commit.'
  status: failed
  reason: '`check tdd-red-evidence` parses node:test TAP while vitest 5 nests every test under a file-level group, so it returns INVALID_RED/zero_tests_discovered for all 13 plans. The git-log scope gate does find all 30 RED commits, so the RED-before-GREEN order is real; the evidence gate is simply blind to this runner.'
  severity: minor
  test: null
  artifacts: []
  missing: []

- gap_id: G-04-CI-TIME-LIMITS
  truth: 'CI time limits (15/17/25 min) are validated against a real CI run on the suite.'
  status: failed
  reason: 'The suite measures ~41s locally against a ~630s projection; the derived global/job limits are unexercised. Read the first CI E2E step duration: >702s means re-deriving the guard constants and all three limits in one edit.'
  severity: minor
  test: null
  artifacts: []
  missing: []

- gap_id: G-04-IMPORT-FLOW-FLAKE
  truth: 'tests/e2e/import-flow.spec.ts:102 does not flake under a slow CI runner.'
  status: failed
  reason: 'Pre-existing flake, not a Phase 4 defect. The spec matches a hand-typed five-string pattern while ui-copy.ts:51 legitimately renders a sixth form. 1 failure in 4 full runs, 5/5 green alone. Fix by deriving the pattern from the copy module. Fix before the first CI run.'
  severity: minor
  test: null
  artifacts: []
  missing: []

- gap_id: G-04-REVIEW-INFO-FINDINGS
  truth: 'Code-review info findings IN-1..IN-5 from 04-REVIEW.md are acknowledged or resolved.'
  status: open
  reason: 'Out of `fix_scope: critical_warning` per 04-REVIEW-FIX.md. Left alone deliberately. None block the phase, but they remain recorded.'
  severity: cosmetic
  test: null
  artifacts: []
  missing: []

- gap_id: G-04-HOUR-GRID-BASIS
  truth: 'HOUR_GRID_BASIS is decided (overlap vs start) before phase 5.'
  status: open
  reason: 'Deferred decision per 04-REVIEW-FIX.md: both bases are stored, and changing the constant is a one-line edit, but no human has chosen which ships.'
  severity: cosmetic
  test: null
  artifacts: []
  missing: []

- gap_id: G-04-SCRATCH-CONFIG
  truth: 'playwright.scratch.config.ts is deleted from the repo root.'
  status: failed
  reason: 'Untracked file at the repo root, created by 04-REVIEW-FIX.md to run e2e on port 4174 because a `pnpm run preview` was already holding 4173. The fixer left it for a human to remove; the local permission gate refused the rm.'
  severity: cosmetic
  test: null
  artifacts: []
  missing: []

## Deferred Follow-Ups

- test: 3
  idea: "Add a hover border/outline on the calendar heatmap cell under the pointer, so it is clear which square a tooltip (and a screenshot) refers to."
  deferred_at: 2026-09-30
- test: 2
  idea: "Reword test 2 expected text: calendar tooltip shows date/hours/sessions only (D-04), never a wall-clock time."
  deferred_at: 2026-09-30
