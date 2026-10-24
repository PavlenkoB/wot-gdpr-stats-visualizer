---
phase: 13-overview-personal-insights
plan: 15
subsystem: testing
tags: [wargaming, vehicle-table, terms-of-use, attribution, vitest, playwright, worker-bundle]
status: complete

requires:
  - phase: 13-overview-personal-insights
    provides: the fail-closed generator, empty module and lookup (13-02), the footer and its OVERVIEW_ATTRIBUTION_* constants (13-12), the ci-budget reconciliation (13-14)
provides:
  - the maintainer-generated vehicle table (1,035 rows, tier 1 to 11) committed behind the Terms-of-Use gate
  - committed-table unit tests (count, hash, per-row rules, unique ids and keys, lookup agreement, size guard)
  - one listed browser test proving real tanks resolve and the footer carries the approved notice
affects: [phase-13-verification]

requirements-completed: [INSIGHT-06]

actuals:
  tokens: 20200
  tasks: 3
  commits: 1
plan_head_before: bee3e080b916ec0383d7373a4e8a7d89c2a83d5d
plan_head_after: a351794c63a27a5e0929cb06001a65df0836cdf8

tech-stack:
  added: []
  patterns:
    - "Committed-data tests import the generator's own MAX_TIER, VEHICLE_TYPES and validateRows, so the test and the generator cannot drift apart"
    - "A real-data table is verified by a different instrument than it was produced by: the offline --check, a vitest re-validation, and a dist scan"

key-files:
  created: []
  modified:
    - src/lib/features/overview/vehicle-table.generated.ts
    - src/lib/features/overview/vehicle-table.ts
    - scripts/vehicles/lib/vehicle-table-build.ts
    - tests/unit/overview/vehicle-table.test.ts
    - tests/unit/overview/vehicle-lookup.test.ts
    - tests/unit/guards/vehicle-table-guard.test.ts
    - tests/e2e/shell/overview-insights.spec.ts

key-decisions:
  - "Task 1 answered approved-proposed-wording: the human read the Wargaming developer agreement and API Policy and approved committing the vehicle data to this public repository with the CURRENT attribution constants unchanged (OVERVIEW_ATTRIBUTION_TEXT 'Tank names, nations and classes: Wargaming.net API data.', OVERVIEW_ATTRIBUTION_NOTICE '© Wargaming.net. All rights reserved.', link text 'World of Tanks', href https://worldoftanks.eu/). ui-copy.ts and overview-copy.test.ts were therefore not touched."
  - "The committed-table row rule imports MAX_TIER (11) from the generator lib instead of hard-coding a tier ceiling"

coverage:
  - id: D1
    description: "Real Wargaming vehicle table committed after the Terms-of-Use gate, 1,035 rows, valid offline"
    requirement: INSIGHT-06
    verification:
      - kind: other
        ref: "pnpm run vehicles:table:check (count=1035)"
        status: pass
      - kind: unit
        ref: "tests/unit/overview/vehicle-table.test.ts#the committed module"
        status: pass
      - kind: unit
        ref: "tests/unit/guards/vehicle-table-guard.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Real classes resolve in the browser and the footer carries the approved notice and link without a request"
    requirement: INSIGHT-06
    verification:
      - kind: e2e
        ref: "tests/e2e/shell/overview-insights.spec.ts#(table) real tanks resolve through the committed table"
        status: pass
    human_judgment: false
  - id: D3
    description: "Licence approval and attribution wording"
    verification: []
    human_judgment: true
    rationale: "A legal reading of the Wargaming developer agreement and API Policy cannot be automated; the human gave it at the Task 1 blocking-human gate"

duration: 40min
completed: 2026-10-23
---

# Phase 13 Plan 15: Real tank table behind the Terms-of-Use gate Summary

**The maintainer-generated Wargaming vehicle table (1,035 rows, tier I to XI) is committed once, inlined in the worker chunk (+55 KB raw, +20 KB gzip, main bundle unchanged), and real class and tank names resolve in the browser while invented tags keep their tag-derived fallback.**

