---
phase: 04-activity-time-dashboards
scope: gap-closure (plans 04-14, 04-15, 04-16)
reviewer: code-reviewer (dispatched by gsd-code-review, execute:post gate)
reviewed: 2026-10-01T01:20:00Z
depth: standard
range: 5d39ae0..ecba107
files_reviewed: 17
findings:
  critical: 0
  warning: 0
  minor: 5
  info: 2
  total: 7
status: issues_found
verdict: APPROVE
fixed_in_this_gate:
  - finding 1 (stale module header)
  - finding 2 (vacuous T-04-01 assertion)
  - finding 5 (false role=alert comment)
  - finding 6 (contradictory alias comment)
  - finding 7 (re-spelled legacy predicate)
accepted_for_later:
  - finding 3 (backfill reports no-session-file for a header-only real export)
  - finding 4 (other-tab REPLACE stays silent)
---

# Gap-closure code review — plans 04-14, 04-15, 04-16

Range `5d39ae0..ecba107`: the three plans that close UAT gaps **G-04-1** (a real
Wargaming export showed no playtime) and **G-04-5** (a dropped selection was
silent). The pre-gap review of the phase's first 13 plans is `04-REVIEW.md` and
is unaffected.

**VERDICT: APPROVE** — no BLOCKER, no CONFIRMED MAJOR. 5 MINOR + 2 NOTE, of
which 5 were fixed inside this gate and 2 are accepted for a later decision.

## Criteria coverage

| Criterion | Status |
|---|---|
| G-04-1 reads real per-game files, dotted day-first, CRLF | Addressed |
| Old and new column names resolve side by side; legacy `Sessions.csv` intact | Addressed |
| `PLAYTIME_VERSION` → 2 self-repairs a dataset cached by the old build | Addressed, caveat in finding 3 |
| Login IP appears nowhere in the page HTML (T-04-01) | Addressed — verified by trace; unit assertion strengthened here |
| GAME comes from the session FILE NAME, never a cell | Addressed |
| One game → no selector, no single-value state | Addressed |
| >50 games is not a split; an excluded-only game is not a value | Addressed, both pinned |
| Legacy exports unaffected (game null everywhere) | Addressed |
| G-04-5 pure predicate + `role="alert"` notice | Addressed; see findings 4, 5 |
| WR-2 reconciliation logic unchanged | Addressed — `acceptOutcome` untouched but for one added comment; the new `cacheCleared` write sits inside the `accepted === null` branch that returns before the applied-answer reset, so it is not clobbered |

## Invariants checked and holding

- **IP containment** (the highest risk in this diff — the file header literally
  declares an `IP` column). Traced end to end: `resolveSessionColumns` names
  exactly four targets, `buildPlaytimeFromSources` builds its value object
  literally with no row spread, `aggregateSlice` keeps only `start`/`end`, and
  `byValue` keys are file-name game tokens or trimmed server/platform cells.
  The `IP` cell is read on no path. Fixtures use RFC 5737 TEST-NET-1 addresses
  only; the notice string is fixed copy containing no digits or punctuation.
- **Day-first parsing.** `parseSessionTimestamp` destructures `dotted[1]=DD,
  dotted[2]=MM, dotted[3]=YYYY` into `wallClockSeconds` — the argument order is
  correct, so no month/day swap. Every day and hour bucket derives from
  `wallClockSeconds` + `daysFromCivil`, with no `Date` or zone conversion on the
  new path. The tests cross-check against an independent `Date.UTC` oracle, which
  a swapped reading cannot survive.
- **CRLF.** PapaParse's newline detection strips terminators and every consumer
  additionally trims. The game code comes from the zip entry path, not a CSV
  cell, so a `WOT\r` game code is structurally impossible.
- **Alias resolution** is name-keyed (`Object.keys(row)`), not index-keyed, so
  reordered columns, header-only files, missing columns and header/row cell-count
  mismatch are all safe.
- **No new runtime dependency** (`package.json` and lockfile diff-verified clean);
  no `fetch`/XHR/WebSocket/`sendBeacon`/remote `import()`; Svelte 5 runes only; no
  new `Worker`; aggregation stays per-bucket, never one SVG node per row.

## Findings

### 1. MINOR · CONFIRMED — fixed — the module header stated the opposite of shipped behavior
`src/lib/worker/playtime.ts:36-40` still said a real export's split "is null and
every chart shows All; splitting the per-game files is plan 04-15" — but 04-15 is
in this range. A future reader trusting it could "fix" `chooseSplit` by dropping
`GAME`, and every test would still pass.
**Fixed:** the header now describes the shipped three-column rule, including that
a single game is deliberately not a split.

