---
phase: 04-activity-time-dashboards
reviewer: gsd-code-reviewer (dispatched by gsd-code-review)
reviewed: 2026-09-30T08:17:49Z
depth: standard
files_reviewed: 29
commits: 2ef027c..38f2812
findings:
  critical: 0
  warning: 2
  info: 5
  total: 7
status: issues_found
files_reviewed_list:
  - src/app.css
  - src/lib/civil-date.ts
  - src/lib/components/CalendarHeatmap.svelte
  - src/lib/components/ChartLegend.svelte
  - src/lib/components/ChartTooltip.svelte
  - src/lib/components/Dashboard.svelte
  - src/lib/components/DurationList.svelte
  - src/lib/components/ExcludedNotice.svelte
  - src/lib/components/HourGrid.svelte
  - src/lib/components/LoginHistorySection.svelte
  - src/lib/components/Playtime.svelte
  - src/lib/components/PlaytimeCharts.svelte
  - src/lib/components/PlaytimeSummary.svelte
  - src/lib/dashboard-status.ts
  - src/lib/focus-clear.ts
  - src/lib/playtime-client.ts
  - src/lib/playtime-model.ts
  - src/lib/playtime-shared.ts
  - src/lib/playtime-state.ts
  - src/lib/types/worker-messages.ts
  - src/lib/ui-copy.ts
  - src/lib/worker-client.svelte.ts
  - src/lib/worker/db.ts
  - src/lib/worker/ingest.worker.ts
  - src/lib/worker/playtime.ts
  - .github/workflows/ci.yml
  - playwright.config.ts
  - .claude/skills/run-data-export-viewer/driver.mjs
  - .claude/skills/run-data-export-viewer/sessions-csv.mjs
---

# Phase 4 Review — Activity Time Dashboards

**Scope:** 13 plans, `2ef027c..38f2812`, the 29 files enumerated in
`files_reviewed_list` (6,476 insertions / 24 deletions). The diff under the
review globs is 30 files; the thirtieth is
`.claude/skills/run-data-export-viewer/SKILL.md`, whose delta is documentation
of the driver change I did review and is consistent with it.

**Method:** every file in the list read in full. The civil-date/hour/merge
arithmetic re-derived by hand against the recorded invariants, the
worker↔main-thread path traced end to end (import → `writeDataset` → meta
`playtime` → lazy rebuild → `viewFromAggregates` → `PlaytimeClient` →
`acceptOutcome` → `derivePlaytimeState` → DOM), and a grep sweep for the PII
and CSP invariants. Validation run: `pnpm run test:unit` → 789 passed in 26
files; `pnpm run check` → 0 errors, 0 warnings (app, node, test configs);
`pnpm run lint` → fails only with 153 `No tsconfigRootDir` parse errors caused
by the untracked `.kilo/worktrees/flashy-bit` checkout on this machine
(environmental, identical without the phase, not a finding).

---

## What held up

Three things in this phase are load-bearing, and I checked each one the way a
reviewer should — by tracing it rather than by reading that it is defended.

**The privacy wall is still a single choke point.** Phase 4 added a second
consumer of `Sessions.csv` rows, which is exactly where a leak would have
appeared, and it did not. `buildPlaytime` is called with `sessionRows`, the
array filled inside the ingest loop; it reads exactly four resolved header keys
(`SESSION_START`, `SESSION_END`, `SERVER_NAME`, `CLIENT_PLATFORM`) through
`resolveSessionColumns` and never touches the `IP` or `CLIENT_BUILD` cell. The
deny-list strip still happens in the same loop, before the push, and
`readSessionRowData` reads back the already-stripped `row.data`. `Map` grouping
rather than object keys (T-04-10) means a server named `__proto__` or
`constructor` is a value and not a prototype write. No `fetch`, no XHR, no
`{@html}`, no `cssText`, no `style="…"` string anywhere in `src/`; the only
style writes are the `element.style.left`/`.top` CSSOM calls the two heatmaps
need, and the CSP still carries `connect-src none` with no
`style-src 'unsafe-inline'`.

