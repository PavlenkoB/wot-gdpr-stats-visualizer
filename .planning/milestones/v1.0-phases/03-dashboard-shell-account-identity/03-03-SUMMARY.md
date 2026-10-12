---
phase: 03-dashboard-shell-account-identity
plan: 03
status: complete
wave: 1
requirements: [IDENTITY-01]
---

# Plan 03-03 — the client keeps its dataset, and confirms every drop that could destroy it

## What was built

Two changes to `src/lib/worker-client.svelte.ts`, both locked by tests written
RED first.

**`result` now means "the last known cached dataset"** (D-27), not "the outcome
of the job in flight". Three assignments that nulled it — the replace branch of
`confirmPending()`, the point in `submitFiles()` where processing begins, and
`#fail()` — are gone. `reset()`, the `cleared` handler and a `cache-status` with
`cached: null` still clear it, and those are the only moments the dataset really
is gone.

This is the entire fix for the failed-replace row of the approved UI-SPEC state
matrix. No cache re-check is needed: the worker's `writeDataset` is a single
atomic Dexie transaction (RESEARCH Q2 probed both a mid-`bulkPut` DataCloneError
and a throw before `meta.put` — old rows and meta came back byte-for-byte
intact). The client was discarding a displayed copy of data that was still in
IndexedDB.

**The replace guard is keyed on `result !== null`**, not on `state === 'done'`.
Once `result` outlives a job, a dataset is displayed in `duplicate` and `error`
too — and in both the old guard fell through to `postMessage`, so a drop
overwrote the cached dataset with no confirmation, contradicting Phase 2 D-13.
This was the tampering threat the plan filed as T-03-10.

Three gaps fixed alongside it:

- **Drops while a confirm is open are ignored.** Previously they moved the
  machine to `processing` and left a stale `pendingAction` on the client. No
  state is touched at all, not even `justCleared` — a drop the user cannot act
  on must not dismiss a banner.
- **The pre-check now runs before the replace guard.** With the guard widened, a
  `notes.txt` dropped on a displayed dataset would have opened a replace prompt
  for a file that can never be ingested; the user would confirm their way to the
  same failure. It now fails with the notice, dashboard intact.
- **Two failure paths could strand the UI.** A worker error during the on-load
  cache check was swallowed by the `state !== 'processing'` guard, leaving the
  page on the spinner forever — and D-19's v2 upgrade gives that first read a new
  way to fail. It now lands on `idle` with the cause in `console.error`,
  deliberately *not* on the generic banner, whose copy claims the file is not a
  Wargaming export. A worker error answering a confirmed clear left the confirm
  panel open with no way out; it now closes and lands on the ordinary error notice
  over the dataset, which is intact because the clear is one atomic transaction.

Finally, cancelling a confirm that began from `duplicate` or `error` returns to
`done` with the notice cleared. Those are notices drawn *over* a dataset, and
restoring them would resurface the banner the user had just dismissed (D-06).

## Files changed

| File | Change |
|------|--------|
| `src/lib/worker-client.svelte.ts` | `result` re-typed as the last known cached dataset (three assignments removed); `submitFiles()` guard reordered to busy → confirm-pending ignore → pre-check → replace guard on `result !== null` → worker fail-fast; `#handle` `error` branch gains cache-check and failed-clear recovery; `cancelPending()` return-state rule; doc comments on the `result` field, class item 6, `submitFiles()` and `cancelPending()` |
| `tests/unit/ingest-client.test.ts` | +16 tests in five new describe blocks; 55 pre-existing tests unedited |

No new files, no new exports, no component changes — 03-04 and 03-06 consume the
new semantics. `package.json` and `pnpm-lock.yaml` untouched (T-03-SC).

## Tests

16 new tests, one per plan behavior bullet.

**Task 1 — displayed dataset (4 tests).** A confirmed replace reaches
`processing` with the old result intact; a worker error mid-replace lands on
`error` with the old result intact; a successful replace swaps the result; a
first import with no cache keeps `result` null throughout.

