---
phase: 09-multi-account-import-account-identity
plan: 09
subsystem: worker/testing
tags: [dexie, replay, normaliser, projection, playwright, ci-budget]

requires:
  - phase: 09-multi-account-import-account-identity
    provides: "09-02's account-aware import and `accountsOfMeta`, 09-03's readers, 09-06's CI budget raise (G = 1800 s / W = 1920 s / J = 2400 s)"
provides:
  - "One normaliser answers 'how many accounts does this dataset hold' on the login rebuild as well as on every replay"
  - "A total `toAccountSummary`, so a partially written stored account record builds a row instead of blanking the dashboard"
  - "A cast-free `resolveCsvFileOwner` and a MAX_ACCOUNT_ROOTS cost note that describes the code as written"
  - "The CI wrapper comment corrected to the configured globalTimeout, plus a guard that reads it RAW and fails on drift"
affects: [phase-10, phase-09-plan-10, ci-budget, identity-header]

actuals:
  tokens: 4986 # 19944 chars / 4 over the realized diff (7 files)
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - "One normaliser per question (D-08): a reader asks `accountsOfMeta`, never `meta.accounts`"
    - "Tolerance lives at the projection boundary, not in each reader and not in the stored type"
    - "A guard that asserts on PROSE reads the file RAW — the filtered reader discards the text under assertion"

key-files:
  created: []
  modified:
    - src/lib/worker/db.ts
    - src/lib/worker/account-summary.ts
    - src/lib/worker/classify.ts
    - .github/workflows/ci.yml
    - tests/unit/guards/ci-budget.test.ts
    - tests/unit/import/account-summary.test.ts
    - tests/unit/import/multi-account-lifecycle.test.ts

key-decisions:
  - "The login rebuild's account count comes from `accountsOfMeta(meta)`, so an EMPTY and an ABSENT `accounts` list both mean one account — the reader's own doc comment now records that the count is not a local decision"
  - "`toAccountSummary` is the only place that completes a stored record; `AccountMeta` itself is NOT weakened, because the current writer always writes these fields"
  - "A missing activity year defaults to `null` (D-15's honest value) rather than staying absent — see the Rule 2 deviation below"
  - "The CI comment's present-tense sentence is corrected in place; every dated 'Raised from …' paragraph is byte-identical and this plan's entry is APPENDED"

requirements-completed: [ACCOUNT-02, ACCOUNT-03]

coverage:
  - id: D1
    description: "The login rebuild and the replayed result answer 'how many accounts' with one normaliser, on an empty, an absent and a populated accounts list"
    requirement: ACCOUNT-02
    verification:
      - kind: unit
        ref: "tests/unit/import/multi-account-lifecycle.test.ts#answers \"how many accounts\" with the ONE normaliser, on an EMPTY list (WR-01)"
        status: pass
      - kind: unit
        ref: "tests/unit/import/multi-account-lifecycle.test.ts#keeps the pool EMPTY for two accounts and present for a v1.0 cache, through the same normaliser"
        status: pass
    human_judgment: false
  - id: D2
    description: "A stored account record missing its games list, identity or years projects to a complete summary and builds the id-only row instead of blanking the dashboard"
    requirement: ACCOUNT-02
    verification:
      - kind: unit
        ref: "tests/unit/import/account-summary.test.ts#projects a PARTIALLY written record to an empty games list and a null identity"
        status: pass
      - kind: unit
        ref: "tests/unit/import/account-summary.test.ts#builds the id-only row from a partially written record instead of throwing"
        status: pass
      - kind: unit
        ref: "tests/unit/import/account-summary.test.ts#projects a COMPLETE record field for field, unchanged"
        status: pass
    human_judgment: false
  - id: D3
    description: "The classifier holds its own no-cast rule and its MAX_ACCOUNT_ROOTS cost note describes the per-root work and the constants that bound it"
    requirement: ACCOUNT-02
    verification:
      - kind: other
        ref: "grep -v '^[[:space:]]*\\*' src/lib/worker/classify.ts | grep -c 'as string'  # 1, the pre-existing empty-array annotation at classify.ts:429, reported below"
        status: pass
      - kind: unit
        ref: "tests/unit/import/classify.test.ts (121 passed with the guard, unchanged)"
        status: pass
      - kind: other
        ref: "pnpm run check — 0 errors at the line the cast was removed from"
        status: pass
    human_judgment: true
    rationale: "Whether a cost NOTE is an honest description of the code is a judgement no test can make; the acceptance gate here is that no cast on the root name survives, and the remaining single `as string` is an empty-array element-type annotation on a literal, not a narrowing escape."
  - id: D4
    description: "The CI wrapper comment names the globalTimeout the workflow is configured with, and a guard that reads the prose RAW fails if the two ever drift again"
    requirement: ACCOUNT-03
    verification:
      - kind: unit
        ref: "tests/unit/guards/ci-budget.test.ts#the CI comment names the SAME globalTimeout the workflow is configured with"
        status: pass
      - kind: other
        ref: "git diff .github/workflows/ci.yml — only the present-tense sentence changed; every dated 'Raised from …' paragraph is byte-identical"
        status: pass
    human_judgment: false

