---
phase: 06-login-ip-history-offline-geolocation
plan: 15
subsystem: geo-ip-parsing
tags: [ipv6, parser, dotted-tail, gap-closure, tdd, logins-version]
status: complete
gap_closure: true
gap_ids: [G-1, CR-01]

requires:
  - phase: 06-login-ip-history-offline-geolocation
    provides: "parseIp/parseIpv6 (06-03), the logins aggregate and its (v, geo) rebuild-on-read (06-01, 06-05, 06-06), the real-shape fixture builders"
provides:
  - "parseIpv6 counts WORDS after the dotted tail is expanded: exactly eight uncompressed, at most seven compressed, one rule for both branches"
  - "a dotted quad is expanded only as the final colon-separated token, so a quad before the compression is refused"
  - "buildLoginsExportOfAddresses: the single builder for tests that choose the address list (reused by plan 06-17)"
  - "LOGINS_VERSION 2: a stored aggregate built under the old parse rules is rebuilt from the stored rows on the next read"
affects: [06-17, ACTIVITY-05, ACTIVITY-06]

requirements-completed: [ACTIVITY-05, ACTIVITY-06]

actuals:
  tokens: 4300
  tasks: 3
  commits: 6

# Measured, never narrated (#3968). Base is HEAD before the first task commit.
plan_head_before: 989a019e16d7b621ee481293cec755c4054e253b
plan_head_after: 154c8d5ba5fab4835fab0ff7373dbba4c377d68b
commits: 6
commits_note: "6 measured by `git rev-list --count 989a019..HEAD` at SUMMARY write time: three RED test commits and three GREEN fix commits. tokens is chars/4 over the added lines of src and tests (17,298 chars); the estimate of 60,000 was high because the work was one small function plus tests."

tech-stack:
  added: []
  patterns:
    - "count words after expansion, not tokens before it, when one token stands for more than one unit"
    - "run-time construction of public dotted quads in tests (the phase6 address guard scans committed text, comments included)"

key-files:
  created: []
  modified:
    - "src/lib/geo/ip.ts"
    - "src/lib/features/logins/login-shared.ts"
    - "tests/fixtures/logins-fixtures.ts"
    - "tests/unit/geo/ip.test.ts"
    - "tests/unit/import/logins-country.test.ts"
    - "tests/unit/import/logins-backfill.test.ts"

key-decisions:
  - "One word-count rule applied to both the compressed and the uncompressed branch, after expansion, replacing the two exact pre-expansion token checks and the compressed-only post-check they compensated for. A cheap early bound (more than eight tokens is never an address) stays."
  - "A dotted quad is expanded only when it is both the last group and equal to the text after the last colon; any other dotted group falls through to the hex read and is refused. This also guarantees the head keeps exactly headGroups.length words, so the splice index is not recomputed."
  - "LOGINS_VERSION bumped 1 to 2 with the meaning-change paragraph extended: a parser change that alters which rows are counted is a meaning change, so stored aggregates are re-derived rather than served."

patterns-established:
  - "Tracer-first gap closure: the verifier's reproduction goes through the real worker as a failing test before the arithmetic is touched."

duration: 7min
completed: 2026-10-04
---

# Phase 6 Plan 15: Dotted-tail word count (G-1, CR-01) Summary

**parseIpv6 now counts words after expanding a dotted tail, so the expanded IPv4-mapped and six-plus-dotted spellings resolve, the seven-plus-dotted spelling is refused instead of stored under a nine-group key, a quad before the compression is refused, and stored aggregates are rebuilt under LOGINS_VERSION 2.**

## Performance

- **Duration:** about 7 min
- **Started:** 2026-10-04T18:10Z
- **Completed:** 2026-10-04T18:17Z
- **Tasks:** 3 (1 tracer, 2 tdd)
- **Files modified:** 6

## Accomplishments

- G-1 closed in the parser: `1:2:3:4:5:6:<quad>` and `0:0:0:0:0:ffff:<quad>` parse (the latter shares its grouping key with `::ffff:<quad>` and unwraps via `mappedIpv4`); `1:2:3:4:5:6:7:<quad>`, `1:2:3:4:5:<quad>` and `1:2:3:4:5:6::<quad>` are refused.
- Placement defect found while reproducing CR-01 closed: `<quad>::` was accepted and split across the compression; it is now refused (RED-proven).
- Through the real worker, a session file holding the three verifier spellings lists two addresses (country FR and unknown) and counts one unreadable row; no nine-group key is stored.
- A 600-case seeded property (mulberry32 0x0615) agrees with an independent word-count rule and expansion, and every accepted canonical has eight groups, re-parses to itself and masks to a real mask.
- A dataset already in a browser picks up the corrected parser: a stored version-1 aggregate is rebuilt on the next read.