## Performance

- **Duration:** about 40 min for Task 3 (Tasks 1 and 2 were the human's)
- **Completed:** 2026-10-23
- **Tasks:** 3 of 3 (Task 1 decision, Task 2 human action, Task 3 auto)
- **Files modified:** 7

## Accomplishments

- Terms gate passed by a person (Task 1) and the maintainer ran `pnpm run vehicles:table` with their own application id (Task 2). The executor never read the env file, never called the API and never hand-edited the generated file.
- Verified the output offline: `pnpm run vehicles:table:check` exits 0 with count=1035; the file is 65,158 bytes (under the 120 KB guard).
- Committed-table tests: at least 500 rows and `count` equals the row count; META hash equals `rowsHash` of the rows; `validateRows` passes and the per-row rules are stated explicitly (id, key shape, class in the five, tier 1 to `MAX_TIER`, name length and characters); ids and keys unique; `defaultVehicleLookup.size` equals the count; `byTag` and `byId` agree on the first and last row; the module text has no import, URL or key.
- One new listed browser test, `(table) real tanks resolve through the committed table: the class tile appears and the footer carries the approved notice`: with `tanks: 'known'` the Favourite class tile is visible with its 'Class known for' sentence, the most-played tank reads the table name 'Type 64' (table spells it with a space, the fallback does not), the footer holds the approved text and notice, the link has the approved text, href, `target=_blank` and a `noopener` rel, and no request to the link's host was made before any click.

## Task Commits

1. **Task 1: Terms and attribution gate** - answered `approved-proposed-wording` by the human (no commit)
2. **Task 2: run the generator** - done by the human (no commit of its own; the file is part of the Task 3 commit)
3. **Task 3: verify, test, prove and commit** - `a351794` (feat)

Fixes made during the checkpoint, before this plan's ledger started (13-02 code): `6ded76d` (hyphen in a tag), `5b2f345` (name the offending tier value), `bee3e08` (tier XI).

## Shipped shape (Task 3, step 5)

Built worker chunk `ingest.worker-*.js`, same build, only the generated module differing:

| Build | Raw bytes | Gzip bytes |
|-------|-----------|------------|
| Empty table (HEAD before this commit) | 4,763,530 | 986,515 |
| Full table (1,035 rows) | 4,820,175 | 1,006,927 |
| Increase | 56,645 (55.3 KB) | 20,412 (19.9 KB) |

The plan expected roughly 57 KB raw and 19 KB gzip; measured is in line. The main bundle `index-*.js` stayed 441.21 kB (gzip 148.12 kB) in both builds, so the table is worker-only as D-08 requires. The dist scan in `vehicle-table-guard.test.ts` passes (no key literal, no API host).

## Verification

- `pnpm run vehicles:table:check`: exit 0, count=1035.
- `pnpm run test:unit`: 157 files, 4,746 passed, 9 expected fail.
- `pnpm run check` 0 errors 0 warnings; `pnpm run lint` clean (prettier and eslint); `pnpm run build` exit 0.
- FULL `pnpm exec playwright test`: 272 passed, 0 failed (1.4 min). `playwright test --list`: Total 272 tests in 32 files, under the 273 ceiling; `ci-budget.test.ts` 8 passed.
- Committing: only source files staged; no env file was ever staged; tree clean after the commit.

## Decisions Made

- Attribution wording unchanged (see key-decisions). The footer markup, `ui-copy.ts` and `overview-copy.test.ts` were not touched because the exact-string tests already pin the approved wording.
- The tier rule in the plan ("1 to 10") is out of date; Wargaming added tier XI (tank 6017). The committed-table rule is tier 1 to `MAX_TIER` (11), imported from `scripts/vehicles/lib/vehicle-table-build.ts`; the generator and the lookup share the value and a test holds them equal.

## Deviations from Plan

**1. [Rule 1 - Bug, in 13-02 code] A tag may contain a hyphen.** Found at the Task 2 checkpoint: the real tag `R04_T-34` was refused by the generator's tag rule. Fix `6ded76d` accepts a hyphen in a tag and makes the refusal name the character that failed. Cause: the 13-02 tests used invented tags with no hyphen, so the real data was the first to hit the rule.

**2. [Rule 1 - Bug, in 13-02 code] The generator's refusals named neither the offending character nor the value.** Fix `5b2f345` names the offending tier value (and, per deviation 1, the character) without echoing payload strings. Cause: same as above, the failure only showed on real data.

**3. [Rule 1 - Bug, in 13-02 code] Tier XI.** Found at the checkpoint: tank 6017 is tier 11 and the generator and lookup refused tiers above 10. Fix `bee3e08` raised both to `MAX_TIER = 11`, held equal by a test. This also supersedes the plan's "tier 1 to 10" row rule (see Decisions Made). Cause: the 13-02 tests used invented tiers inside 1 to 10.

**4. [Rule 1 - Test assumed the empty table] Four tests hard-coded the empty state.** `vehicle-table.test.ts` ("accepts the committed module, which is the empty form" and "holds no vehicle rows"), `vehicle-lookup.test.ts` ("answers nothing yet") and `vehicle-table-guard.test.ts` ("holds no vehicle rows") failed once the real table landed. They now assert the committed state (count at least 500, a real tag and id resolve, invented tags and ids still miss). No privacy or structural assertion was weakened: the plain-data, no-import, no-URL and no-key checks are unchanged and extended. No e2e assertion and no worker test needed a change (the invented default tags stay unknown, so the class tile is still absent in the default archive).

**5. [Rule 1 - Stale prose] The generator's header template and a lookup docstring said the table was empty.** `renderModule` wrote "Attribution: pending ... holds NO vehicle rows until that checkpoint passes", and `vehicle-table.ts` said the same. Both rewritten to state the approved footer attribution and the fallback. The committed `vehicle-table.generated.ts` still carries the OLD header text (lines 5 to 10), because that file is never hand-edited and no API call was allowed; the next `pnpm run vehicles:table` run rewrites it. The header is comment-only, so the count, hash and rows checks are unaffected.

**6. [Rule 1 - Lint] `no-control-regex`.** The first draft of the name-character test used a control-character regex; ESLint rejected it and it became a char-code loop. Fixed before commit.

**Total deviations:** 6 (all Rule 1; three of them are 13-02 code that the real data exposed). **Impact:** no scope creep; the plan's goal is met.

## Issues Encountered

- The prior `dist/` held a worker chunk of 282,583 bytes (a different earlier build), so the empty-table baseline was measured by building with the HEAD (empty) module temporarily in place and restoring the generated file afterwards from a copy (`git status` and `vehicles:table:check` confirmed the restore: count=1035).

## Known Stubs

None.

## Threat Flags

None. T-13-41 (key leak): the maintainer ran the generator, the dist and src scans pass, no env file staged. T-13-42 (tampered table): offline check, `validateRows` re-run in vitest and unit hash test; file not hand-edited. T-13-43 (licence): blocking-human gate answered `approved-proposed-wording` before generation.

## Human check carried forward

Still open from 13-12 (not closed by this plan): the MOTION FEEL of expand and pin on the Overview (the 0.26 s view transition, the anchored scroll, the pin move) cannot be judged headless; a person at a real screen must judge it. It is already in the WINDOWS ledger as an unrun verification.

## Self-Check: PASSED

- `src/lib/features/overview/vehicle-table.generated.ts`, `tests/unit/overview/vehicle-table.test.ts`, `tests/e2e/shell/overview-insights.spec.ts`: present
- commit `a351794` is an ancestor of HEAD; `6ded76d`, `5b2f345` and `bee3e08` are ancestors of HEAD