duration: 22min
completed: 2026-10-18
status: complete
commits: 6
plan_head_before: ceec36074e096d59892a858fac470edf69d2d617
plan_head_after: 49c3647d5a72c9807b4b14a7a189b74009bfe421
---

# Phase 09 Plan 09: Worker-side review findings Summary

**The login rebuild asks the one account normaliser instead of re-deciding for itself, the stored-record projection is total, the classifier carries no cast, and the CI comment can no longer drift from the timeout it explains.**

## Performance

- **Duration:** 22 min of active execution (a 429 rate-limit interruption sat between Task 3's commit and this summary; no work was redone)
- **Started:** 2026-10-18T00:52Z
- **Completed:** 2026-10-18T09:58Z
- **Tasks:** 3
- **Files modified:** 7 (+19 / −242 lines)

## Accomplishments

- **WR-01 closed.** `readLoginRowData` counted `meta.accounts` itself, so a stored meta carrying an EMPTY list reported zero accounts and published no Account record, while `accountsOfMeta` — and therefore every replay — reported one. Both the count and the single root now come from the one normaliser. The case seeds that shape through `writeDataset`, the import's own write path, and asserts both sides answer one.
- **IN-01 closed.** A stored account record with no `games` and no `identity` used to reach `accountRows` and throw on `.length` / `.nickname` — a blank dashboard. `toAccountSummary` is now total at the one boundary every replay crosses, and the case builds the id-only ROW rather than asserting the throw is gone.
- **WR-03 / WR-02 closed.** `resolveCsvFileOwner`'s final step narrows on its own (every arm that leaves the root unset returns first), so the cast came out with no restructure; the `MAX_ACCOUNT_ROOTS` note now describes one root scan followed by per-root `foldersAt` work — each of which re-runs `prepare()` over the whole entry list — rather than claiming a linear pass.
- **IN-04 closed.** The wrapper comment named 27 min / 29 min / 234 tests while the workflow has been configured for 30 / 32 / 40 since 09-06. The present-tense sentence is corrected; every dated paragraph is byte-identical and this plan's entry is appended; a new guard reads the file RAW and fails on drift.

## Task Commits

Each task was committed atomically, RED first:

1. **Task 1: one normaliser decides how many accounts a dataset holds** — `461c840` (test), `78fa736` (fix)
2. **Task 2: a partially written account record cannot blank the dashboard** — `7041275` (test), `77ff8e9` (fix)
3. **Task 3: cast-free classifier, honest cost note, CI comment that matches its workflow** — `fc63ccf` (test), `49c3647` (fix)

### RED evidence (recorded, not reconstructed)

- **Task 1** — `1 failed | 37 passed`, on the target case only: `AssertionError: expected 0 to be greater than 0` at `rebuilt?.accountPool.length`. The cached-result side of the SAME case already passed with one account, which is precisely the disagreement being closed.
- **Task 2** — two failures on the new cases: `expect(Array.isArray(summary.games)).toBe(true)` received `false`, and `accountRows` threw `TypeError: Cannot read properties of undefined (reading 'nickname')` at `identity-model.ts:112`.
- **Task 3** — `AssertionError: The comment says Playwright's own globalTimeout is 27 min, but playwright.config.ts sets 1800 s: expected 1620 to be 1800`.

## Files Created/Modified

- `src/lib/worker/db.ts` — `readLoginRowData` asks `accountsOfMeta` for the account count and the single root; its doc comment gains a section recording that the count is no longer a local decision. No Dexie change: still `version(2)`, no store or upgrader touched.
- `src/lib/worker/account-summary.ts` — `toAccountSummary` defaults an absent games list to a new empty array, an absent identity to `null` and an absent year to `null`, with the "why the boundary and not the reader" rationale in its doc comment.
- `src/lib/worker/classify.ts` — the cast is gone from `resolveCsvFileOwner`; the `MAX_ACCOUNT_ROOTS` note now states the pass-times-survivors product and names the two constants that bound it.
- `.github/workflows/ci.yml` — present-tense sentence corrected to 30 min / 32 min / 258 tests in 28 files; one appended log paragraph for 09-09. No limit moved.
- `tests/unit/guards/ci-budget.test.ts` — the raw-read prose guard.
- `tests/unit/import/account-summary.test.ts` — three projection cases, one of which builds a row through `accountRows`.
- `tests/unit/import/multi-account-lifecycle.test.ts` — the empty-list disagreement case plus its two controls.

## Decisions Made

- **Both sides of the account count, not just the count.** `onlyRoot` now comes from the normalised list too. Reading only `accounts.length` would have left the root itself still decided from `meta.accounts`, which is the same class of bug the plan exists to close. The `?? meta.accountRoot` fallback stays as a guard against a normaliser that ever returns nothing.
- **No restructure for the cast.** The plan allowed restructuring the last step of `resolveCsvFileOwner` if the narrowing failed. It did not — TypeScript's control-flow analysis already narrows `root` at the join point — so the cast was simply deleted. No non-null assertion was used either.
- **The guard reads the workflow twice, on purpose.** The configured limits keep `activeWorkflowLines()` (which drops every `#` line); the prose assertion gets its own plain `readFileSync`. Reusing the filtered reader for the prose would not be an optimisation, it would be a tautology that filters out the entire text being asserted on.
- **Dexie stayed at `version(2)`.** Every change here is a read-time default or a read-time normaliser; nothing needed a store, an index or an upgrader, so a returning user's cache keeps replaying.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 — Missing Critical Functionality] A missing activity year rendered as the string "undefined"**
- **Found during:** Task 2 (partially written record), after the games and identity defaults were in place
- **Issue:** the plan named games and identity for the boundary defaults. With those two defaulted, the row case STILL failed: `accountRows` narrows on `years === null`, so an absent `firstYear` sailed past it into `formatActivityYears(undefined, undefined)` and the identity row rendered the literal string `"undefined"` as its activity line. That is a user-visible defect of the same class as the throw, one layer down.
- **Fix:** `firstYear` / `lastYear` default to `null` at the same projection boundary — D-15's own honest "no activity recorded" value, which is exactly what `accountRows` expects.
- **Files modified:** `src/lib/worker/account-summary.ts`, `tests/unit/import/account-summary.test.ts`
- **Verification:** the row case asserts `activity === IDENTITY_NO_ACTIVITY` and both years `null`; `pnpm run check` clean.
- **Committed in:** `77ff8e9`

---

**Total deviations:** 1 auto-fixed (1 Rule 2 — missing critical)
**Impact on plan:** One extra boundary default inside the module the plan already opened, discovered by the plan's own RED. No scope creep, no new surface, no stored-type change.

## The two `as string` hits the acceptance gate reports

`grep -v '^[[:space:]]*\*' src/lib/worker/classify.ts | grep -c "as string"` prints **1**, not 0. The remaining hit is `src/lib/worker/classify.ts:429`, `games: [] as string[]` — a pre-existing element-type annotation on an empty array LITERAL, which TypeScript cannot infer. It is not on the root name, not a narrowing escape, and untouched by this plan. Reported here because the criterion asks for it. The cast on the resolved root that the criterion targets is gone.

## Verification

All run on the committed tree after the final task commit:

| Gate | Result |
|---|---|
| `pnpm run check` | 313 files, **0 errors, 0 warnings** |
| `pnpm run lint` | Prettier + ESLint **clean** |
| `pnpm run test:unit` | **96 files, 3124 tests, all passed** |
| `pnpm exec playwright test --list` | **258 tests in 28 files** (unchanged) |
| `pnpm exec vitest run tests/unit/guards/ci-budget.test.ts` | **8 passed**, including the new guard |
| `pnpm exec vitest run tests/unit/import/db.test.ts` | passed — `version(2)` still pinned |
| `git diff --exit-code -- package.json pnpm-lock.yaml` | exit 0 — no dependency touched |

The listed-test count stayed at exactly 258 in 28 files against the guard's 262 ceiling, which is what the three e2e limits in `ci.yml` are priced for.

## Issues Encountered

- Prettier rejected the new guard test on its first write (`pnpm run lint` failed on formatting only); `prettier --write` on that one file fixed it and lint then passed. No behavioural change.
- A 429 rate-limit termination landed after Task 3's commits and before this SUMMARY. The work was already on disk and was NOT redone — the final gate was re-run on the committed tree and is what the table above reports.

## Self-Check: PASSED

- All seven files named in `key-files.modified` exist on disk.
- All six task commits (`461c840`, `78fa736`, `7041275`, `77ff8e9`, `fc63ccf`, `49c3647`) are ancestors of HEAD.
- Every task's `<acceptance_criteria>` and the plan-level `<verification>` were re-run on the committed tree; the table above is the result of those runs, not of an assumption.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- The four findings 09-09 was scoped to close (WR-01, WR-02, WR-03, IN-01, IN-04) are closed and, in each case, by a rule or an assertion rather than by a special case.
- **IN-03 and IN-05 remain open by decision, not oversight** — `recomputeStatusCounts` vs `statusCountsOf` are two tallies, and `accounts?` reachability is documented in three places. The plan deliberately deferred both: this plan's edits touch neither function, and consolidating them would enlarge the diff for no behavioural gain. Recorded in the plan's Deferred Ideas for a future phase that edits those lines.
- Plan 09-10 is the only plan left in the phase.

---
*Phase: 09-multi-account-import-account-identity*
*Completed: 2026-10-18*