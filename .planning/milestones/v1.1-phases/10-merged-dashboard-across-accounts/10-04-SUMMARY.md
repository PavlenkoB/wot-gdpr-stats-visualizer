---
phase: 10-merged-dashboard-across-accounts
plan: 04
subsystem: logins
tags: [account-tag, multi-account, logins, privacy, masking, ui-copy, city-optin, e2e]

requires:
  - phase: 10-merged-dashboard-across-accounts
    plan: 01
    provides: "`MA_OVERLAP_ADDRESSES` and `buildOverlapTwoAccountExport` — the two-account fixture whose five addresses, logins, accounts and games are hand-written"
  - phase: 10-merged-dashboard-across-accounts
    plan: 03
    provides: "`AccountTag.svelte`, `accountTagsFor`, `tagLabel`, and `expectNicknameTextOnly` — the privacy rule a tagged pane holds"
  - phase: 09
    provides: "the non-indexed per-row `account` and `readLoginRowData`'s `AccountLoginSource.account`, which already stamps every rebuilt source"
provides:
  - "`LoginAddress.accounts` (optional, code-unit ascending) and `LOGINS_VERSION` 3"
  - "`LoginSource.account` (optional), stamped by both import-time `loginSources.push` calls and by the rebuild reader"
  - "`LoginRow.accounts`, `accountChipsOf`, `LOGIN_TAGGED_IP_WIDTH_PX` (224) and `LOGIN_CHIPS_VISIBLE` (3)"
  - "`visibleLoginColumns(cityLoaded, tagged = false)` — the same export, one optional argument"
  - "`formatAccountOverflow` in `ui-copy.ts`; the `.w-ip-tagged`, `.first-tagged` and `.more` rules in `LoginTable.svelte`"
  - "`handAddressesOwnedBy` in the logins fixtures — the hand key read through the worker's owner stamp"
affects: [10-05, 10-06, Payments.svelte, logins-worker.test.ts, login-oracle.ts]

actuals:
  tokens: 61000
  tasks: 2
  commits: 2
plan_head_before: 46f37724b840aae5cd43bdd6ca97ccdb6b39ba27
plan_head_after: 0b622bb018908b8f5697806ccd8ddb96d737e086

tech-stack:
  added: []
  patterns:
    - "The account set is a `Set` of ROOTS, accumulated per counted row and emitted code-unit sorted. An address is never split per account, so `totalLogins`, `countries`, `unknown` and `other` are all byte-identical to the same archive run without accounts — which is what the tests pair every accounts assertion against."
    - "A STORAGE order and a READING order are different rules, and they are named apart: the aggregate sorts roots by code unit so the record is stable, and `accountChipsOf` re-sorts the tags by LETTER so the chip row agrees with the legend above it."
    - "The chips' layout is a `class:first-tagged` on the cell, never a widening of `.w-ip-tagged`'s meaning — width and layout are separate questions and the comment says so."

key-files:
  created: []
  modified:
    - src/lib/features/logins/login-shared.ts
    - src/lib/features/logins/login-aggregate.ts
    - src/lib/features/logins/login-model.ts
    - src/lib/features/logins/LoginTable.svelte
    - src/lib/features/logins/LoginHistory.svelte
    - src/lib/worker/ingest.worker.ts
    - src/lib/ui-copy.ts
    - tests/fixtures/logins-fixtures.ts
    - tests/helpers/login-oracle.ts
    - tests/unit/logins/login-aggregate.test.ts
    - tests/unit/logins/login-model.test.ts
    - tests/unit/import/logins-backfill.test.ts
    - tests/unit/import/logins-worker.test.ts
    - tests/unit/shell/ui-copy.test.ts
    - tests/e2e/shell/multi-account.spec.ts

