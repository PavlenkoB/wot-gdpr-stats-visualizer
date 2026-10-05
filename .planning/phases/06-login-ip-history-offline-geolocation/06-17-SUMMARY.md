---
phase: 06-login-ip-history-offline-geolocation
plan: 17
subsystem: city-lookup
tags: [city-table, ipv4-mapped, families, gap-closure, tdd, cr-02, g-2]
status: complete
gap_closure: true
gap_ids: [G-2, CR-02]

requires:
  - phase: 06-login-ip-history-offline-geolocation
    provides: "city-table decode and view (06-09), mappedIpv4 and lookupIp plane choice, the 06-15 parser and buildLoginsExportOfAddresses, the 06-16 typecheck gate"
provides:
  - "src/lib/geo/city-table.ts exports familiesOf: an IPv4-mapped IPv6 address needs the IPv4 family, decided by the same mappedIpv4 predicate lookupIp uses"
  - "a mapped-only account gets its city through the real worker (München, Paris), where placeOf had been -1"
  - "06-REVIEW-DISPOSITION.md records CR-01, CR-02 and WR-05 as fixed with commits; twelve findings stay open"
affects: [ACTIVITY-07]

requirements-completed: [ACTIVITY-07]

actuals:
  tokens: 2500
  tasks: 3
  commits: 4

# Measured, never narrated (#3968). Base is HEAD before the first task commit.
plan_head_before: 986c5269afeaa7e22f43ca4a794ce2be60f71429
plan_head_after: c130e326706b74254956767beef81b653dba35ed
commits: 4
commits_note: "4 measured by `git rev-list --count 986c526..HEAD` at SUMMARY write time: Task 1 RED, Task 1 GREEN, Task 2 test, Task 3 ledger. tokens is chars/4 over the added lines of src and tests (10,131 chars)."

tech-stack:
  added: []
  patterns:
    - "one predicate (mappedIpv4) decides the plane in both the decode rule and the lookup, with a decode-with-families equals decode-with-both invariant test as the drift guard"

key-files:
  created: []
  modified:
    - "src/lib/geo/city-table.ts"
    - "src/lib/worker/ingest.worker.ts"
    - "tests/unit/geo/city-table.test.ts"
    - "tests/unit/import/logins-city.test.ts"
    - ".planning/phases/06-login-ip-history-offline-geolocation/06-REVIEW-DISPOSITION.md"

key-decisions:
  - "familiesOf lives in city-table.ts (worker-only, already imports parseIp) so a unit test can reach it; the worker entry cannot be imported by a test."
  - "An empty or all-unreadable list still decodes no family; the old comment claiming 'both true when the list is empty' was wrong and is not carried over."

duration: 15min
completed: 2026-10-04
---

# Phase 6 Plan 17: IPv4-mapped addresses get their cities Summary

An account whose listed addresses are all IPv4-mapped IPv6 (`::ffff:a.b.c.d`, either spelling) now decodes the IPv4 plane of the city table, so `placeOf` resolves München and Paris instead of a silent -1; the rule is now an exported, unit-tested `familiesOf` sharing `mappedIpv4` with `lookupIp`.

## Tasks

| Task | Commit | Type |
| ---- | ------ | ---- |
| 1 RED: worker-level tracer, mapped only / mixed / IPv6 control | 5242110 | test(06-17) |
| 1 GREEN: relocate and correct `familiesOf`, worker calls it | 7e1a5d1 | fix(06-17) |
| 2: families table, invariant, IPv4-plane-only assertion | 98f6f3c | test(06-17) |
| 3: ledger closeout (CR-01, CR-02, WR-05) | c130e32 | docs(06-17) |

## RED evidence (the GSD `tdd-red-evidence` tool was not used, per the plan)

Task 1, `pnpm exec vitest run tests/unit/import/logins-city.test.ts` before any source change: 2 failed, 7 passed.
- FAILED `resolves both spellings of a mapped address to their cities`: `placeOf[0]` was -1 (expected >= 0). The listing and its countries (DE, FR) already passed, which confirms the country path was never broken.
- FAILED `decodes both planes when a mapped address sits next to a plain IPv6 one`: the place of the mapped entry was undefined (placeOf -1).
- PASSED `control: a plain IPv6-only account still gets its city`.

After the fix: all three pass.

## Mutation run (Task 2)

With the mapped branch of `familiesOf` temporarily reverted to the old IPv6-only behaviour: 7 failed, 25 passed in `tests/unit/geo/city-table.test.ts`. Failing: the five mapped rows (compressed, expanded, both spellings, mapped plus IPv6, mapped plus IPv4), the decode-with-families equals decode-with-both invariant, and the mapped-only IPv4-plane-only test. With the rule restored: 32 passed. The mutation was never committed (`git diff` of `city-table.ts` against the Task 1 commit is empty; no comment fix was needed because `familiesOf`'s doc comment was written correctly in Task 1 and the module header lists no exports).

## Verification

- `pnpm run test:unit`: 77 files, 2346 tests passed.
- `pnpm run check` (tsc -b plus svelte-check): 0 errors, 0 warnings. `pnpm run lint`: clean.
- `pnpm run build`: succeeds (worker chunk compiles with the relocated rule).
- `pnpm exec playwright test tests/e2e/logins tests/e2e/guards`: 40 passed (local smoke, no test added, no CI limit changed).
- `git grep "function familiesOf" -- src`: one line, `city-table.ts`. `git grep "fetch(" -- src`: one line, `city-fetch.ts`; none under `src/lib/worker`.
- `git diff 986c526 -- src/lib/ui-copy.ts src/lib/features/playtime`: empty.
- Ledger: numstat against the creating commit is exactly 3/3; 12 rows still read `| open |`; all five cited hashes resolve to the expected `fix(06-NN)` commits (CR-01: 77e9609, b046956; WR-05: 6846a54, 1f83ed9; CR-02: 7e1a5d1).

## Deviations from Plan

None - plan executed exactly as written. The ledger sentence format was appended to the Reason cell as `Fixed in plan 06-NN (hash, hash).`; the fix commits were the `fix(06-15)` ip.ts commits (the word-count and the dotted-quad-placement commits, 77e9609 and b046956) and the `fix(06-16)` commits, as the plan expected. The third `fix(06-15)` commit (154c8d5, aggregate version bump) is not cited because it does not change `ip.ts`.

`.planning/WINDOWS.md` was not touched (rows 8-9 are corrupt per the plan); there were no stubs, skipped tests or unrun verifies to record.

## Known Stubs

None.

## Threat Flags

None. No network code, endpoint or persistence was added (T-06-65 to T-06-68 mitigated as planned; T-06-66 asserted by the IPv4-plane-only test).

## Self-Check: PASSED

- FOUND: src/lib/geo/city-table.ts (familiesOf), tests/unit/geo/city-table.test.ts, tests/unit/import/logins-city.test.ts, 06-REVIEW-DISPOSITION.md
- FOUND commits: 5242110, 7e1a5d1, 98f6f3c, c130e32