**The stale-aggregate write is guarded at both ends.** `readSessionRowData()`
reads meta and rows inside one `r` transaction so the snapshot is atomic, and
`writePlaytimeIfCurrent(snapshot.importedAt, …)` re-checks the active record
inside its own `rw` transaction and updates only the `playtime` field — so a
replace that lands mid-backfill can neither mix datasets nor rewrite a hash, an
identity or an `importedAt`. The import path builds the aggregate inside a
`try`/`catch` and hands it to `writeDataset` as part of the single transaction
that writes the rows, so an aggregation failure costs a recomputation rather
than a half-written dataset.

**The query lifecycle cannot hang or double-apply.** `IngestClient.#handle`
routes `playtime-result`/`playtime-error` to `PlaytimeClient.handle` before any
state-machine branch can see them; `failPending` is called unconditionally from
both `onerror` and `onmessageerror`; `query` consumes its id before the
availability probe, supersedes older pending queries on issue (so a late reply
finds an unknown id and is dropped), fast-fails on an unavailable worker and
catches a throwing `post`. Nothing on this path rejects, and nothing hangs:
every promise settles on one of `result`/`error`/`superseded`. I also
re-derived the merge sweep (`covered = -Infinity`, start-order walk, the
per-day last-entry compare), `addHourOverlap`'s week-peel, `binOf`'s strict
`>` edge, `cellOfHour`'s `Math.floor` on both divisions, `effectiveSelection`,
`rankScale.levelOf`, `clampTooltip` and `focusScrollDelta` by hand and found no
mismatch with their documented behaviour.

The copy matches the `04-UI-SPEC` "New copy" table exactly, constant for
constant and formatter for formatter; the ramp is declared once in `app.css`
with no per-hex restatement in a component; and the three CI-adjacent timeout
bumps (Playwright `globalTimeout` 15 m → wrapper 17 m → job 25 min) are
internally consistent with each other and with the floors
`tests/unit/ci-budget.test.ts` enforces.

---

## Findings

### Critical (0)

None.

### Warning (2)

**WR-1 — `src/lib/components/Playtime.svelte:126-132`: a failed query leaves
the PREVIOUS selection's announcement in the status line, which is visible
text, not just a live-region string.**

`announcement` is written in exactly one place — the `if` at line 130, and only
for a user-initiated load that came back a `ready` view — and it is assigned
`''` in exactly one other place, line 144 inside the `$effect` that runs on a
dataset change. No path clears it when a request fails. `statusLine` returns `announcement`
unchanged for every state that is not `loading`/`updating`
(`playtime-state.ts:210-214`), so the sequence

1. dataset loaded, slice A on screen, announcement `""`;
2. user selects B → `requested = {B}` → state `updating` →
   `"Updating charts..."`;
3. the B query fails (`post failed`, `worker unavailable`, or a worker
   `onerror` → `failPending`) → `acceptOutcome` returns `{kind: 'failed'}` →
   `shown` becomes that → state `error`;

leaves the paragraph reading the announcement from step 1's *previous*
successful selection — e.g. `Showing EU1: 3 hours, 12 sessions, 5 active days.`
— directly above the red error box, in 16px body text (`.status` is only
visually hidden while `statusText === ''`, and here it is not empty). The
charts, tiles and selector are gone in this state, so the line is describing a
slice that is not on screen, and because the text changes from
`"Updating charts..."` the polite live region announces it at the moment the
error appears.

The deliberate design is right — a stale answer must not be shown, and the
worker's `detail` must stay out of the DOM (T-04-24, D-21) — but it covers
*answers* and not *announcements*. Fix, in `load()`:

```ts
if (userInitiated && accepted.kind === 'view' && accepted.view.status === 'ready') {
  announcement = selectionAnnouncement(accepted.view);
} else {
  announcement = '';
}
```

**WR-2 — `src/lib/components/Playtime.svelte:126-127`: an outcome that
`acceptOutcome` drops after `requested` has already moved on strands the block
in `updating` forever.**

`onSelectChange` (line 157-163) writes `requested` *before* calling `load`, and
`load` returns without touching `shown` when `acceptOutcome` returns `null`.
`acceptOutcome` returns `null` for three non-fatal reasons, two of which are
reachable without any bug in the worker: `outcome.view === null` (the worker
has no active dataset for this query) and an `importedAt` that is not the ask's
(an answer for a dataset that has since been replaced). In both cases
`derivePlaytimeState` still sees `requested.importedAt === importedAt &&
requested.valueIndex !== shown.valueIndex`, so `awaiting` is true and the state
never leaves `updating` — the block shows the previous slice, the status line
says `Updating charts...`, and `aria-busy` is not set, with no recovery short
of a new import or a reload. The module comment at `playtime-state.ts:33-37`
names exactly this failure as the thing the two keys exist to prevent, and it
is prevented for a *replaced* dataset in the same tab (the `$effect` re-runs
and resets `requested`) but not for an answer that arrives stamped with a
different dataset — which is what a second tab clearing or replacing the
origin-wide IndexedDB cache produces while this tab still holds the last-known
result (D-27).