key-decisions:
  - "`accounts` is OPTIONAL on `LoginAddress` and REQUIRED on `LoginRow`. The stored record may be a version-2 cache that names no accounts, so the type says so; a freshly built row answers `[]` for an address that has none, which is `buildLoginRows`' decision rather than the type's, and is what keeps a chip renderer asking for `.length` safe on an old cache."
  - "The chips are ordered by LETTER, not by the order the aggregate stored. The stored order for the three-account fixture is NA, RU, EU — the reverse of the D-16 order the identity header publishes — and drawn in stored order the first row reads C, A, B under a legend reading A, B, C. The e2e caught this and it was fixed in `accountChipsOf` rather than relaxed in the assertion."
  - "The first cell's layout hangs off `class:first-tagged`, not off the width class. `.w-ip-tagged` answers 'how wide', `.first-tagged` answers 'is it a flex row', and a future geometry change that widens the column without tagging (or the reverse) then cannot silently break the other."
  - "The pinned Account record row gets no chips and no `row` argument. With two or more accounts that row does not exist at all (D-13), so passing `null` for it is the honest call rather than a guard for a case that cannot arise — and `hasAccountRow` stays the only thing that decides it."
  - "Six pre-existing expectations were moved rather than deleted. `LOGINS_HAND_KEY` stays account-free (it is derived from ROWS, and a row has no owner) and is read through `handAddressesOwnedBy` where the worker's stamp applies; the oracle gains an `accounts: []` field derived from its own spec rather than invented."

requirements-completed: [ACCOUNT-06, ACCOUNT-07]

coverage:
  - id: D1
    description: "Login history is ONE table and ONE country map across every account: a login row is one distinct IP carrying up to three letter chips (a muted +N beyond), the Account record row is absent, and the country totals still sum to the tile total."
    requirement: ACCOUNT-07
    verification:
      - kind: unit
        ref: "tests/unit/import/logins-backfill.test.ts#one merged login table across accounts"
        status: pass
      - kind: e2e
        ref: "tests/e2e/shell/multi-account.spec.ts#the Login history rows name every account that logged in (D-18, D-13)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The first column is 224px only when two or more accounts exist, every other column is the same object as untagged, and with one account `visibleLoginColumns(false)` is byte-identical to Phase 9's list."
    requirement: ACCOUNT-06
    verification:
      - kind: unit
        ref: "tests/unit/logins/login-model.test.ts#visibleLoginColumns widens the first column only when tagged (D-18)"
        status: pass
      - kind: e2e
        ref: "tests/e2e/logins/login-table.spec.ts (single-account, unchanged)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Rows are NOT split per account: the distinct-address count, the per-country ips count, the MAX_LOGIN_IPS cap and the index alignment of the city placeOf list are all unchanged, at one account and at the cap."
    requirement: ACCOUNT-07
    verification:
      - kind: unit
        ref: "tests/unit/logins/login-aggregate.test.ts#does not split an address into a row per account, and moves no total"
        status: pass
      - kind: unit
        ref: "tests/unit/logins/login-model.test.ts#gives every row its own city, because the rows were NOT split per account"
        status: pass
    human_judgment: false
  - id: D4
    description: "A v2 cache rebuilds from the rows to exactly the import-time answer, accounts included, and the stored record is written back at LOGINS_VERSION 3."
    requirement: ACCOUNT-07
    verification:
      - kind: unit
        ref: "tests/unit/import/logins-backfill.test.ts#rebuilds a v2 cache to exactly the import-time answer, accounts included (T-10-14)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Masking and the city opt-in are unchanged: a tagged row masks exactly as an untagged one, no cell or attribute holds an address or an account root while masked, and opening or sorting the merged Login history issues no request with city-optin still idle."
    requirement: ACCOUNT-07
    verification:
      - kind: unit
        ref: "tests/unit/logins/login-model.test.ts#puts neither an address nor an account root in the cells while masked (T-10-12)"
        status: pass
      - kind: e2e
        ref: "tests/e2e/shell/multi-account.spec.ts#opening and sorting the merged Login history fetched nothing"
        status: pass
    human_judgment: false
  - id: D6
    description: "Three chips beside a masked address at 375px: the document does not scroll sideways, the cell declares 224px, and the row stays one 40px line while the table scrolls inside its own scroller."
    requirement: ACCOUNT-06
    verification:
      - kind: e2e
        ref: "tests/e2e/shell/multi-account.spec.ts#the tagged first cell / a tagged row stays one 40px line"
        status: pass
    human_judgment: true
    rationale: "Only the measurable half is asserted: the document's `scrollWidth`, the declared column width, the row height and the scroller's own overflow. Whether three chips and a masked IPv6 READ well together — whether the 4px gap is right, whether the address has enough room to wrap, whether the sticky column looks balanced — is a visual judgement no assertion makes. The plan filed it as a human check and it is routed here rather than claimed."

