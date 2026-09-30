---
phase: 04-activity-time-dashboards
plan: 07
subsystem: testing
tags: [web-worker, postMessage, promise-settlement, state-machine, vitest, svelte5]

# Dependency graph
requires:
  - phase: 04-activity-time-dashboards (04-01)
    provides: "playtime-query / playtime-result / playtime-error message types, the rune-free PlaytimeClient, and the IngestClient delegation seam at the top of #handle"
  - phase: 04-activity-time-dashboards (04-02)
    provides: "the Playtime block whose state derivation routes a null view to error, and which narrows outcomes by kind so a new variant needs no edit"
  - phase: 03-dashboard-shell-account-identity
    provides: "the IngestClient state machine, the #jobId namespace, the settle timer, and the D-21 rule that keeps error text off the screen"
provides:
  - "PlaytimeOutcome gains a `superseded` variant, so a superseded selector change is a settlement rather than a hang (D-03, T-04-13)"
  - "PlaytimeClient.query releases every older pending query as superseded on issue, making latest-wins structural"
  - "An availability probe (constructor's optional second argument) resolves a query as `worker unavailable` without posting to a dead worker (T-04-14)"
  - "A throwing post resolves as `post failed` instead of rejecting"
  - "PlaytimeClient.failPending(detail) releases every pending query; IngestClient calls it unconditionally at the top of onerror and onmessageerror"
  - "A 13-case regression suite pinning the IngestClient state machine against playtime traffic in every state"
affects: [04-08, 04-12, worker-client, playtime-client, activity-time-dashboards]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
actuals:
  tokens: 10115
  tasks: 3
  commits: 6

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fixed-detail failures: every client-side failure outcome carries a FIXED string chosen at the call site ('worker error', 'worker unavailable', 'post failed'), never a thrown message or an ErrorEvent's `message` — those can carry a file path, and Phase 3 D-21 keeps such text off the screen"
    - "Sentinel-race assertion: a test that awaits a promise which may never settle races it against an already-resolved marker, so a hang is an assertion diff that NAMES the cause rather than a 5s timeout"
    - "Settle-at-issue, not at-reply: a superseded request is released the moment its successor is issued, so the awaiting component is freed even if the worker never answers, and a late reply finds an unknown id and is dropped"
    - "Inject-the-truth: the Worker owner passes the availability signal down, so the class that books the promises is the one that knows whether they can be answered"

key-files:
  created:
    - tests/unit/playtime-client.test.ts
  modified:
    - src/lib/playtime-client.ts
    - src/lib/worker-client.svelte.ts
    - tests/unit/ingest-client.test.ts

key-decisions:
  - "The 04-02 `view: null` -> `error` decision is RE-AFFIRMED, not changed. Revisited deliberately as this plan's call; the reasoning is that a null view is a fact about the WORKER'S STORAGE, and both empty states are claims about the user's export."
  - "Availability is `!#workerBroken` only, deliberately NOT `!workerBroken || !workerReady`. Before `ready` the worker is unproven, not dead, and 04-01 lets a query go out from the moment the page loads."
  - "failPending is called UNCONDITIONALLY at the top of both worker-error handlers, before the state-machine branches, on the same principle as 04-01's delegation seam: a chart's fate must never depend on which import branch the machine is in."

patterns-established:
  - "Own id namespace, own resolver map, one delegation point: charts ask questions on a separate channel that the import state machine cannot observe (04-01, completed here by proving it in every state)"
  - "Regression-by-characterization: the inertness and counter-independence cases pass on first run and are still committed as RED-phase tests, recorded as characterization rather than failure"

requirements-completed: [ACTIVITY-01]

