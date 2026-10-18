---
accountCountSemantics: option-a
# option-a — count only the accounts that hold data. `formatAccountCount` and
# `formatCombinedCaption` count archive roots today, so a root whose folders
# are all unsupported renders as an ID-only "No activity recorded" row while the
# title and all six pane captions assert it. The user chose to publish only the
# roots that hold data, so the title, the list length, the Overview card and
# every caption become ONE number — the point of UI audit finding 1, which the
# phase's own verification could not score because the count was correct
# arithmetic over the wrong set. The accepted cost, named here so the next
# reader sees a decision rather than an oversight: a folder the user can plainly
# see in their own zip now contributes nothing and is named nowhere on the
# dashboard — the classifier's root list is not surfaced. D-17 is untouched: a
# root with sessions but no `User_Info` holds stored rows, keeps its ID-only row
# and stays counted.
phase: 09-multi-account-import-account-identity
plan: 10
subsystem: ui
tags: [multi-account, account-summary, dexie, count-semantics, projection]

# Dependency graph
requires:
  - phase: 09-multi-account-import-account-identity
    provides: "09-02's accountsOfMeta/toAccountSummary normalisers, 09-04's identity-model account rows, 09-09's single-boundary defaults"
provides:
  - "AccountMeta.hasData — one optional, non-indexed stored flag, read as absent-means-has-data, on `version(2)` with no upgrader change"
  - "accountSummariesOf — the ONE projection from stored records to published summaries, shared by the import and every replay"
  - "buildDataLessAccountExport / buildOneDataLessOfTwoExport — archives whose roots hold an entry and no data"
  - "A dated amendment to 09-VERIFICATION.md recording the decision against the finding it closes"
affects: [10-per-account, phase-10-verification, UI-SPEC-Copywriting-Contract]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
actuals:
  tokens: 24700
  tasks: 3
  commits: 5

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One projection serves every producer that crosses the same boundary (added to the existing `accountsOfMeta` → `toAccountSummary` pair, which now has three callers instead of two)"
    - "A stored flag that is OPTIONAL and read as absent-means-the-default, so no Dexie version is needed and an existing cache renders unchanged"
    - "A gate that must NOT read a derived projection is named at its call site with the reason, not left to be 'tidied'"

key-files:
  created: []
  modified:
    - src/lib/worker/account-summary.ts
    - src/lib/worker/db.ts
    - src/lib/worker/ingest.worker.ts
    - tests/fixtures/multi-account-fixtures.ts
    - tests/unit/import/account-summary.test.ts
    - tests/unit/import/multi-account-import.test.ts
    - .planning/phases/09-multi-account-import-account-identity/09-VERIFICATION.md

key-decisions:
  - "accountCountSemantics: option-a — the count counts the accounts that hold data, not the roots the archive holds (blocking-human checkpoint, 2026-10-18)"
  - "hasData is OPTIONAL and read as ABSENT-MEANS-DATA: a record written before the field existed belongs to a build that only stored roots worth listing, so every such record is published exactly as it always was"
  - "The STORE keeps every root and the PUBLISHED LIST is filtered — dropping a root at write time would make a two-root archive look like one account and reopen T-09-13"
  - "The filter is `hasData === false`, never an inference from a summary: a root with sessions and no User_Info has no games, no years and a null identity, and still holds data (D-17)"
  - "hasData is counted at the row choke point, so 'this root stored something' is a fact about rows that reached `allRows`, never about folders that merely existed"

patterns-established:
  - "A filter that belongs to the READER goes in the projection every reader already goes through; a filter that belongs to a GATE (a privacy rule keyed on the archive's shape) never does, and the gate's call site says so in a comment."
  - "A synthetic fixture that claims a shape must produce it: the data-less root opted out of the generator's shared files, because a fixture that cannot fail to hold data is not a fixture of a data-less root."

requirements-completed: [ACCOUNT-05, ACCOUNT-08]