duration: 1h 12m
completed: 2026-10-18
status: complete
---

# Phase 10 Plan 04: One merged Login history whose rows name their accounts Summary

**Login history is one table and one map across every account, each row naming in up to three letter chips which accounts logged in from that address — with masking, the city opt-in and every total exactly as before.**

## Performance

- **Duration:** 1h 12m — both tasks, no interruption.
- **Started:** 2026-10-18T17:29:53Z
- **Completed:** 2026-10-18T18:42:00Z
- **Tasks:** 2
- **Files modified:** 15

## Accomplishments

- `LoginAddress.accounts` and `LOGINS_VERSION` 3. Both import-time `loginSources.push` calls now carry `account: resolved.root`; the rebuild reader already stamped it (`AccountLoginSource`), so the lazy path needed no change and is proven by a test rather than by reading.
- `CountingAddress.accounts` is a `Set` of roots accumulated per counted row. Three rows from one root contribute one account, not three. The emitted array is code-unit sorted and ALWAYS present on a fresh aggregate; the optionality in the type exists for a stored version-2 record, which `LOGINS_VERSION` turns into a rebuild rather than a cast.
- `accountChipsOf(roots, tags)` returns `{ shown, hiddenTags, extra }`: the first three known tags, the rest as phrase-only tags, and the count. An unknown root is skipped — a letter for an account the header never listed would contradict the legend directly above the table — and `tags === null` answers three empties so the single-account cell needs no `if` around it at all.
- `visibleLoginColumns(cityLoaded, tagged = false)`: one optional argument rather than a second export, so the single-account call site is the call site v1.0 had. Only the first column changes, and the other six are the SAME objects — identity, not equality, in the test.
- `LoginTable.svelte`: chips before the address in a nowrap flex row, 4px gap, `flex-shrink: 0`, then the existing `.ip` at `flex: 1 1 auto; min-width: 0` so a long IPv6 wraps in what is left rather than widening the sticky column. The conditional sits flush against the `<span class="ip">` with no whitespace between, which is the same load-bearing adjacency the vehicle table documents.
- `formatAccountOverflow(count)` → `+N`, plain text and deliberately not a chip: a third chip-shaped thing reading `+2` would be read as an account named `+2`.
- Tests: the overlap fixture's five addresses compared as an equality against `MA_OVERLAP_ADDRESSES`; the same export imported with its zip entries reversed giving identical addresses and accounts; a v2 cache (no `accounts` key at all) rebuilding to deep-equal the import-time view; the over-cap archive naming accounts on the listed rows while both of `MAX_LOGIN_IPS`'s sum relationships hold; `placeOf` still index-aligned when addresses carry accounts; masked cells free of both an address and a root.

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end shared-IP row — the worker records which accounts logged in from an address and the table shows one chip per account** - `17b7b76` (feat)
2. **Task 2: Prove the merged Logins invariants — rebuild equals import, the hand fixture's shared IPs, unchanged city alignment, masking and zero requests** - `0b622bb` (test)

## Files Created/Modified