coverage:
  - id: D1
    description: "A pending playtime query always settles — on success, worker error, message error, supersede, unavailable worker, and a throwing post. No path leaves a query hanging."
    requirement: ACTIVITY-01
    verification:
      - kind: unit
        ref: "tests/unit/playtime-client.test.ts#failPending"
        status: pass
      - kind: unit
        ref: "tests/unit/playtime-client.test.ts#latest request wins"
        status: pass
      - kind: unit
        ref: "tests/unit/ingest-client.test.ts#04-07 tracer: a worker failure releases a pending playtime query"
        status: pass
    human_judgment: false
  - id: D2
    description: "Latest-wins: a stale answer can never overwrite a newer one, and a superseded query is released before any reply arrives."
    requirement: ACTIVITY-01
    verification:
      - kind: unit
        ref: "tests/unit/playtime-client.test.ts#a late reply for a superseded id is ignored, and the newest query still resolves"
        status: pass
    human_judgment: false
  - id: D3
    description: "The IngestClient jobId counter, state machine, result and settle timer are provably unaffected by playtime messages, in every state."
    requirement: ACTIVITY-01
    verification:
      - kind: unit
        ref: "tests/unit/ingest-client.test.ts#04-07 the ingest state machine ignores playtime traffic"
        status: pass
    human_judgment: false
  - id: D4
    description: "A worker that died before its ready handshake answers queries as unavailable and posts nothing to the dead worker."
    requirement: ACTIVITY-01
    verification:
      - kind: unit
        ref: "tests/unit/ingest-client.test.ts#a worker that died before ready answers queries as unavailable and posts nothing"
        status: pass
    human_judgment: false

# Metrics
duration: 12min
completed: 2026-09-30
status: complete
---

# Phase 04 Plan 07: Harden the Playtime request seam

**A pending playtime query can no longer hang: the worker died, the post threw, the user moved on, or the answer was stale — all five paths now settle, and the ingest state machine is proven untouched by any of them.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-09-30T02:12:38+04:00
- **Completed:** 2026-09-30T02:26:00+04:00
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- **No path leaves a playtime query hanging.** `failPending` releases every pending query on a worker `onerror` / `onmessageerror`; the availability probe refuses a query aimed at a dead worker; a throwing post resolves instead of rejecting; and a newer query supersedes every older one. That is the whole of T-04-14's mitigation and the whole of D-03's latest-wins rule, both now real rather than intended.
- **The Phase 3 state machine is proven inert in every state**, not just asserted in a comment: `processing`, `idle`, `confirm-pending`, `done`, `error` and the post-`cleared` acknowledgment each get their own inertness case, plus a stage-not-disturbed case, a mid-import completion case, and two counter-independence cases pinning `jobId` at 2 and 3 across five intervening queries.
- **The 04-02 `view: null` question was revisited deliberately and re-affirmed**, with the reasoning restated against the UI-SPEC state matrix. See Decisions Made.

## Task Commits

Each task was committed atomically, TDD RED before GREEN:

1. **Task 1: Tracer — a worker error while a playtime query is pending resolves it as an error outcome through IngestClient**
   - `a42d5d2` (test) RED — 4 assertion failures naming the sentinel marker, no timeouts
   - `8e44530` (feat) GREEN — 76/76 in the file
2. **Task 2: PlaytimeClient behaviour matrix (supersede, stale and unknown ids, unavailable worker, throwing post)**
   - `7dcfeef` (test) RED — 6 assertion failures; 9 characterization passes recorded as such
   - `b543d57` (feat) GREEN — 92/92 across both files
3. **Task 3: IngestClient regression suite and the availability probe wiring**
   - `45a2488` (test) RED — exactly 1 failure (the probe); 12 characterization passes
   - `ba96f8d` (feat) GREEN — 105/105 across both files

**Plan metadata:** (this commit)

## Files Created/Modified

