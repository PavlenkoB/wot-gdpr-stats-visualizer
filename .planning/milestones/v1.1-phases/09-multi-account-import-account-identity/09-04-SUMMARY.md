---
phase: 09-multi-account-import-account-identity
plan: 04
subsystem: ui
tags: [multi-account, identity-header, svelte-5, runes, ui-copy, privacy, accessibility]

requires:
  - phase: 09-01
    provides: "buildRealShapeThreeAccountExport and the per-root canaries, games and year answer keys (MA_EXPECTED_GAMES, MA_EXPECTED_YEARS)"
  - phase: 09-02
    provides: "ClassifyResult.accounts and AccountSummary, stored in D-16 order by the worker"
provides:
  - "src/lib/ui-copy.ts — IDENTITY_MULTI_LIST_LABEL, IDENTITY_GAMES_LABEL, IDENTITY_ACTIVITY_LABEL, IDENTITY_NO_ACTIVITY, ACCOUNT_ROW_MULTI_SUMMARY and the six formatters formatAccountCount, formatCombinedCaption, formatActivityYears, formatEarliestCreated, formatGameLongName, formatAccountGames"
  - "src/lib/shell/identity-model.ts — accountCountOf, isMultiAccount, accountRows, earliestCreated, as pure functions with no DOM, no runes and no Date"
  - "IdentityHeader variant `multi` with the seven identity-multi-* test ids; one account keeps the v1.0 DOM byte-identically"
  - "One phone rule for .multi-title inside the existing 480px block in src/app.css"
  - "tests/e2e/shell/multi-account.spec.ts — the first of the phase's two allowed e2e tests, extended in place by 09-05 and 09-06"
  - "tests/unit/shell/identity-model.test.ts (42 tests) and 14 new ui-copy assertions"
affects: [09-05, 09-06, 10]

actuals:
  tokens: 356
  tasks: 2
  commits: 2
plan_head_before: f112b210e12ae6a663620db51583e6021204ffbb
plan_head_after: 74ad169cfe42df7f338c76d2e7bcf388ddfefc1b

tech-stack:
  added: []
  patterns:
    - "Every rule about what a row shows lives in a pure `identity-model.ts`, because vitest.config.ts runs in Node with no Svelte plugin and a component cannot be rendered in a unit test at all"
    - "`accountRows` takes the account list and nothing else, so a row cannot read the legacy first-account identity (T-09-20 is structural, not a rule someone must remember)"
    - "The `{#each}` is keyed by INDEX: two accounts may share a nickname and a first year, so any value-derived key could repeat"
    - "Dates are compared as normalised integers with `daysInMonth`; nothing constructs a `Date`, so no timezone can shift a day"

key-files:
  created:
    - src/lib/shell/identity-model.ts
    - tests/unit/shell/multi-account.spec.ts
    - tests/unit/shell/identity-model.test.ts
  modified:
    - src/lib/ui-copy.ts
    - src/lib/shell/IdentityHeader.svelte
    - src/app.css
    - tests/unit/shell/ui-copy.test.ts

key-decisions:
  - "The `multi` variant is derived BEFORE the legacy identity, so the first account's identity can never decide the whole dataset's rendering (T-09-20)"
  - "The header never re-sorts: the worker's `sortAccounts` is the only D-16 comparator, and `accountRows` is a projection in the order given"
  - "A long game-name table sits beside GAME_NAMES rather than replacing it: the existing panes read short labels in a column headed `Game`, where a long name would wrap"
  - "WOWP is in the long table although D-14 lists five names, so a Warplanes session shows a name rather than a raw token (the UI-SPEC's recorded choice, carried out as written)"
  - "`earliestCreated` returns the winning date AS THE EXPORT WROTE IT and compares normalised integers, so the card can normalise nothing it displays and still pick the right minimum across ISO and dotted shapes"