- `src/lib/features/logins/login-shared.ts` — `LoginAddress.accounts`, `LOGINS_VERSION` 3, a "3 -" paragraph on the version's doc comment.
- `src/lib/features/logins/login-aggregate.ts` — `LoginSource.account`, `CountingAddress.accounts`, the emit sort.
- `src/lib/features/logins/login-model.ts` — `LoginRow.accounts`, `accountChipsOf`, `LOGIN_TAGGED_IP_WIDTH_PX`, `LOGIN_CHIPS_VISIBLE`, `visibleLoginColumns`' second argument, `compareLetters`.
- `src/lib/features/logins/LoginTable.svelte` — the `tags` prop, the chip row, `.w-ip-tagged`, `.first-tagged`, `.more`.
- `src/lib/features/logins/LoginHistory.svelte` — `tags = accountTagsFor(result)`, the tagged column list, `{tags}` passed down.
- `src/lib/worker/ingest.worker.ts` — two stamps, nothing else.
- `src/lib/ui-copy.ts` — `formatAccountOverflow`.
- `tests/fixtures/logins-fixtures.ts`, `tests/helpers/login-oracle.ts` — the hand key's projection and the oracle's `accounts` field.
- `tests/unit/logins/login-aggregate.test.ts`, `tests/unit/logins/login-model.test.ts`, `tests/unit/import/logins-backfill.test.ts`, `tests/unit/import/logins-worker.test.ts`, `tests/unit/shell/ui-copy.test.ts`, `tests/e2e/shell/multi-account.spec.ts` — the proofs.

## Decisions Made

- **The chip order is the letter's, and the e2e is what proved it.** The first run of the merged-Logins step came back `C, A, B`. That is the aggregate's stored order — code-unit ascending puts root `1000000003` before `2000002` — which is correct for storage and wrong for reading, because the identity header above the table publishes A, B, C. `accountChipsOf` now sorts by letter (length first, then code unit, so `AA` follows `Z` in the bijective base-26 `letterOf` writes), and two unit tests pin both halves. Fixing the renderer rather than relaxing the assertion was the whole point: the assertion was right about what a reader should see.
- **`expectNicknameTextOnly` grew a third parameter.** It was hardcoded to `[data-testid="player-stats"]`, so pointing it at the Login pane failed with "`player-stats` is absent, so this scan proved nothing" — the helper's own anti-vacuity branch, doing exactly its job. It is now given the scope by the caller, and the default keeps the Vehicles call site as it was.
- **The 375px width is asserted from the computed style, not `clientWidth`.** `clientWidth` includes the 8px padding the table gives every cell, so a raw `224` assertion fails on `240` — a number no element produces. The test reads the declared width (`224px`) and checks the rendered cell is that plus its own 16px of padding, which is a stronger claim than either number alone.
- **The v2 cache is built by omitting the key, not by emptying it.** `accounts: []` on every address would be a version-3 record with nothing in it, and a reader that skipped the rebuild because of it would still pass. The test constructs the version-2 shape through a cast that drops `accounts` entirely, so "the rebuild was reached" is the only way to satisfy it.
- **No per-account record card, and the row is absent rather than guarded.** D-13 already made `account` null for two or more accounts (`readLoginRowData` fills the pool only when the published list is one root), so the pinned row cannot exist on a tagged dataset. `hasAccountRow` remains the only thing that decides it; the component's `row` argument is `null` for that row because that is the truth, not because it needs guarding.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The account chips were drawn in the aggregate's stored order rather than the published one**
- **Found during:** Task 1, the first e2e run of the merged-Logins step
- **Issue:** `accountChipsOf` returned the roots in the order `LoginAddress.accounts` stores them, and that order is code-unit ascending. For the three-account fixture the roots are `1000000003` (NA), `2000002` (RU) and `500000001` (EU), so the busiest row drew `C, A, B` while the identity header directly above it published `A, B, C`. D-18 requires the chips in identity-header order, so every row asked the reader to re-derive the mapping — and a row with two accounts could not be scanned at a glance at all.
- **Fix:** `accountChipsOf` now sorts the known tags by their LETTER, comparing length first and then by code unit. That is the bijective base-26 order `letterOf` writes in, and it is the only ordering in which `AA` follows `Z` rather than preceding `B`. The storage sort is untouched: it is a stable record order, not a reading one, and the two are now named apart in both files.
- **Files modified:** `src/lib/features/logins/login-model.ts`, `tests/unit/logins/login-model.test.ts`
- **Verification:** two new unit tests (published order, and `AA` after every one-letter chip); the e2e step that caught it now passes.
- **Committed in:** `17b7b76`

---

