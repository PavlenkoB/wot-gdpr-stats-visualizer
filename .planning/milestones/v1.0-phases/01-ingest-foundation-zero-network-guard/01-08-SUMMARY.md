---
phase: 01-ingest-foundation-zero-network-guard
plan: 08
subsystem: ingest
tags: [ingest, web-worker, state-machine, error-handling, vitest, tdd]

# Dependency graph
requires:
  - phase: 01-ingest-foundation-zero-network-guard
    plan: 04
    provides: IngestClient onerror/onmessageerror handling, #workerBroken flag, the pre-ready fail-fast and the single #fail path
  - phase: 01-ingest-foundation-zero-network-guard
    plan: 05
    provides: MIN_PROCESSING_MS busy floor and #scheduleSettle — the surface WR-01 used to hang on
provides:
  - IngestClient.onerror marks #workerBroken on EVERY error event (WR-01 closed)
  - IngestClient.submitFiles dead-worker fail-fast before the justCleared reset, the pre-check, the replace confirm and any postMessage
  - Unit test 'onerror while idle AND ready: a later submitFiles fails fast without posting (WR-01)'
affects:
  - phase 04 (data visualizations — every future surface inherits the canonical worker-not-ready failure instead of a stuck spinner)
  - WR-01 remediation in 01-VERIFICATION.md advisory block (now closed)

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
actuals:
  tokens: 1596
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Terminal-event handling that mutates its own preconditions: an onerror sets the broken flag before branching on state, so no branch can forget it"
    - "Submission guards ordered by user-visible cost — silent no-ops (busy, confirm-pending) first, then permanent-failure fail-fasts, then work that costs the user something (pre-check, replace confirm)"

key-files:
  created: []
  modified:
    - src/lib/worker-client.svelte.ts
    - tests/unit/ingest-client.test.ts

key-decisions:
  - "Every onerror sets #workerBroken unconditionally, including on the processing and pre-ready branches — a worker that raised an error event is dead in all three states, so the flag is a property of the worker, not of the client state (no branch-level guard can be forgotten again)"
  - "The dead-worker guard sits immediately after the confirm-pending guard, ahead of the justCleared reset, precheckFiles and the replace confirm: those all cost the user something (a dismissed D-20 banner, a burned pre-check, a confirm panel whose confirmPending() posts to a dead worker) for a submission that can never succeed"
  - "The pre-existing guard 5 (`#workerBroken || !workerReady`) is kept as the not-yet-ready half of the same check — redundant but harmless, and leaving it avoids churn on a path every existing test exercises"
  - "No respawn: PLATFORM-02 forbids a second post-load script fetch, so a dead worker stays dead and the broken flag is the whole response (plan prohibition 1 honored — the file still contains exactly one createWorker() call, in the constructor)"

patterns-established:
  - "WR-01 regression shape: drive the client to the gap state (ready + idle, or whichever state the advisory named), fire the terminal event, then assert the NEXT submission neither posts nor settles onto a floor"
  - "Assert the absence of the hang, not just the presence of the error: a settle-timer count of 0 plus `busy === false` after advancing past MIN_PROCESSING_MS proves the busy floor is never even reached"

requirements-completed: []

# Coverage metadata (#1602) — one entry per shipped deliverable.
coverage:
  - id: D1
    description: "An onerror while the client is idle AND ready marks the worker broken, so a later submitFiles() returns false, never posts, and surfaces the canonical worker-not-ready failure"
    verification:
      - kind: unit
        ref: "tests/unit/ingest-client.test.ts#onerror while idle AND ready: a later submitFiles fails fast without posting (WR-01)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The pre-existing onerror paths are unchanged: processing still schedules the settle with the same cause prefix, and a pre-ready error still sets #workerBroken and calls #fail('worker-not-ready') exactly once"
    verification:
      - kind: unit
        ref: "tests/unit/ingest-client.test.ts#onerror while processing lands in the generic error state"
        status: pass
      - kind: unit
        ref: "tests/unit/ingest-client.test.ts#onerror while processing is gated by the same floor"
        status: pass
      - kind: unit
        ref: "tests/unit/ingest-client.test.ts#onerror before ready: a later submission fails fast without posting"
        status: pass
    human_judgment: false