coverage:
  - id: D1
    description: "The header's count, the list's length and every pane caption are ONE number on an archive containing a data-less root"
    requirement: ACCOUNT-05
    verification:
      - kind: unit
        ref: "tests/unit/import/multi-account-import.test.ts#The account count (09-10): only the accounts that hold data that hold data"
        status: pass
      - kind: unit
        ref: "tests/unit/import/account-summary.test.ts#accountSummariesOf — only the accounts that hold data are published"
        status: pass
    human_judgment: false
  - id: D2
    description: "done, duplicate and cache-status publish the SAME list through one projection"
    requirement: ACCOUNT-08
    verification:
      - kind: unit
        ref: "tests/unit/import/multi-account-import.test.ts#replays the identical list through duplicate and through cache-status"
        status: pass
    human_judgment: false
  - id: D3
    description: "A two-root archive whose published list is one account still publishes NO Account record"
    requirement: ACCOUNT-05
    verification:
      - kind: unit
        ref: "tests/unit/import/multi-account-import.test.ts#publishes NO account record for a two-root archive where one root holds data"
        status: pass
      - kind: unit
        ref: "tests/unit/import/multi-account-lifecycle.test.ts (unchanged, still green)"
        status: pass
    human_judgment: false
  - id: D4
    description: "A dataset whose roots all hold data, and a single-account v1.0 dataset, are completely unaffected"
    requirement: ACCOUNT-05
    verification:
      - kind: unit
        ref: "tests/unit/import/multi-account-import.test.ts#leaves a dataset whose roots all hold data completely unaffected"
        status: pass
      - kind: e2e
        ref: "playwright: tests/e2e/shell/multi-account.spec.ts (2 passed, unedited)"
        status: pass
    human_judgment: false
  - id: D5
    description: "A returning user's cache, whose records carry no flag, renders exactly as it did"
    requirement: ACCOUNT-08
    verification:
      - kind: unit
        ref: "tests/unit/import/account-summary.test.ts#treats an ABSENT flag as holds-data, so an existing cache renders as it always has"
        status: pass
      - kind: unit
        ref: "tests/unit/import/db.test.ts (db.verno stays 2, upgrader untouched)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Whether a data-less root should disappear from the dashboard or be labelled on it — a product call, resolved by the user rather than by the code"
    requirement: ACCOUNT-05
    verification: []
    human_judgment: true
    rationale: "The resolution is a judgement about what a user should see for a folder they can plainly see in their own zip. The automated suites prove the CHOSEN answer is implemented consistently (D1-D5); they cannot say whether silence is the right call, and the accepted cost — a folder named nowhere — is a UX cost only a human can weigh."

# Metrics
duration: 9 min
completed: 2026-10-18
status: complete
commits: 5
plan_head_before: eb8ad39e09a8e7c608989da5722fbc8936ebbd0c
plan_head_after: 68466b9e87624327b1a6c927ac97a17570e0da01
---

# Phase 9 Plan 10: Account count semantics (UI audit finding 1)

**The "N accounts" count now counts the accounts that hold data — one optional stored flag, one shared projection, and the Account record gate deliberately left reading roots.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-10-18T06:02:35Z
- **Completed:** 2026-10-18T06:11:32Z
- **Tasks:** 3 (1 decision checkpoint + 2 auto)
- **Files modified:** 7 (+ this summary)

## Decision Record (Task 1)

**`accountCountSemantics: option-a`** — the full rationale is the frontmatter comment; the reach is in `09-VERIFICATION.md`'s dated amendment.

- **Decision:** the multi-account header's "N accounts" title, the number of rows it lists, the Overview card headline and every pane's "N accounts combined" caption count only the roots that hold data.
- **Why:** the count described the ARCHIVE while the rows described the DATA, so one number meant three different things about one dataset. Option-a is the only option that makes them one number.
- **Rejected (option-b):** keep counting every root and add copy saying so. It costs a new `ui-copy.ts` constant, a `09-UI-SPEC.md` Copywriting Contract amendment and a moved `isMultiAccount` boundary, and it moves the disagreement rather than resolving it — a pane caption would still read "3 accounts combined" over a pane showing 2 accounts' rows.
- **Rejected (option-c):** record the wording gap and leave the audit's first finding open on purpose.
- **Accepted cost:** a folder the user can see in their zip now contributes nothing and is named nowhere on the dashboard.
- Recorded, and committed, before any source file changed.

## Accomplishments

- The published account list carries only the roots that hold data, through **one** projection (`accountSummariesOf`) that the import's `done` payload, `duplicate` and `cache-status` all go through — the three paths agree by construction rather than by three matching edits.
- `hasData` is optional and non-indexed, written in the same `meta.put` as the record it belongs to and read as **absent-means-has-data**: Dexie stays at `version(2)`, no upgrader moved, and a returning user's cache renders exactly as it always has.
- The **Account record gate is untouched and now says so at its call site**: `readLoginRowData` reads `accountsOfMeta`, not the projection, because the gate must count ROOTS. A two-root archive whose published list is one account still publishes no account record — T-09-13's defect does not return through this plan.
- A real fixture for the shape: `buildDataLessAccountExport` is three roots where the third holds an archive entry (two `known-deferred` folders, real CSVs, directory entries) and stores no row and no identity — so "data-less" is a fact about the archive, not a hand-built absence.
- The data-less shape is proven at the **worker boundary**, where the count is decided. The e2e budget is unmoved at 258 listed tests in 28 files.

## Task Commits

Each task was committed atomically:

1. **Task 1: What should the account count count?** — `85e7570` (docs) — the decision line and its reason, before any source change.
2. **Task 2 (RED): the count must describe the data, not the archive** — `13648bc` (test)
3. **Task 2 (fixture correction): the data-less root must really store nothing** — `817bc5f` (test)
4. **Task 2 (GREEN): one projection publishes the accounts that hold data** — `c09b5fb` (feat)
5. **Task 3: record the decision's reach** — `68466b9` (docs)