patterns-established:
  - "Namespace-import a not-yet-existing ui-copy export in a RED test: a named import of a missing export is a link error that reports `No tests found`, which is a broken RED rather than a behavioural one"
  - "Assert a nickname's `outerHTML` occurrence COUNT rather than an aria `not.toContain`: a row's text IS its accessible name by design, so the negative assertion fails on correct code"

requirements-completed: [ACCOUNT-05]

coverage:
  - id: D1
    description: "A three-account import lists three rows in D-16 activity order, with the ID-only row for the account that has no User_Info"
    requirement: ACCOUNT-05
    verification:
      - kind: e2e
        ref: "tests/e2e/shell/multi-account.spec.ts#(a) a three-account dataset lists its accounts in activity order, leaks nothing and survives a reload"
        status: pass
    human_judgment: false
  - id: D2
    description: "One account keeps the v1.0 DOM and its four test ids, and the untouched identity-privacy specs pass"
    requirement: ACCOUNT-05
    verification:
      - kind: e2e
        ref: "tests/e2e/shell/identity-privacy.spec.ts#(a), (b) and the three (c) variants — unedited, `git diff --quiet b4e7f31` on that file exits 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "No root's login domain, birth date, overflow cell and no deferred-category canary reaches the rendered text, the markup, the accessibility tree, the console of page or worker, or IndexedDB — fresh and after a reload"
    requirement: ACCOUNT-05
    verification:
      - kind: e2e
        ref: "tests/e2e/shell/multi-account.spec.ts#expectNoLeak — 12 needles across 5 surfaces, plus the `\"IP\"` at-rest control"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every new string and formatter, the view model's empty / partial / hostile shapes, and the header's source contract are pinned without a browser"
    requirement: ACCOUNT-05
    verification:
      - kind: unit
        ref: "tests/unit/shell/identity-model.test.ts (42 tests) and the `Phase 9: the multi-account identity header copy` describe (14 tests)"
        status: pass
    human_judgment: false
  - id: D5
    description: "One phone block, no component media query, no style below the 14px floor, contrast pairs unchanged, and the whole unit suite green"
    verification:
      - kind: unit
        ref: "tests/unit/guards/phase8-ui-review-guards.test.ts, tests/unit/guards/phase5-layout-guards.test.ts, tests/unit/charts/contrast.test.ts (90 tests) and `pnpm run test:unit` (3084 tests)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Visual adequacy of the stacked account rows at desktop, tablet and 375px: hairlines, the 8px vertical rhythm, wrapping of a long nickname and a 20-digit ID, and no horizontal scroll"
    verification: []
    human_judgment: true
    rationale: "The UI-SPEC records this as a visual backstop (UI Considerations, long-text row): geometry and wrapping are properties of a rendered page, and the source and unit contracts cannot prove how a row reads. A screenshot walk at 1024px and 375px is a human judgement"

duration: 22 min
completed: 2026-10-17
status: complete
---

# Phase 9 Plan 04: Multi-account identity header Summary

**The identity header lists every account in the worker's D-16 order with its own ID, its games by long name and its first-to-last activity years, while one account still renders exactly as v1.0 — with every new string owned by `ui-copy.ts` and a three-account browser test that leaks nothing, fresh or after a reload.**

## Performance

- **Duration:** 22 min
- **Started:** 2026-10-17T06:56:00Z
- **Completed:** 2026-10-17T07:18:00Z
- **Tasks:** 2
- **Files modified:** 6 (3 created, 3 modified)

## Accomplishments