**Task 2 — guard and recovery (12 tests).** Drop in `duplicate` and in
`error`-with-a-result both go to `confirm-pending` with a `replace`
`pendingAction` and nothing posted; a drop in `error` with *no* result still
posts (nothing to protect); a drop during `confirm-pending` is ignored with the
stashed file intact; `notes.txt` and two-file drops fail without opening a
confirm; a cache-check error lands on `idle` with the cause logged and no banner;
a stale cache-check jobId stays ignored; a clear error closes the confirm and
keeps the dataset; cancel from `duplicate`, from `error`, and from `done` all
return to `done`.

### RED → GREEN evidence

| Commit | State |
|--------|-------|
| `af4c2d1` | RED — 2 fail on `expected null to deeply equal { accountRoot: 'stale', … }` |
| `cf206f8` | GREEN — 59/59 |
| `a865812` | RED — 9 fail, each on a state/postMessage assertion |
| `32c593a` | GREEN — 71/71 |

The nine Task 2 failures read: three `expected true to be false` (a drop that
posted when it must not), two `confirm-pending to be error` (pre-check ran after
the guard), one `checking-cache to be idle`, one `confirm-pending to be error`
(clear error), two `processing to be done` (cancel resurfacing the notice). Three
companion regression tests passed at RED by design — the plan asks for them by
name as behaviour that must keep working.

## Verification

| Command | Result |
|---------|--------|
| `pnpm exec vitest run tests/unit/ingest-client.test.ts` | 71 passed (55 pre-existing, unedited) |
| `pnpm run lint` | exit 0 — prettier clean, eslint clean |
| `pnpm run check` | exit 0 — svelte-check 0 errors / 0 warnings, app and test tsconfigs |
| `pnpm run test:unit` | 325 passed across 14 files |
| `git diff --quiet 9558a26 -- package.json pnpm-lock.yaml` | exit 0 |
| `git status --porcelain -- src tests` | only the two declared files |

The full gate was run rather than the per-task subset, after a prior executor in
this phase shipped a type error that only `pnpm run check` caught.

## Deviations

- **The broken-worker fail-fast stays after the replace guard**, per the plan's
  prescribed guard order. The two are effectively unreachable together
  (`#workerBroken` is only set when the worker dies before `ready`, and a
  displayed `result` requires a worker that already answered), so the ordering
  carries no practical risk. Flagged for the plan-checker rather than silently
  reordered.
- **The failed-clear branch is additionally scoped to the two clear kinds**
  (`pendingAction?.kind !== 'replace'`), which the plan's behavior bullets
  describe ("`pendingAction` is a clear kind"). Without the kind check, a late
  error for the *previous* job would match the `#jobId` of a replace confirm
  that has not been posted yet and would falsely close a live confirm.
- **Three of the twelve Task 2 tests were green at RED.** They are the
  regression guards the plan names explicitly ("drop in error with NO result
  still posts", "an error with a stale job id is ignored", "cancel from done still
  returns done"), so they were added to lock behaviour rather than to drive it.
  They are counted here for honesty, not presented as RED evidence.

## Notes for the next plans

- `App.svelte` now derives the view from exactly two fields: the
  dashboard-versus-skeleton choice is `result !== null`, and the notice is a
  function of `state`. No new field was added.
- The per-row guards are now: busy (`processing`), a dataset displayed
  (`result !== null` → confirm), broken worker. A drop is refused or confirmed —
  never posted silently.
- **03-02's carry-forward item is not this plan's scope**: the rootless-account
  copy decision flagged in 03-01 is already resolved — `IDENTITY_UNKNOWN_ACCOUNT_TITLE`
  exists in `src/lib/ui-copy.ts:425`. The open item for 03-05 remains that
  `app.css` must actually declare `--nav-offset` before the nav is wired.
- Scroll-spy band semantics stay Chromium-verified only.
- No derived-state or effect runes were added to the `.svelte.ts` file; the unit
  shim only defines `$state` (tests/unit/setup.ts).

## Carried into verification

- Does the UI-SPEC state matrix now have a reachable row for every state? Every
  client-side transition is unit-tested, but no e2e spec exercises the matrix
  end to end — `tests/e2e/dashboard.spec.ts -g states` is a Wave 3 gap.
- RESEARCH A5 (browsers abort rather than partially commit on quota errors) is
  the load-bearing assumption behind "no cache re-check is needed". It was
  probed with fake-indexeddb throws, not real quota exhaustion, and
  Safari/Firefox remain untested.