**2. [Rule 2 - Missing critical functionality] `expectNicknameTextOnly` could not be pointed at a pane other than Vehicles**
- **Found during:** Task 1, the same e2e run
- **Issue:** The helper's attribute scan hardcoded `[data-testid="player-stats"]` as its scope. Plan 10-03 wrote it for one pane and this is the second, so calling it on the Login pane failed on its own anti-vacuity branch — "`player-stats` is absent, so this scan proved nothing". Left alone, the D-19 restatement this plan must_haves would have been either unasserted or satisfied by a vacuous pass, which is the one outcome worse than no assertion.
- **Fix:** The scope selector became a third parameter defaulting to `[data-testid="player-stats"]`, so the Vehicles call site is unchanged and every tagged pane after it names its own scope. The absence branch stays: a scope that is not on screen is still reported as the failure it is.
- **Files modified:** `tests/e2e/shell/multi-account.spec.ts`
- **Verification:** the Logins step's `expectNicknameTextOnly` calls pass with the pane's own selector, and the Vehicles call site is byte-identical to before.
- **Committed in:** `17b7b76`

---

**3. [Rule 3 - Blocking] Six existing expectations met the new `accounts` field without agreeing about where an owner comes from**
- **Found during:** Task 1, the first full unit run after the aggregator change
- **Issue:** Six tests failed, all on one shape question. `LOGINS_HAND_KEY.addresses` has no `accounts`, and so did the oracle's. The hand key is derived from ROWS — and a row carries no owner, because the owner is the FILE's folder. Editing the key to carry `accounts` would have made "the hand key says which account logged in" a claim about rows that never held, and it would have broken the pure-aggregator tests that legitimately have no owner.
- **Fix:** Three moves, each keeping the truth where it belongs. `handAddressesOwnedBy(root)` in the fixtures projects the key through the worker's stamp, used by the two worker-path tests; the pure aggregator test compares against the key mapped to `accounts: []`; the oracle gains an `accounts: string[]` field whose doc says it is DERIVED — every source the oracle is fed is a scale fixture built by `parseCsvFile`, which names no owner, so an oracle that invented a root would be asserting something the spec does not say. The worker-path test that rebuilds the expected value by hand now stamps `account` on its two sources, which is exactly what the import loop does.
- **Files modified:** `tests/fixtures/logins-fixtures.ts`, `tests/helpers/login-oracle.ts`, `tests/unit/logins/login-aggregate.test.ts`, `tests/unit/import/logins-worker.test.ts`, `tests/unit/import/logins-backfill.test.ts`
- **Verification:** `pnpm run test:unit` — 98 files / 3291 tests green, including the two oracle comparisons that had to agree field for field.
- **Committed in:** `17b7b76` (the `handAddressesOwnedBy` fixture), `0b622bb` (the Task 2 additions to the same files)

---

**Total deviations:** 3 auto-fixed (1 rendering bug, 1 missing capability in a shared test helper, 1 blocking shape mismatch across six expectations)

**Impact on plan:** Deviation 1 changed rendered output — the chips now follow the legend, which is what D-18 asked for and what the plan's own must_haves describe. Deviation 2 extended a helper this plan reuses rather than working around it. Deviation 3 moved expectations to where the fact lives and touched no production code.

## Issues Encountered

- **The acceptance grep `grep -c "account: resolved.root"` returns 4, not the 2 the plan states.** Two of the four are pre-existing: the file already stamped `account: resolved.root` on its parse result and on every stored row before this plan. The plan's figure counted the two it expected to add without accounting for those, so the criterion is stale rather than the code wrong. The intent — both `loginSources.push` calls carrying the stamp — is verified directly: `grep -n "loginSources.push" src/lib/worker/ingest.worker.ts` shows exactly two lines, both with `account: resolved.root`. Recorded rather than worked around by deleting an unrelated correct line.
- **`pnpm run test:unit -- <paths>` does not filter in this repo** (unchanged from 10-01, 10-02 and 10-03): it runs all 98 files, so every "targeted" unit command in this plan's verify blocks was a full-suite run. Noted rather than worked around. `pnpm exec vitest run <path>` was used during development where a single file mattered, and every such run was followed by the full suite.
- **`tests/e2e/shell/chart-fill.spec.ts` "finance charts fill the detail pane" remains flaky at 375px under parallel workers** and passes standalone. Pre-existing, logged open in `.planning/WINDOWS.md` entry 15, not caused by this plan and not fixed here. This plan's grouped run was `tests/e2e/shell/multi-account.spec.ts` + `tests/e2e/logins`, which does not include that spec: 37 passed, no failure.