- `src/lib/playtime-client.ts` — `PlaytimeOutcome` gains `{ kind: 'superseded', queryId }`; the constructor takes an optional `isAvailable` probe; new `pendingCount` getter, `failPending(detail)` and a private `#supersedePending()`; `query` advances the id before every early return, refuses an unavailable worker, and try/catches the post.
- `src/lib/worker-client.svelte.ts` — the `playtime` field is constructed with an availability probe reading `!#workerBroken`; `onerror` and `onmessageerror` call `playtime.failPending` unconditionally at the top, with the two fixed details. **No change to `#jobId`, the settle timer, or any state transition** — `git diff 40ac5c2 -- src/lib/worker-client.svelte.ts` is 42 insertions, 0 deletions, none of them on a state line.
- `tests/unit/playtime-client.test.ts` (new) — 15 tests in 5 groups: the id namespace, latest-wins, reply routing, the unavailable worker, a throwing post, and `failPending`.
- `tests/unit/ingest-client.test.ts` — two new describes: the 5-case Task 1 tracer and the 13-case Task 3 regression suite.

## Decisions Made

- **The 04-02 `view: null` -> `error` decision is RE-AFFIRMED. It was not left in place by accident.** 04-02 recorded this as the one place the state derivation would need to change, because 04-07 adds a `superseded` outcome kind. Having now built the kind, the derivation does **not** need to change, and the reasoning is stronger than it was: a `superseded` outcome is not a `result` at all, so it can never set `view` to null, and the only way to reach `view: null` is still a `result` carrying both nulls — the worker's statement that it has no stored aggregate for the dataset it was asked about. That is a fact about the worker's storage, not about the user's zip. `no-session-file` ("this export has no session file") and `no-usable-sessions` ("no usable sessions were found in this export") are both claims about the export, and neither can be made honestly. `PLAYTIME_ERROR` is the one sentence that is exactly true. The derivation and `Playtime.svelte` are therefore **unchanged by this plan** — the component narrows on `kind` and ignores arms it does not know, so the new variant type-checks with no edit, exactly as 04-02 predicted.
- **Availability is `!#workerBroken`, not `!#workerBroken || !workerReady`.** The obvious reading of "the worker is not available" would also refuse a query before `ready` arrives, but before `ready` the worker is *unproven*, not dead — and 04-01's contract lets a query go out from the moment the page loads. Refusing there would break the `checking-cache` window, where the dashboard is on screen and a query is legitimate. A broken-worker probe is the narrower, correct signal.
- **failPending is called before the branches, unconditionally.** The two existing handlers are conditional (`if state === 'processing'`). Copying that shape would tie a chart's fate to an import state: a query pending while idle would hang. The delegation is unconditional for the same reason 04-01's `#handle` branch is — a chart must never be observed by the import state machine.
- **The id counter advances before both early returns.** An unavailable worker and a throwing post still consume their id. If they did not, a late reply to a refused query could collide with the next live query's id — the exact T-04-13 confusion, reached from the other direction.

## Deviations from Plan

### Auto-fixed Issues

**1. Test-harness defects in my own RED tests (three, all mine)**
- **Found during:** Tasks 1-3 (RED phases)
- **Issue:** (a) Task 1's first run destructured `makeClient()`'s return as `{ c, f }` when it returns `{ client, fake }` — 5 fixture crashes, which is INVALID_RED, not RED. (b) Task 2's supersede test awaited a promise nothing replies to, producing a 5s timeout instead of a diff. (c) Task 3's broken-worker test first chained `.then` before `Promise.race`, so the race was armed after the wait it was meant to bound.
- **Fix:** Corrected the destructuring; replaced the bare `await` with the same `settleOrMarker` sentinel race used everywhere else; armed the race in the same expression as the query.
- **Files modified:** the two test files
- **Verification:** each corrected run produced clean assertion failures naming the marker, with zero timeouts
- **Committed in:** `a42d5d2`, `7dcfeef`, `45a2488` (the RED commits themselves)

**2. Fixture type mismatches in the new playtime-client test**
- **Found during:** Task 2 (GREEN verification)
- **Issue:** `PlaytimeSlice` fields were guessed as `hourByStart` and the `dayIndex` array was omitted.
- **Fix:** Corrected to `hourStart` and added `dayIndex: []` after `svelte-check` named both.
- **Files modified:** `tests/unit/playtime-client.test.ts`
- **Verification:** `pnpm run check` clean
- **Committed in:** `b543d57`

