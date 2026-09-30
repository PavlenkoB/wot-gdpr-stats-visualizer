---
phase: 04-activity-time-dashboards
scope: gap-closure (plans 04-14, 04-15, 04-16)
type: gapclosure-verification
verified: 2026-10-01T01:45:00Z
range: 5d39ae0..f707cdd
gaps_verified: [G-04-1, G-04-5]
verdict: PASS
checks:
  unit: 882 passed / 27 files
  type_check: clean
  lint: clean
  build: clean
  e2e: UNVERIFIED - Chromium cannot launch under the macOS sandbox
---

# Gap-closure verification — G-04-1 and G-04-5

Independent verification of the three gap-closure plans, run against the code and
the actual test output rather than the summaries' claims.

**VERDICT: PASS.** Both gaps are closed as specified. Two MINOR gaps found by the
verifier were fixed in the same pass and are recorded below.

## G-04-1 — a real export shows playtime, and can be split by game

**CONFIRMED**, in three parts.

1. **The real file is read.** `Activity_history/{WOT,WOTB,WOWS}_Game_Sessions.csv`,
   header `STARTED_AT;FINISHED_AT;IP`, read per file with its own header; the
   game token comes from the zip entry path, never a cell. `PLAYTIME_VERSION` is
   now `2`, and the lazy backfill is genuinely wired to it — `isLegacyPlaytime()`
   gates the query and a mismatch triggers a rebuild from the stored rows, so a
   dataset cached by the pre-04-14 build repairs itself. Stored ROWS are never
   destroyed, only re-aggregated.
2. **Dotted, day-first, CRLF.** `parseSessionTimestamp` destructures
   `dotted[1]=DD, dotted[2]=MM, dotted[3]=YYYY` into `wallClockSeconds` — the
   argument order is correct, so there is no month/day swap. All day and hour
   buckets derive from `wallClockSeconds` + `daysFromCivil`; no `Date` or zone
   conversion appears on this path, so no UTC round-trip can move a session into
   the wrong local day. The tests cross-check against an independent `Date.UTC`
   oracle, which a swapped reading cannot survive. PapaParse strips CR
   terminators, the CSV reader additionally `trimEnd()`s, and the game code comes
   from the file path — a `WOT\r` value is structurally impossible.
3. **The game split.** `GAME` leads, is read from the file name, and only wins
   with 2–50 distinct values among USABLE sessions. One game → no selector, no
   table, no message. The cap is inclusive at exactly 50 and refuses 51. A game
   seen only on excluded rows is not a value (see the test added below). A legacy
   export with real `SERVER_NAME` values and null games keeps SERVER_NAME. The
   legacy `Sessions.csv` path is unchanged.

## G-04-5 — a dropped selection is no longer silent

**CONFIRMED.** `isCacheClearedElsewhere` is a pure predicate
(`importedAt === null && view === null`). The notice is a single
`data-testid="cache-cleared-notice"` with `role="alert"`, rendered outside every
state branch, and it explains both the cause and the way back. Critically, the
WR-2 reconciliation logic is **unchanged**: `acceptOutcome` differs from the
pre-gap version only by one added comment. The new `cacheCleared` write sits
inside the `accepted === null` branch, which returns before the applied-answer
reset, so the cached-index clear that WR-2 installed is not clobbered.

## Highest-risk claim: the login IP cannot reach the page

**CONFIRMED, and traced rather than accepted.** The session header literally
declares an `IP` column and the new code reads that file. The verifier traced
every path: `resolveSessionColumns` names exactly four targets (none of them
`IP`), `buildPlaytimeFromSources` constructs its value object as a literal with
no row spread, `aggregateSlice` retains only `start`/`end`, and the `byValue` map
keys are either file-name game tokens or trimmed server/platform cells. The `IP`
cell is read on no path — it is not a split candidate, not rendered, not logged,
and not in any copy string. Fixtures use RFC 5737 TEST-NET-1 addresses only. This
matches `04-UI-SPEC.md` §3.1 and the CONTEXT integration point.

## Invariants

Zero network calls after load (no `fetch`/XHR/WebSocket/`sendBeacon`/remote
`import()` in the range); no new runtime dependency (lockfile diff clean); Svelte
5 runes only; no new `Worker`; per-bucket aggregation with no per-row SVG node;
no real personal data in source, fixtures, logs or test output; TypeScript 6.

## Findings

### MINOR — fixed — the decisive excluded-only-game shape was untested
`chooseSplit` correctly counts only usable sessions, but the one test guarding
A6 used **two** usable games plus one excluded-only game. Counting excluded rows
would still yield a correct-looking split, so the test could not distinguish a
correct `chooseSplit` from a broken one. This is the same shape a malformed real
export will actually produce.
**Fixed:** added `is not a split when the ONLY other game is seen on excluded
rows`. **Proven failable** — feeding the excluded rows' values into `chooseSplit`
makes the new test fail (`expected 'GAME' to be null`) while the pre-existing
A6 test stays green, which is precisely the blind spot.

### MINOR — fixed — a stale "the two the worker can produce" comment
`Playtime.svelte` still said the worker could produce two split columns. There
are three since 04-15. **Fixed.**

### MINOR — accepted — the T-04-01 fixture reuses one IP across rows
The real-shape fixture's `ip` is a per-export default, so all rows share one
address. Since production never stores the address, this is a test-data
limitation rather than a behavioral difference; documented in the fixture. Left
as-is deliberately.

### NOTE — accepted — the other-tab *replace* case stays silent
Documented in `04-GAPCLOSURE-REVIEW.md` as finding 4. Correct by plan (any other
fix would invent certainty the state machine does not have) but a real, if
narrower, UX hole for a decision later.

## UNVERIFIED

- **End-to-end browser behavior.** The full Playwright suite cannot run on this
  machine: Chromium fails to launch with
  `bootstrap_check_in org.chromium.Chromium.MachPortRendezvousServer … Permission
  denied (1100)`, a macOS sandbox restriction confirmed independently by the
  orchestrator, by both the 04-14 and 04-15 executors, and by this verification.
  Per-test runs under a scratch `--single-process` config placed outside the repo
  did pass, including the notice spec, and are recorded in the plan summaries. A
  browser-capable machine, or the first CI run, closes this.
- **PapaParse on a bare `\r` mid-file** (mixed line endings) is unchanged
  pre-existing code, declared out of scope by plan 04-14, and untested. The
  real-shape fixture is uniformly CRLF.
- **Date oracle cross-check is partial.** Two tests assert the first hour-bucket
  index only (2020-11-02 is the date underlying index 10), and the cell map
  arrives as a constant from the summary's web-run rather than from a
  re-derivation here. The 04-14 executor did re-derive the full 7-key,
  2-hour resolution map locally and it matched. Re-deriving independently in
  `tests/unit/playtime-real-shape-fixture.test.ts` is the right follow-up.