REFACTOR was executed and produced no change: after the projection landed there was no duplicated expression left to fold — `accountsOfMeta` still has a second, deliberately different caller in `db.ts`, which is the gate, and merging the two would have been the wrong refactor.

**Plan metadata:** the SUMMARY/STATE/ROADMAP commit.

## Files Created/Modified

- `src/lib/worker/account-summary.ts` — `accountSummariesOf`, the one projection from stored records to published summaries.
- `src/lib/worker/db.ts` — `AccountMeta.hasData` with its back-compat rule; a comment at the login reader naming why it does NOT read the projection.
- `src/lib/worker/ingest.worker.ts` — `RootState.storedRows` counted at the row choke point, the flag written with the record, and both `done` and `resultFromMeta` routed through the one projection.
- `tests/fixtures/multi-account-fixtures.ts` — `MA_ROOT_DATALESS`, `noSharedPlayerStats` opt-out, `buildDataLessAccountExport`, `buildOneDataLessOfTwoExport`.
- `tests/unit/import/account-summary.test.ts` — five projection cases, including absent-means-data and empty-list-falls-back.
- `tests/unit/import/multi-account-import.test.ts` — six worker-boundary cases: the published list, the count, the three replay paths, the stored-every-root property, the gate, and the unaffected controls.
- `.planning/phases/09-multi-account-import-account-identity/09-VERIFICATION.md` — a dated amendment; its findings are untouched.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The data-less root was not data-less until the fixture was corrected**
- **Found during:** Task 2, GREEN
- **Issue:** `rootEntries` writes the three shared `Player_statistics` files into EVERY root unconditionally, and `Player_statistics` is a `supported` category — so the "data-less" root received six stored rows and reported `hasData: true`. The fixture did not describe the shape it claimed to, and the GREEN run failed with "expected 2 to be 3".
- **Fix:** an explicit `noSharedPlayerStats` opt-out on `RootSpec`, in the EXISTING per-root generator rather than as a second file-writing path. The root is still a real entry: two `known-deferred` folders with real CSV bodies and directory entries.
- **Files modified:** `tests/fixtures/multi-account-fixtures.ts`
- **Verification:** a temporary dump of the stored rows confirmed the root stores zero rows and reads `hasData: false` while its two siblings store 189 and 43; the dump was deleted before the commit.
- **Committed in:** `817bc5f`
- **Note:** this is a defect in the test fixture, not in the product code, and it is recorded here rather than folded into the GREEN commit because it is the difference between a fixture that proves the shape and one that appears to.

### Deferred Items

- `.planning/deferred-items.md` — none added. No out-of-scope discovery was made.

## Issues Encountered

- The first version of the "unaffected shapes" test imported two archives in one test body and read the FIRST import's result for the second assertion (3 accounts where 1 was expected). The harness observes posted messages, and the two imports share one worker scope; splitting the assertion into its own test — which also gives it its own fresh database, which is what the claim needs anyway — resolved it. No product code was involved.
- The duplicate/cache-status case initially waited 10 s for a `cache-status` reply that no request would ever produce: `waitForMessage` observes, it does not ask. Posting an explicit `check-cache` request first, as the existing replay test does, fixed it.

## Verification

| Gate | Result |
|------|--------|
| `pnpm run check` | 313 files, 0 errors, 0 warnings |
| `pnpm run lint` | prettier + eslint clean |
| `pnpm run test:unit` | 96 files, 3135 tests passed |
| `pnpm exec playwright test tests/e2e/shell/multi-account.spec.ts` | 2 passed, spec unedited |
| `pnpm exec playwright test --list` | `Total: 258 tests in 28 files` — budget unmoved |
| `pnpm exec vitest run tests/unit/import/db.test.ts` | passed; `db.verno` still 2 |
| `git diff --exit-code -- package.json pnpm-lock.yaml src/lib/import` | exit 0 — no dependency added |
| Task 2 acceptance greps | both `accounts:` payloads call `accountSummariesOf` (ingest.worker.ts:730, :1277) |
| Task 1 acceptance | `grep -c "^accountCountSemantics: option-"` = 1 |

## Self-Check: PASSED

- Every file named in `key-files.modified` exists and carries the change described.
- All five plan commits are ancestors of HEAD (`85e7570`, `13648bc`, `817bc5f`, `c09b5fb`, `68466b9`).
- Every plan-level `<acceptance_criteria>` re-run: see the Verification table.
- No stub, no skipped test, no unrun `<verify>`: the deviation ledger entry was recorded and then closed as `fixed`, because the fixture correction is verified rather than deferred.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 10 inherits a published list that means "the accounts this dataset holds data for", so per-account slicing and the game filter start from a list whose length is the number the header already shows.
- The one open question this decision deliberately leaves: whether the classifier's root list should ever be surfaced, so a data-less folder is named rather than silently absent. Not required by Phase 10; recorded here so it is a choice rather than an oversight.
- CR-01 (`readRowsByFile` merging accounts of one file) is untouched by this plan and remains open from the phase verification.

---
*Phase: 09-multi-account-import-account-identity*
*Completed: 2026-10-18*