**3. A test of mine asserted a state the design forbids**
- **Found during:** Task 2 (GREEN)
- **Issue:** The plan's behaviour list says "failPending resolves every pending query, **including several at once**". But the same plan requires that issuing a query supersede every older one, so a correctly-behaving client can only ever hold ONE pending entry. The plan's own two requirements contradict each other at the level of what is reachable.
- **Fix:** Kept the implementation (it iterates the whole map, so it is correct for any number), and rewrote the test to the reachable and more meaningful property: the live query is released with its own id, and an already-superseded query is NOT settled a second time. Recorded here as a plan-internal conflict rather than silently resolving it in either direction.
- **Files modified:** `tests/unit/playtime-client.test.ts`
- **Verification:** 92/92 green; the superseded-first promise is asserted to keep its `superseded` outcome after `failPending` runs
- **Committed in:** `b543d57`

---

**Total deviations:** 3 auto-fixed (all defects in tests this plan wrote, none in production code beyond the plan's design)
**Impact on plan:** No scope creep. Deviation 3 is a real conflict in the plan text; the implementation follows the supersede rule, which is the one the plan states as a hard requirement ("latest request wins") and which 04-08's `updating` state depends on.

## Issues Encountered

- **Two INVALID_RED rounds, both self-inflicted and both corrected before GREEN.** Recorded above because the first Task 1 run reported "5 failed" — which looks like RED and is not; a fixture crash authorizes nothing. The tdd.md rule is explicit that only a named target test failing on a behavioural assertion counts. Both were re-run to genuine assertion failures before any production code was written.
- **The unavailable-worker RED could not be demonstrated with a bare `await`**, because a query posted to a dead worker never settles and the failure surfaces as a timeout rather than a diff. The sentinel race (already the file's convention from Task 1) is what makes this case assertable at all.

## Invariants confirmed untouched

- `IngestClient.result` still means "the last known cached dataset" — the three assignments that used to null it (replace-confirm, submit, `#fail`) remain absent; `git diff 39d675e` shows no such lines.
- The replace guard is still keyed on `result !== null`, not `state === 'done'`.
- A cache-check failure still recovers to `idle` with a cause and **no banner**; the Task 3 `idle` case re-asserts `errorMessage` is null.
- `HOUR_GRID_BASIS` in `src/lib/playtime-shared.ts` is untouched by this plan (`git diff --quiet 39d675e -- src/lib/playtime-shared.ts` exits 0); it differs from `40ac5c2` only because of plans 04-03/04-05, which predate this one.
- `buildPlaytime` remains try/caught in the worker and a failing aggregation still never fails the import; `src/lib/worker/ingest.worker.ts` and `src/lib/worker/db.ts` are byte-identical to the pre-plan HEAD.
- 04-03's two frozen parse rejections are untouched (`playtime.ts` not in the diff).
- No file outside the plan's `files_modified` list was modified: `git diff --stat 39d675e` lists exactly the four declared paths.
- `git diff --quiet 40ac5c2 -- package.json pnpm-lock.yaml` exits 0 — this plan installed nothing.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for 04-08.** It can lean on `superseded` to drive the UI-SPEC `updating` state and on the error outcomes to drive `error`, with every path already proven to settle. `Playtime.svelte` needs no edit for the new variant — the narrowing is by `kind`, as 04-02 predicted and this plan confirmed by a clean whole-tree `pnpm run check`.

**Two things 04-08 should know:**
- `superseded` is NOT a failure. A component receiving it has newer numbers on the way; rendering it as an error would flicker the error chrome on every selector change.
- The `view: null` -> `error` mapping is unchanged and now has a documented reason; 04-08 should not re-open it without a new reason.

**Unchanged and still open, both 04-12's:** `HOUR_GRID_BASIS` and the real `Sessions.csv` column names.

---
*Phase: 04-activity-time-dashboards*
*Completed: 2026-09-30*
