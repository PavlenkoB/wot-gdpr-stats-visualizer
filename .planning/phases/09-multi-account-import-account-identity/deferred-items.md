# Deferred items — phase 09

Out-of-scope discoveries made while executing this phase. Each is a finding, not a fix: the
scope-boundary rule says a pre-existing problem in unrelated code is logged, not repaired,
because repairing it here would change code this phase does not own and would bury the
finding under an unrelated diff.

## Pre-existing real account id literals in `tests/unit/import/classify.test.ts`

- **Found during:** 09-01 Task 2 (privacy sweep of the new fixtures; these literals are NOT
  in the new files).
- **Where:** `tests/unit/import/classify.test.ts` — the `resolveCsvFileCategory`
  wrapper-fallback tests and the "debug-session literal wrapper shape" test use the folder
  name `1234567` (lines around 433-546 after 09-01).
- **Why it matters:** `1234567` is one of the three account folder names in the USER's real
  `2026-10-14.zip`, as listed in `09-RESEARCH.md` §Real Sample Shape. Phase 9's
  prohibitions state that no fixture or test may contain a real account number from the
  user's private export, so these v1.0 literals now read as a violation of a phase rule even
  though they predate it.
- **Not fixed here:** the literals are pinned by v1.0 test titles and assertions that 09-01
  was required to keep, and rewriting them is a v1.0-test edit this plan does not own.
- **Suggested resolution:** replace `1234567` with a synthetic id (e.g. `1234567`) in a
  dedicated cleanup, or fold it into the plan that owns the classifier's single-root pins.
  The new `tests/fixtures/multi-account-fixtures.ts` is clean: it uses only made-up ids
  (`2000002`, `500000001`, `1000000003`, `200`, `300`…), `*.example.invalid` e-mail domains
  and RFC 5737 addresses.
- status: resolved
- **Resolution:** replaced with a synthetic id in 3ebfd46; no match for the real id remains under src or tests.