The decision to drop rather than error is correct and should stay. What is
missing is reconciling the request when the answer is discarded. Fix in
`load()`, before the early return — gate it on the ask still being the current
request and on the outcome not being superseded, so a genuine
`superseded` answer cannot roll `requested` back over the newer request:

```ts
if (accepted === null) {
  if (
    outcome.kind !== 'superseded' &&
    importedAt === wanted &&
    requested?.valueIndex === ask.valueIndex
  ) {
    requested = { importedAt: wanted, valueIndex: shown?.valueIndex ?? null };
  }
  return;
}
```

`shown` is stamped with the ask that produced it, so rolling back to
`shown.valueIndex` puts the block back in the state its displayed slice
actually implies (`ready`, or the export's own empty state), which is the same
"no answer is not an error" rule with the request side closed too.

### Info (5)

**IN-1 — `src/lib/playtime-shared.ts:38-39`: a comment that describes the
opposite of what the code does.**

> "The re-aggregate path lands in plan 04-06; today a mismatched version makes
> `playtime-query` answer `playtime-error` rather than serving buckets it cannot
> vouch for."

`handlePlaytimeQuery` treats a version mismatch as a cache *miss*: it rebuilds
from the rows and answers `playtime-result` (`ingest.worker.ts:113-144`), and
the header comment above it says so in as many words ("a stored aggregate that
is absent, null or of an older version — the lazy backfill below"). A reader
who trusts this comment would expect a `PLAYTIME_VERSION` bump to surface as an
error state, and might "fix" the rebuild path. The doc comment in
`ingest.worker.ts:71-79` is the correct one. Fix: delete the stale clause and
point at the backfill.

**IN-2 — `src/lib/playtime-shared.ts:60-61`: a comment that promises UI copy
which does not exist and must not.**

> "The UI copy tells the user when the cap bites rather than silently
> truncating (plan 04-06)."

There is no such string. `MAX_SPLIT_VALUES` biting means `chooseSplit` returns
`null`, and `04-UI-SPEC.md:406` requires exactly that case to be **silent** —
"No selector, split table or overlap note; charts show All; **no message**" —
which is what the code does. The comment is not only wrong, it argues for the
opposite of the spec. Fix: say the cap is silent by design, citing the state
matrix row.

**IN-3 — `src/lib/worker/playtime.ts:257-259`: "The two callers" — there is
one.**

`addHourOverlap` has exactly one caller in the tree, `aggregateSlice` at line
350. The "single hour" case the comment lists as the second caller is the
`first === last` branch *inside* the function (line 265). Behaviourally inert;
misleading to the next reader, who will go looking for a second call site to
audit. Fix: reword to "one caller, and one internal branch" — the
double-clipping note itself is accurate and worth keeping.

**IN-4 — `src/lib/playtime-model.ts:660` (and `:687`): `DurationRow.percent` is
computed on every render path and read by nothing.**

The field is populated in `buildDurationRows`, which runs for every slice and
every re-selection, and the only consumer of the share,
`formatDurationRowText` (`ui-copy.ts:915-920`), recomputes
`(count / sessions) * 100` from its own arguments. No component, no formatter
and no test reads `.percent`. Two reasons it is worth removing rather than
leaving: the doc comment above it (line 668) describes a two-denominator
distinction that no code makes, and a future reader could reasonably wire the
raw percentage into the row text and lose the `<1%` rule at `ui-copy.ts:918`
without noticing. Fix: drop the field from `DurationRow` and the object
literal, or make `formatDurationRowText` take the row.

**IN-5 — `src/lib/components/CalendarHeatmap.svelte:381`: the year comparison
is unpadded on one side.**

```ts
return cell.date.slice(0, 4) === String(year);
```

`cell.date` comes from `isoDate` (`playtime-model.ts:270-273`), which pads the
year to four characters, while `String(year)` is unpadded. For every year from
1000 to 9999 the two agree, so this is invisible in practice — but
`parseSessionTimestamp`'s regex accepts any `\d{4}` year
(`playtime.ts:91`) and only range-checks the calendar fields, so a row dated
`0999-05-05` (or `0000-01-01`) produces a cell whose focus ring is never drawn
in any year block: `isInYear` is false, so the `{@if}` at line 551 skips the
ring for the focused day. Impact is one missing focus ring on garbage data, not
a wrong number. Fix: `cell.date.slice(0, 4) === String(year).padStart(4, '0')`.

---

## Investigated and cleared

Recorded so the next reviewer does not re-derive them.

**1. The split cap of 50 looked off by one. It is exact.**
`chooseSplit` (`playtime.ts:200-210`) adds the value and *then* tests
`distinct.size > MAX_SPLIT_VALUES`, so the 51st distinct value is what trips
the break: 50 values is accepted, 51 is rejected, regardless of where in the
row order the 51st appears. The inclusive cap in the comment
(`playtime.ts:195-198`) is a description of the code, not an aspiration.

**2. `addHourOverlap`'s week fast-path.** Re-derived for a three-week run and
for runs whose interior is not a whole number of weeks: `weeks * 3600` per cell
plus the sub-168-hour loop covers every interior hour exactly once, and the
head/tail partials are clipped to the hour boundary. `sum(hourOverlap) ===
sum(hourStart) === sum(daySeconds) === seconds` and `sum(bins) === sessions` all
hold by construction, because every array is filled from the same increment and
the raw length respectively.

**3. A header-only `Sessions.csv` reports `no-session-file` after a lazy
rebuild. Documented and deliberate.** `handlePlaytimeQuery` passes
`snapshot.rows.length > 0` as `sessionsFileSeen`, which cannot distinguish a
missing file from a file with headers and no data rows; the comment at
`ingest.worker.ts:92-94` says exactly that, and the import path records the flag
per file (`ingest.worker.ts:313`) so new imports are exact. The UI-SPEC
distinguishes the two cases and the copy differs, so the limitation is real —
it is scoped, commented, and only reachable through the rebuild path.

**4. The stale index in a foreign-dataset answer is a Warning, not a
data-integrity bug.** `writePlaytimeIfCurrent` returns a boolean the caller
ignores, and that is correct: the aggregate is a cache, the rows are the data,
and the answer is built from the snapshot rather than the cache.

**5. `compareSplitEntries` never returns 0 for two equal non-null values.**
`a.value < b.value ? -1 : 1` would be a non-total order if duplicates could
coexist, but the values come from `Map` keys, so they cannot. The tie rule
(blank last among equal seconds) is what the comparator's two null branches are
for, and it is exercised.

---

## Single engineering-hygiene note (not filed as a finding)

`Playtime.svelte:336-337` says the status paragraph is "Empty in every state
but `loading`". `statusLine` also fills it in `updating`, and it is the
selection announcement in `ready` whenever the user has changed the split. The
comment under-describes rather than misleads, so it is not filed — but WR-1 is
easier to understand once you know that paragraph is real, visible body text
in more states than the comment admits.

---

## Verdict

**Pass with two warnings.** The phase does what it says. The privacy wall
survived a second consumer of `Sessions.csv` rows, the aggregate's write path is
transactional and tear-safe, the query path cannot hang, reject or
double-apply, the calendar/hour/duration arithmetic matches its documented
invariants, and the copy matches the UI-SPEC table exactly. The eight
deliberately-accepted limitations in `STATE.md` and the phase plans were
treated as settled and are not re-litigated here.

Both warnings are in the same function and share one root cause: `load()`
updates `shown` and `announcement` on the paths where it gets an answer, and
does not reconcile either when an answer is discarded or fails. Neither
requires a worker bug to reach — a fast-failed query (worker unavailable, post
threw) is enough for WR-1, and a second tab touching the shared IndexedDB
cache is enough for WR-2. Fix both in `Playtime.svelte` and the six-state
matrix is airtight; the five Info items are comment and dead-field cleanups that
should not hold the phase.

**Next step:** `/gsd-verify-work 4` — the gate is green, but the two warnings
concern states no browser test drives (a failed selection change, a dropped
answer), so verification should either add a fixture for them or confirm the
window is unreachable in practice.