# Metrics
duration: 5min
completed: 2026-09-30
status: complete
---

# Phase 01 Plan 08: WR-01 Worker-Break Advisory Closure Summary

**A worker that errors between submissions now fails the next submission fast on the canonical "worker not ready" banner instead of posting into a dead worker and leaving the UI on a spinner that never settles**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-09-30T20:49:36+04:00
- **Completed:** 2026-09-30T20:53:42+04:00
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- `IngestClient.onerror` now sets `#workerBroken = true` unconditionally, before branching on state. A worker that raises an error event is dead whether it happened while processing, before `ready`, or — the WR-01 gap — while the client was idle and ready with nothing in flight.
- `submitFiles` gained a dead-worker fail-fast immediately after the confirm-pending guard, so the check runs before the `justCleared` reset, before `precheckFiles`, before the replace confirm, and long before any `postMessage`.
- The new RED→GREEN test `'onerror while idle AND ready: a later submitFiles fails fast without posting (WR-01)'` pins the whole advisory: returns `false`, posts nothing, surfaces the canonical copy, and never reaches the busy floor.
- The comment that documented the gap ("the error is informational only") is gone; the class docstring's "errors BEFORE reporting 'ready'" claim was corrected in the same pass, since the fix inverts exactly that invariant.

## Task Commits

1. **Task 1: RED test for idle+ready → broken onerror transition** - `cd38ed7` (test)
2. **Task 2: GREEN — mark worker broken on EVERY onerror + guard submitFiles** - `950830d` (fix)