- A `multi` variant on `IdentityHeader.svelte`: an `h2` reading "3 accounts", the existing "As of export" caption, and an `ol` with an explicit `role="list"` and the static name "Accounts in this export", one `li` per account with its name, its ID line, its games and its activity years. A count of zero has no header at all, and one account takes the v1.0 branches byte-identically.
- The account with no `User_Info` renders as an ID-only row — its ID is the `h3`, the row carries `data-user-info="absent"`, the ID line is omitted because the ID is already the title, and it never shows another account's nickname.
- `identity-model.ts` holds every decision (`accountCountOf`, `isMultiAccount`, `accountRows`, `earliestCreated`) as pure functions, which is what makes the ID-only, blank-`NAME`, no-games, no-activity, shared-nickname and hostile-text shapes testable without a browser at all.
- The first of the phase's two allowed e2e tests: one import of the three-account fixture proving three rows in activity order, a leak scan of twelve canaries across five surfaces with the `"IP"` at-rest control, and the same assertions again after a reload off the cached meta record.
- 42 view-model tests and 14 ui-copy tests, plus a source contract that pins the seven multi ids, the index key, the explicit list role and the absence of a raw-markup directive, a `title`, an interpolating `aria-label`, a media query, a transition and `aria-live`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Tracer, a three-account import shows three rows in activity order, fresh and after a reload, with nothing leaked** - `33278c4` (feat)
2. **Task 2: Unit tests for the copy, the view model and the header source contract** - `74ad169` (test)