## Task Commits

1. **Task 1 (tracer): RED** - `2ca61a7` test(06-15): tracer for the dotted-tail word count through the real worker
   **GREEN** - `77e9609` fix(06-15): count IPv6 words after the dotted tail is expanded
2. **Task 2: RED** - `83e88b1` test(06-15): pin the dotted-tail matrix, the placement rule and a seeded word-count property
   **GREEN** - `b046956` fix(06-15): accept a dotted quad only as the final colon-separated token
3. **Task 3: RED** - `50c9287` test(06-15): a stored version-1 aggregate must be rebuilt under the corrected parser
   **GREEN** - `154c8d5` fix(06-15): bump the logins aggregate version for the corrected parser

## RED evidence (GSD `tdd-red-evidence` cannot classify a Vitest RED, so recorded here)

| Commit | Run | Failing tests |
|--------|-----|---------------|
| 2ca61a7 | 1 failed, 7 passed (logins-country.test.ts) | "06-15 tracer (G-1, CR-01) ... lists the eight-word spellings and counts the nine-word one as unreadable". Old value: addresses was the single nine-group key `1:2:3:4:5:6:7:c000:201`; the two legal spellings were counted unreadable. |
| 83e88b1 | 3 failed, 126 passed (ip.test.ts) | "refuses ... answers null for a dotted tail before the compression"; "06-15 ... reproduces the verifier: a tail before the compression is NOT an address"; "06-15 ... a seeded property over the word count > agrees with an independent word-count rule and expansion on 600 cases". Old value: the quad-then-compression text parsed as a split address. |
| 50c9287 | 1 failed, 12 passed (logins-backfill.test.ts) | "06-15: rebuilds an aggregate stored under the previous parse rules ...". Old value: a stored v=1 aggregate equalled the current constant, was served as stored, and the view was `no-usable`. |

## Files Created/Modified

- `src/lib/geo/ip.ts` - word count after expansion (one rule, both branches), final-token quad rule, header and check-list comments updated.
- `src/lib/features/logins/login-shared.ts` - `LOGINS_VERSION = 2`, meaning-change paragraph extended.
- `tests/fixtures/logins-fixtures.ts` - `buildLoginsExportOfAddresses` (max 40 addresses, one WOT session row each).
- `tests/unit/geo/ip.test.ts` - 5 ACCEPTED rows, 7 REFUSED rows, the 06-15 describe (run-time `quad` helper), the seeded property.
- `tests/unit/import/logins-country.test.ts` - the 06-15 tracer through the real worker.
- `tests/unit/import/logins-backfill.test.ts` - the stored-version-1 rebuild test.

## Decisions Made

See frontmatter `key-decisions`. No schema version, no string and no Playwright test was added.

## Deviations from Plan

None - plan executed as written. Notes, not deviations:

- `.planning/WINDOWS.md` was not touched (rows 8-9 are corrupt per the plan), and no stub, skipped test or unrun verify arose, so nothing needed recording there.
- The plan's per-task `pnpm run lint` was run as the whole-repo `prettier --check . && eslint .`; it passes.
- Task 2's acceptance diff-grep for the public quad was run against the BASE diff plus the working tree and exits 0 (the quad exists only as run-time parts).

## Verification

- `pnpm run test:unit`: 76 files, 2320 tests passed (includes ci-budget, phase6-guards, the 100 KB colon-run and 10,000-case fuzz tests unmodified).
- `pnpm run check` exit 0; `pnpm run lint` exit 0.
- `git diff --quiet 989a019 -- tests/helpers/login-oracle.ts src/lib/features/playtime` exits 0 (oracle independent, T-04-01 holds).
- `git log` shows each `test(06-15)` commit preceding its `fix(06-15)` commit.

## Known Stubs

None.

## Threat Flags

None. T-06-59 through T-06-62 are mitigated as registered (word count after expansion, final-token quad rule, version bump, run-time public quads).

## Issues Encountered

None.

## Self-Check: PASSED

- Commits found: 2ca61a7, 77e9609, 83e88b1, b046956, 50c9287, 154c8d5.
- Files found: all six modified files exist; `grep -c "export function buildLoginsExportOfAddresses"` is 1; `LOGINS_VERSION = 2` present.
