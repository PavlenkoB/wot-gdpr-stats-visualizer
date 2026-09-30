---
phase: 04-activity-time-dashboards
fixed_at: 2026-09-30T09:47:43Z
review_path: .planning/phases/04-activity-time-dashboards/04-REVIEW.md
iteration: 1
fix_scope: critical_warning
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
commits:
  - 2bf9d03
  - be213d2
  - 707341d
---

# Phase 04: Code Review Fix Report

**Fixed at:** 2026-09-30T09:47:43Z
**Source review:** `.planning/phases/04-activity-time-dashboards/04-REVIEW.md`
**Iteration:** 1

**Summary:**

- Findings in scope: 2 (WR-1, WR-2) — 0 Critical, 0 Blockers
- Fixed: 2
- Skipped: 0
- Left alone deliberately: 5 Info findings (IN-1..IN-5), out of `critical_warning` scope

## Fixed Issues

### WR-1: a failed selection query leaves the PREVIOUS selection's announcement visible

**Files modified:** `src/lib/components/Playtime.svelte`
**Commit:** `be213d2` (test first: `2bf9d03`)

**Applied fix:** `load()` now writes `announcement` on an applied answer **or clears
it**, instead of writing only on the ready-view path. The review's snippet applied
as written, adapted only in that the component's own names are `wanted` / `ask` /
`accepted` (the review's sketch used the same names). The `else` branch is the whole
fix: `announcement` is component state, `statusLine` returns it for every state that
is not `loading` or `updating`, and the dataset-change effect is the only other thing
that cleared it — so a failed query had nothing to clear it.

`STATE.md`'s two relevant rules are not weakened. T-04-24 ("a stale answer is never
shown") is what the fix enforces. D-21 (the worker's error `detail` stays out of the
DOM) is untouched: `acceptOutcome` still discards `detail`, and the only string the
fix adds is `''`.

### WR-2: a dropped outcome strands the block in `updating` forever

**Files modified:** `src/lib/components/Playtime.svelte`
**Commit:** `707341d` (test first: `2bf9d03`)

**Applied fix:** the `accepted === null` branch now hands an abandoned ask back to
`shown` before returning, so `awaiting` clears and the block settles on `ready` with
the slice it actually has. Both of the review's gates are preserved exactly:

- `outcome.kind !== 'superseded'` — a supersede means a newer request is already in
  flight, and rolling `requested` back under it would strand that one instead;
- `requested?.valueIndex === ask.valueIndex` — if `requested` is not this ask,
  something newer owns it, and this code would be overwriting a live request.

`wanted === importedAt` is kept as the third conjunct: it is the review's condition
for "the dataset on screen is still the one the ask was for", and `acceptOutcome`
has already checked the equivalent for `currentImportedAt`, so this is a restatement
rather than a new rule.

## Tests

Both fixes live in the block's `load`, which Vitest cannot reach (no Svelte plugin
in `vitest.config.ts`). Each finding therefore has one **real-Chromium** test that
drives the actual seam, plus one **source contract** in
`tests/unit/playtime-charts.test.ts`, which is labelled as such in its own header.
Nothing was written that passes against the unfixed code; both e2e tests were run
against the unfixed block first and failed for the finding's own reason.

| Finding | Test | Genuinely RED before the fix? |
| --- | --- | --- |
| WR-1 | `tests/e2e/playtime.spec.ts:122` — "WR-1: a failed selection query clears the previous slice announcement" | Yes. `playtime-status` read `Showing eu-1: 3.5 hours, 4 sessions, 3 active days.` while `data-state` was `error` — the review's finding, reproduced verbatim. |
| WR-1 | `tests/unit/playtime-charts.test.ts` — "the announcement is written on the answer applied, and cleared on every other one" | Yes (regex on source; the `else` branch did not exist). |
| WR-2 | `tests/e2e/playtime.spec.ts:151` — "WR-2: a dropped selection query settles on ready, not on updating forever" | Yes. 61 polls of `data-state` reading `updating` with no recovery. |
| WR-2 | `tests/unit/playtime-charts.test.ts` — "a dropped answer reconciles the request, unless the ask itself is stale" | Yes (regex on source; the `accepted === null` branch did not exist). |