**Plan metadata:** `ed86f25` (`plan_head_before`, plan 01-09's summary commit)

### TDD evidence

**RED** (`cd38ed7`, committed before any production change) — `pnpm exec vitest run tests/unit/ingest-client.test.ts` exited **1** with exactly one failure, the new WR-01 test, on a behavioral assertion (not a type/import/discovery error):

```
 ❯ tests/unit/ingest-client.test.ts (72 tests | 1 failed) 16ms
   × onerror while idle AND ready: a later submitFiles fails fast without posting (WR-01)
AssertionError: expected true to be false // Object.is equality
 ❯ tests/unit/ingest-client.test.ts:390:16
    390|     expect(ok).toBe(false);
 Test Files  1 failed (1)
      Tests  1 failed | 71 passed (72)
```

`submitFiles` returned `true` — the current handler does nothing in the idle+ready branch, so the submission posted to the dead worker and entered `processing` (the hang). Baseline before the test was added: `71 passed (71)`.

**GREEN** (`950830d`) — same command, exit 0, `Tests 72 passed (72)`.

## Verification

| Command | Exit | Observed output |
| --- | --- | --- |
| `pnpm exec vitest run tests/unit/ingest-client.test.ts` (RED) | 1 | `Tests 1 failed \| 71 passed (72)` — only the new WR-01 test |
| `pnpm exec vitest run tests/unit/ingest-client.test.ts` (GREEN) | 0 | `Test Files 1 passed (1) / Tests 72 passed (72)` |
| `pnpm run test:unit` | 0 | `Test Files 15 passed (15) / Tests 337 passed (337)` (336 pre-existing + 1 new) |
| `pnpm run check` (`tsc -b`) | 0 | no diagnostics |
| `pnpm run lint` (`prettier --check . && eslint .`) | 0 | `All matched files use Prettier code style!` |
| `pnpm run build` | 0 | `✓ 137 modules transformed`, `✓ built in 125ms` |
| `pnpm run build && grep -c "connect-src 'none'" dist/index.html` | 0 | `1` — CSP meta unaffected |
| `git log --format=%h --grep='(01-08)' -- src/lib/types/worker-messages.ts src/lib/worker/ingest.worker.ts` | 0 | empty — D-09 contract never touched by this plan |

**`pnpm run test:e2e` was NOT run.** Chromium cannot launch in this agent runtime (macOS Mach-port bootstrap is denied; every spec dies at 0 ms). This is a known environment boundary, not a plan result — the plan's e2e criterion is unverified here and remains open for a run in a Chromium-capable environment. Nothing in this plan changes the DOM, wiring, or build plugin chain (the only production file touched is the main-thread view model), so e2e risk is confined to the unit-covered state machine.

### Plan acceptance criteria — Task 2

- `grep -c '#workerBroken = true' src/lib/worker-client.svelte.ts` → `2` (unconditional + the retained pre-ready one) — PASS
- `grep -n 'this\.#workerBroken'` → 4 hits: `onerror` (2), the new `submitFiles` guard, the retained guard 5 — PASS
- "If we're idle AND ready, the error is informational only" removed → `grep -c` returns `0` — PASS
- `pnpm run test:unit` exits 0 with count ≥ 151 → 337 — PASS
- `src/lib/types/worker-messages.ts` / `src/lib/worker/ingest.worker.ts` have no `(01-08)` commits — PASS

### Plan prohibitions — checked

- **No second worker on onerror.** The handler gained one assignment and nothing else; `src/lib/worker-client.svelte.ts` still contains exactly one `createWorker()` call, in the constructor. No `new Worker`, no respawn, no fetch.
- **No `postMessage` on a dead worker.** The new guard (line 397) returns before `this.#worker.postMessage(message)` in `submitFiles` (line ~475), before `precheckFiles`, and before the replace confirm that would otherwise hand the dead worker a job through `confirmPending()`.
- **The two existing onerror paths are byte-identical in behavior.** The processing branch still schedules the settle with the same `` `worker error: ${event.message}` `` cause; the pre-ready branch still sets the flag and calls `#fail('worker-not-ready')` exactly once, with no further posts. Verified by the unchanged outcomes of `'onerror while processing lands in the generic error state'`, `'onerror while processing is gated by the same floor'`, and `'onerror before ready: a later submission fails fast without posting'`.
- **No pre-existing test modified.** `git diff --numstat tests/unit/ingest-client.test.ts` on the RED commit: `39 0` — 39 insertions, 0 deletions.

> Note on `playtime.failPending`: the plan's `<interfaces>` block shows a `this.playtime.failPending('worker error')` call in the handler and its acceptance prose says the "04-07 playtime release on the same onerror event is unchanged". No `playtime` call exists anywhere in this repo's `worker-client.svelte.ts` — 04-07 belongs to a phase that has not run yet. Nothing was removed (constraint satisfied trivially) and nothing was added: adding the playtime release would be a new 04-07 behavior, out of this plan's scope. The handler's control flow is otherwise exactly as the plan's interfaces block describes it.

## Files Created/Modified

- `src/lib/worker-client.svelte.ts` — `onerror` marks `#workerBroken` unconditionally (and the gap-documenting comment is removed); `submitFiles` gains the dead-worker fail-fast; the class docstring's "errors BEFORE reporting 'ready'" sentence corrected to match the new invariant.
- `tests/unit/ingest-client.test.ts` — one added test, `onerror while idle AND ready: a later submitFiles fails fast without posting (WR-01)`, placed with the other `onerror` tests. No pre-existing test touched.

## Decisions Made

- **The new test drives the client with the shared `beforeEach` client (floor 0), not a local floor-400 client.** The plan's step (g) asks to advance past `MIN_PROCESSING_MS` and assert `busy === false`. With the file's default 0 ms floor that advance is a no-op, so the busy floor is proven unreachable structurally instead: `expect(vi.getTimerCount()).toBe(0)` asserts no settle timer was ever queued for the dead-worker submission, which is the property that actually matters (the floor can only strand the view if a floor timer was started). This keeps the new test stylistically identical to its two neighbors, which also use the shared client.
- **Guard 5 was left alone.** With the early guard in place, `if (this.#workerBroken || !this.workerReady)` in guard 5 is now reachable only via the `!workerReady` half. Removing the redundant half would touch a branch every existing test exercises for no behavior change; keeping it is the smaller coherent change and preserves the not-yet-ready fail-fast.
- **`posts.length === 0` became "no new posts, and no ingest message at all".** The plan's behavior block assumes zero posts are on the wire, but since 02-02 the `ready` handshake itself posts a `check-cache` request, so a literal `posts.length === 0` cannot hold after reaching the ready handshake. The assertion is expressed in this file's existing idiom (`postsBefore` + an `ingest`-only filter), which tests the same thing the plan means: the submission never reached `postMessage`.

## Deviations from Plan

Three small, in-scope execution deviations — no scope change, no extra files:

1. **Assertion shape for the post count** (see Decisions) — required by the 02-02 `check-cache` handshake the plan's text predates.
2. **Floor proof via `vi.getTimerCount() === 0`** rather than a floor-400 client (see Decisions).
3. **Class docstring correction** (2 lines) in the file the plan already edits: it claimed a worker "that errors BEFORE reporting 'ready'" is marked broken, which this fix inverts. Left as-is it would have documented the pre-fix behavior as the current one.

No auto-fixed issues; no deviation rules (1–4) were triggered. Nothing was discovered outside the plan's scope.

## Issues Encountered

- The plan's `<verify>` and `acceptance_criteria` both require `pnpm run test:e2e` to exit 0. It was not run — Chromium cannot start in this runtime. Recorded as an open verification item, not as a failure of this plan.
- A first commit attempt failed with `cannot create temp file for here document: Operation not permitted` (the sandbox blocks heredoc temp files). Worked around by passing the commit body as multiple `-m` flags; the resulting commit content is identical.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- WR-01 is closed: the last advisory that could strand a user on a spinner that never resolves now settles to a visible, dismissible failure.
- Remaining 01-VERIFICATION advisories (CR-01, WR-02 … WR-06) are untouched by this plan and still open.
- **Residual gap worth a future advisory, deliberately NOT fixed here (out of scope):** `confirmPending()` bypasses the submission guards by design and still calls `postMessage` directly. The new early guard closes the reachable route to it (a broken worker can no longer open a replace confirm via `submitFiles`), but if a worker dies *while* a replace confirm is already open, confirming still posts into a dead worker. That is a pre-existing seam in `confirmPending`, not something 01-08 changed.

---
*Phase: 01-ingest-foundation-zero-network-guard*
*Plan: 08*
*Completed: 2026-09-30*

## Correction notes (gap closure 01-12, 2026-10-10)

The text above is the historical record of what plan 01-08 did and was true when written; the points below are where a later phase changed the current tree on purpose. Evidence and re-run commands live in `.planning/phases/01-ingest-foundation-zero-network-guard/01-SUPERSESSIONS.md`.

- **The idle-and-ready fix does NOT describe the current tree (record G1).** Claim: "`IngestClient.onerror` marks `#workerBroken` on EVERY error event (WR-01 closed)", "now sets `#workerBroken = true` unconditionally, before branching on state", and the new test `'onerror while idle AND ready: a later submitFiles fails fast without posting (WR-01)'` pins it (lines 16-18, 43, 57-60, 97-99, 115 and 191). True now: Phase 4 plan 04-07 reversed this on purpose. In `src/lib/import/worker-client.svelte.ts` (the file moved from `src/lib/worker-client.svelte.ts`) `onerror` sets `#workerBroken` only in the `!this.workerReady` branch (lines 261-268); an error event while the client is idle and ready is logged and releases pending queries, and nothing else. The code comment at lines 230-250 records that 04-07 "won the merge against WR-01". The cited test name is not in the suite (grep count 0 in `tests/unit/import/ingest-client.test.ts`); the suite pins the opposite behaviour in two named tests: `'a worker error while idle and ready leaves the ingest machine exactly as it was'` (line 1608) and `'a worker that is idle and ready is not marked broken: queries still work after an error'` (line 1887). The submit-time guard this plan added (`if (this.#workerBroken)`, line 493) is still present, but it can now only be reached after a pre-ready error. Two comments in that file (the class docstring at lines 64-66 and the guard comment at lines 474-480) still describe the pre-04-07 contract and were left unchanged by gap closure 01-12, which edits no source. Record: G1 in `01-SUPERSESSIONS.md`.
- **Do not read "WR-01 is closed" as the dead-worker case being resolved.** A worker that dies after `ready` is still not detected; that remains an open advisory (`01-REVIEW.md` WR-04 at line 170 and WR-05 at line 176, deferred by plan 01-15). Record: G1 in `01-SUPERSESSIONS.md`.