**Plan metadata:** (this file's commit)

_Note: the RED of Task 1 is the browser test's own failure — `data-variant` was `loaded`, not `multi` — and its GREEN is the same test passing. The RED of Task 2 was authored against the Task 1 implementation, as the plan's action block specifies._

## Files Created/Modified

- `src/lib/shell/identity-model.ts` (new) - the pure view model: `accountCountOf`, `isMultiAccount`, `accountRows`, `earliestCreated` and the civil-date parse
- `tests/unit/shell/identity-model.test.ts` (new) - 42 tests: the four functions' shapes, plus the header's source contract read lazily through `componentPath`
- `tests/e2e/shell/multi-account.spec.ts` (new) - the three-account browser test, written as named `test.step` blocks for 09-05 and 09-06 to extend
- `src/lib/ui-copy.ts` - five constants and six formatters beside the identity block, each with a doc comment naming its UI-SPEC row; `GAME_NAMES`, `formatGameName` and `formatGames` untouched
- `src/lib/shell/IdentityHeader.svelte` - the `multi` branch and its styles; the three single-account branches unchanged
- `src/app.css` - one line added to the existing 480px block
- `tests/unit/shell/ui-copy.test.ts` - the new `Phase 9` describe appended

## Decisions Made

- **`multi` is derived before the legacy identity.** `isMultiAccount(result)` is checked first in the variant chain, because `result.identity` is the FIRST account's: letting it decide would render one account as though it were the whole dataset. This is the T-09-20 mitigation at the point where it can be got wrong.
- **The header never re-sorts.** `accountRows` is a projection in the order it is given. The worker's `sortAccounts` is the only D-16 comparator, so there is no second sort that could disagree with it.
- **A second game-name table rather than a change to `GAME_NAMES`.** The existing panes read short labels in a column headed "Game", where "World of Warships" would wrap; only the identity list has the width. The plan and the UI-SPEC both call for this and both are honoured literally.
- **`earliestCreated` normalises for the comparison and returns the export's own spelling.** `formatCreatedDate` shows a date as the export wrote it, because the field carries no timezone and a `Date` round-trip would invent one. So the card shows `02.03.2015` if that is what the export holds — and picks the right minimum by comparing parsed integers rather than strings, which is the part a lexicographic comparison gets wrong (`DD.MM.YYYY` sorts after every ISO value).
- **`identity-model.ts` owns `earliestCreated` even though plan 09-05 renders it**, for the same reason the plan gives for the copy: one file owns these decisions, and a second implementation is a second thing that can be wrong.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript could not narrow `account.identity` through a boolean alias**
- **Found during:** Task 1 (`pnpm run check`)
- **Issue:** `const idOnly = account.identity === null;` followed by `idOnly ? account.root : valueOrUnknown(account.identity.nickname)` did not type-check — TS18047, `'account.identity' is possibly 'null'`. Narrowing a boolean alias is not narrowing, so the code would also have let a genuine "read from a possibly-null identity" bug past the flag.
- **Fix:** Bound `const identity = account.identity` once and narrowed on the binding; `idOnly` remains a derived flag for the template.
- **Files modified:** `src/lib/shell/identity-model.ts`
- **Verification:** `pnpm run check` exits 0 (313 files, 0 errors, 0 warnings); the browser test and all 42 model tests still pass
- **Committed in:** `33278c4` (Task 1 commit)

### Plan-text corrections (executor judgement, no implementation deviation)

- **The e2e RED was a link error on the first attempt.** A named import of `formatAccountCount` and friends from `ui-copy.ts` — exports that do not exist until the GREEN step — made Playwright report `No tests found`, which is a broken RED rather than a behavioural one. Switched to the namespace import the plan itself points at (`tests/unit/shell/ui-copy.test.ts` does this for the same reason), after which the RED was the real assertion failure: `data-variant` was not `multi`.
- **Two of my own Task 2 assertions were wrong, and the implementation was right.** They expected `earliestCreated` to re-format a dotted date into ISO, and then to pick `01.01.2020` over `31.12.2019`. Both contradict `formatCreatedDate`'s documented rule (a date is shown as the export wrote it, because it carries no timezone) and ordinary calendar order. The tests were rewritten to pin the real contract — normalised comparison, verbatim rendering — plus the month/day cases that actually distinguish a string comparison from a date comparison.

---

**Total deviations:** 1 auto-fixed (1 bug: a TypeScript narrowing failure caught by `pnpm run check`)
**Impact on plan:** The auto-fix is a three-line type-narrowing change inside the module the plan asked for, with no behaviour change. The two plan-text corrections were corrections to tests this plan wrote, not to the plan's intent.

## Issues Encountered

- The D-16 order and the identity pool both already existed from 09-01/09-02, so the tracer had no upstream uncertainty to resolve — the first browser run failed for exactly the reason the plan predicted (the header was still the single variant) and passed once the variant existed.
- One design question was genuinely open and is resolved above: whether the Overview card's "earliest created" summary should re-format the winning date. It must not, and the reason is a pre-existing documented rule rather than a new decision.

## Known Stubs

None. Every string the multi variant renders comes from a `ui-copy` constant or formatter, every row's data is bound from `accountRows`, and nothing renders `[]`, `null` or placeholder text.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **09-05** can render the Overview Account card and the Account list row from `formatAccountCount`, `ACCOUNT_ROW_MULTI_SUMMARY` and `earliestCreated` without touching `ui-copy.ts` or `identity-model.ts` — all three were defined here so that plan owns the wording and the model.
- **09-05** appends its steps to the SAME test in `tests/e2e/shell/multi-account.spec.ts`. It is already at `test.setTimeout(240_000)` and its leak scan is a reusable `expectNoLeak(page, consoleMessages, where)` over the `NEEDLES` list, so a pane-by-pane scan is one call per pane.
- **09-06** adds the phase's second and last e2e test; the suite is now at 257 of the 258 ceiling (D-23).
- The single-account path is proven untouched: `tests/e2e/shell/identity-privacy.spec.ts` passes unedited and `git diff --quiet b4e7f31` on it exits 0.

## Self-Check: PASSED

- Created files exist: `src/lib/shell/identity-model.ts`, `tests/unit/shell/multi-account.spec.ts`, `tests/unit/shell/identity-model.test.ts` — all three confirmed on disk.
- Commits exist and are ancestors of HEAD: `33278c4`, `74ad169`.
- Every task acceptance criterion and the plan-level `<verification>` re-run and green: the two e2e specs (6 passed), `pnpm exec vitest run` on the three unit files (337 passed), the three guard files (90 passed), `pnpm run test:unit` (3084 passed), `pnpm run check` (0 errors), `pnpm run lint` (clean), `grep -c "identity-multi-"` = 7, `playwright test --list` on the new spec = 1, and `git diff --exit-code b4e7f31 -- package.json pnpm-lock.yaml` exits 0.

---
*Phase: 09-multi-account-import-account-identity*
*Completed: 2026-10-17*