### 2. MINOR · CONFIRMED — fixed — the T-04-01 privacy assertion could not fail
`tests/unit/playtime.test.ts` asserted `Object.keys(resolveSessionColumns(...))`
equals four keys — which the function returns for any input, so it tested
nothing. Its sibling assertion compared only the `all` slice, so an address
reaching `splitColumn`/`values`/`byValue` would have passed.
**Fixed:** the assertion now checks the resolved key identity
(`toEqual({start: 'STARTED_AT', end: 'FINISHED_AT', server: null, platform: null})`)
and a new test compares the *whole* aggregate across three exports differing only
in the address, with a `JSON.stringify` scan for the addresses and the literal
`IP`. **Proven failable:** injecting an `['IP'] → platform` alias into the source
makes the new test fail and leaves the old one green.

### 3. MINOR · PLAUSIBLE — accepted for a later decision — the backfill reports a different state for the same bytes
`src/lib/worker/ingest.worker.ts:144` uses `snapshot.sources.length > 0` to mean
"a session file was seen". A real export whose game files are all header-only
stores zero rows, so the backfill recomputes `no-session-file` ("This export has
no session file") where a fresh import of the identical export correctly says
`no-usable-sessions`. The version bump makes this reachable for every dataset
written by the pre-04-14 build.
**Why not fixed here:** both behaviors are pinned by deliberate tests, and
choosing between them is a copy decision (which sentence is true for a
header-only file), not a defect fix. Left for a decision.

### 4. MINOR · CONFIRMED — accepted for a later decision — the other-tab *replace* case stays silent
`src/lib/playtime-state.ts:205-215` requires `importedAt === null && view ===
null`. When another tab imports a *different* export, the worker answers with
that dataset's stamp, the predicate is false, and the answer is dropped with no
notice — the same symptom G-04-5 was filed for, with a far more ordinary trigger
(dropping a second export in another tab). The silence is deliberate: the
notice's sentence would be false, and the plan forbade touching the state
machine. **Noted, not changed** — the executor already flagged it in its SUMMARY.

### 5. MINOR · CONFIRMED — fixed — the live-region comment asserted a false claim about `role="alert"`
`tests/e2e/playtime.spec.ts` and `src/lib/components/Playtime.svelte` both
claimed `role="alert"` means the element is *not* a live region. It is an
**implicit** `aria-live="assertive"` region, so the notice *is* the one new live
region; the count of two holds only because the explicit attribute is absent.
A future edit dropping the role because the comment said so would leave the
`[aria-live]` count unchanged and the test green, silently un-announcing the
notice.
**Fixed:** both comments now state that the role is the implicit live region
being relied on and that the explicit-attribute count is a separate contract.

### 6. NOTE · CONFIRMED — fixed — the alias comment contradicted itself
`src/lib/worker/playtime.ts:303` said "in match-priority order"; four lines later
the same comment said resolution is by first key in the row. The array order is
behaviourally irrelevant — the loop is name-keyed and the tests pin it.
**Fixed:** the priority clause is gone and the irrelevance is stated explicitly.

### 7. NOTE · CONFIRMED — fixed — the legacy file rule was half re-spelled
`src/lib/worker/db.ts` re-used `sessionFileNameGame` for the game branch but
re-spelled the legacy branch as a bare `'sessions.csv'` literal, so a second
legacy shape added to `playtime.ts` would reach the import path and miss the
backfill screen — exactly the drift the comment claims to prevent.
**Fixed:** `isLegacySessionsFileName` is now exported from `playtime.ts` and both
branches use the shared predicates.

## Limits of this review

- Nothing was run: no suite, no build, no browser. Every behavioural claim is
  from reading code and tests. The calendar-cell counts, the 1,800-second overlap
  figure and the announcement strings are arithmetic checked by hand.
- The e2e two-tab mechanism depends on Dexie reopening an empty DB after
  `deleteDatabase`. Pre-existing, not traced. If it regressed, finding 4's e2e
  would fail loudly rather than pass silently.
- PapaParse's behaviour on a bare `\r` mid-file (mixed line endings) is
  unchanged pre-existing code, declared out of scope by the plan, and untested —
  the real-shape fixture is uniformly CRLF.
- The whole-suite Playwright run is unobserved on this machine: Chromium cannot
  launch under the sandbox (`MachPortRendezvousServer … Permission denied
  (1100)`). Per-test runs under a scratch `--single-process` config did pass and
  are recorded in the plan summaries. A browser-capable machine, or the first CI
  run, closes this.