## Self-Check: PASSED

- All 15 modified files exist on disk; the two task commits are ancestors of HEAD and `git rev-list --count 46f3772..HEAD` is 2, which is what `actuals.commits` records. No commit in the plan deleted a tracked file.
- `pnpm run test:unit` — 98 files / 3291 tests green. `pnpm run check` — 0 errors, 0 warnings. `pnpm run lint` — clean.
- `pnpm exec playwright test tests/e2e/shell/multi-account.spec.ts tests/e2e/logins` — 37 passed. `pnpm exec playwright test --list` — 258 tests in 28 files, no new listed test (D-23).
- Every acceptance grep holds: `LOGINS_VERSION` is 3 on one line; `accounts?: string[]` appears once in `login-shared.ts`; `accountChipsOf` is exported once; `w-ip-tagged` is declared and used in `LoginTable.svelte` and used in `login-model.ts`; no `title={row…` survives on the first cell.
- `tests/unit/import/db.test.ts` still pins `db.verno` at 2 in three places — no Dexie bump, as D-16 requires.
- The privacy invariants are untouched and asserted rather than assumed: nothing under `src/lib/worker/**` fetches, `src/lib/geo/city-fetch.ts` is still the only ESLint network exemption, the `account` row field stays non-indexed, and IP masking is the same `displayIp` call v1.0 made — proven by a test that compares a tagged row's masked cell against an untagged one and by an e2e that scans every attribute after the reveal.
- `graphify update .` run: 8509 nodes, 12707 edges. `graphify-out/` left uncommitted, per Plans 10-01 through 10-03.

## Known Stubs

None. Every rule this plan added is reachable: the accounts by a multi-account dataset, the chips by a row with accounts, the `+N` by an address past three accounts (not reachable on this phase's fixtures, and its own unit test covers the formatter and `extra`), the wider column by the same `tags !== null` gate every other pane uses. Nothing is wired to an empty or placeholder value.

The `+N` overflow is the one path no e2e exercises, because no fixture in this phase has four accounts on one address — the classifier caps accounts at 32 but the phase's fixtures hold three. Its logic is covered by `accountChipsOf`'s five-root unit test (`shown` 3, `hiddenTags` 2, `extra` 2) and `formatAccountOverflow` by its own unit test; what is unproven in a browser is the rendering of one muted span inside a 224px cell, which is the plan's filed human check territory rather than a defect.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Plans 10-05 and 10-06 can start.** Everything they need is exported: `LoginAddress.accounts`, `LoginRow.accounts`, `accountChipsOf`, `formatAccountOverflow`, `visibleLoginColumns(cityLoaded, tagged)`, and the `tags` prop on `LoginTable` (which 10-05's Payments pane may want as a sibling rather than a sibling table).
- **The chip-order rule is now shared, not per-pane.** Any pane that renders a row's accounts must sort by `AccountTagModel.letter`, never by a stored array's order — the aggregate's root arrays are code-unit sorted, which is a record order and not a reading one. Plan 10-05's Payments rows should copy `accountChipsOf` rather than write their own split.
- **`expectNicknameTextOnly(page, where, scopeSelector)` is the reusable privacy rule for any tagged pane.** Its third argument is what keeps it from passing vacuously on a pane it was not written for; its anti-vacuity branch will fail the step rather than let it.
- **The `+N` overflow is untested in a browser.** If Plan 10-06's large fixture can produce an address shared by four or more accounts, that is the natural place to assert it; otherwise it stays covered by its unit test and the human check.
- **Carried forward unchanged:** `derivePlaytimeState`'s `awaiting` still compares the PAIR `(valueIndex, game)` from 10-02, `deriveLoginState` is untouched, and the non-indexed `account` row field and `db.verno` 2 are as Phase 9 left them.

---
*Phase: 10-merged-dashboard-across-accounts*
*Completed: 2026-10-18*