The two seams, both in `tests/e2e/helpers.ts`, are the review's own reachability
arguments rather than assertions about source text:

- `failPlaytimeQueryFor(page, valueIndex)` makes one split index's
  `Worker.prototype.postMessage` throw. A structured-clone failure is a real thing a
  post can do, and `PlaytimeClient.query` already wraps its post in `try`/`catch` and
  turns a throw into `{ kind: 'error' }` (04-07, D-21) — so the component takes its
  real error path.
- `clearCachedDatasetFromSecondTab(context)` deletes the origin's cached dataset from
  a second page while the first keeps its in-memory result (D-27). Dexie closes its
  connection on `versionchange` with `disableAutoOpen: false`, so the worker's next
  read reopens an empty store and answers `importedAt: null, view: null` — one of the
  two non-fatal ways `acceptOutcome` drops an answer, with no worker bug involved.

## Verification

All four gates ran in the **main checkout** on `gsd/phase-04-activity-time-dashboards`,
after the fixes, unit and e2e suites run one at a time.

| Gate | Result |
| --- | --- |
| `pnpm run build` | built in 169 ms |
| `pnpm run check` | **0 errors, 0 warnings** (svelte-check) |
| `pnpm run test:unit` | **791 passed, 26 files** (baseline 789 / 26; +2 new contracts) |
| `pnpm exec playwright test` | **111 passed, 10 files, 40.6 s** (baseline 109 / 10; +2 new browser tests) |
| `pnpm exec eslint src tests playwright.config.ts vitest.config.ts` | exit 0 |

One `pnpm run test:unit` invocation reported `Errors 1 error` with 790/791 and 25/26
files; the three runs after it were all 791/791 in 26/26. That is the vitest worker
fork being killed, the same failure mode the phase already records, and it did not
reproduce. The e2e suite ran in a separate invocation and did not overlap it.

`pnpm run lint` was not run: it is the known-broken repo-wide invocation (153
`No tsconfigRootDir` errors from the untracked `.kilo/worktrees/flashy-bit/`
checkout). The repo-scoped invocation above is the meaningful one and exits 0. No
`.gitignore` entry was added and nothing was changed to work around it.

### Not reproducible from this tree: the e2e port

A developer `pnpm run preview` in a VS Code terminal (PID 53815) was already holding
`4173`, and `playwright.config.ts` sets `reuseExistingServer: false` on purpose — it
must not, because that server serves a **stale** build and these tests are about
source that had just changed. The suite was therefore run on `4174` through a scratch
copy of the config, `playwright.scratch.config.ts`, with the same `vite build` in
front of it. **That file is untracked and must be deleted**; the local permission
gate refused every removal of it (`rm`, and `mv` out of the root), so it could not be
cleaned up here. Nothing was committed with it.

## Left alone deliberately

- **IN-1..IN-5** — out of `fix_scope: critical_warning`. Their files
  (`playtime-shared.ts`, `worker/playtime.ts`, `playtime-model.ts`,
  `CalendarHeatmap.svelte`) were not opened or edited. IN-4 in particular proposes a
  refactor with real behavioural risk, which is not a fixer pass's business.
- **`HOUR_GRID_BASIS` is `'overlap'`** — a deferred decision; both bases are stored.
- **The measured year-head height** — no behavioural browser proof by design; correct
  by construction and unit-tested.
- **The Sessions column names and timestamp shape** — fixture-derived assumptions,
  real-export check deferred.
- **`tests/e2e/import-flow.spec.ts:102`** — pre-existing flake, out of scope. It did
  not fire in this run.

## Needs a human

- **`playwright.scratch.config.ts` must be deleted** from the repo root (see above).
- The fix report itself is intentionally **not committed**; the orchestrator does that.
- The review's own next step — a real WoT export to check the Sessions column names —
  is still open and unaffected by this pass.

---

_Fixed: 2026-09-30T09:47:43Z_
_Fixer: gsd-code-fixer (iteration 1)_
