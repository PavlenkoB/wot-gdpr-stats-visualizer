---
phase: 05-vehicle-stats-financial-dashboards
plan: 19
subsystem: ui
tags: [svelte, ui-copy, identity, copy-contract, uat-gap]

requires:
  - phase: 03-dashboard-shell-account-identity
    provides: the three-field identity header, IDENTITY_REGION_LABEL and the D-13 raw-value rule
provides:
  - "IDENTITY_REGION_LABEL relabelled to 'Location code (per export)' (Phase 3 D-13 amended)"
  - "A unit guard that the region label cannot read as a game realm"
  - "An amended Phase 3 copy contract and decision record naming the new label"
affects: [03-ui-spec, 03-context, identity-header, uat]

actuals:
  tokens: 9000
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Relabel over hide or derive: a cosmetic gap in a displayed value is closed by the one string the user reads, never by widening the field it comes from"

key-files:
  created: []
  modified:
    - src/lib/ui-copy.ts
    - tests/unit/ui-copy.test.ts
    - src/lib/components/IdentityHeader.svelte
    - .planning/phases/03-dashboard-shell-account-identity/03-UI-SPEC.md
    - .planning/phases/03-dashboard-shell-account-identity/03-CONTEXT.md

key-decisions:
  - "RELABEL, do not hide and do not derive: IDENTITY-01 promises the region and eight e2e assertions depend on `identity-region`, and the export carries no realm field, so reading another Account_Info column would widen the deliberately narrow three-field identity (D-18/D-19/D-20)"
  - "The exported name `IDENTITY_REGION_LABEL` and the `identity-region` test id are unchanged, so both browser specs follow the new wording with no edit"
  - "The new wording is 'Location code (per export)': 'code' says the value is opaque, 'Location' avoids realm vocabulary, '(per export)' still attributes it to the file"

requirements-completed: [IDENTITY-01]

coverage:
  - id: D1
    description: "The identity header labels the raw REGION value as a location code rather than a game realm, with the value itself unchanged"
    requirement: IDENTITY-01
    verification:
      - kind: unit
        ref: "tests/unit/ui-copy.test.ts#identity header copy > the region label cannot be read as a game realm"
        status: pass
      - kind: e2e
        ref: "tests/e2e/dashboard.spec.ts#(identity-loaded) a sample import shows the full identity card"
        status: pass
    human_judgment: false
  - id: D2
    description: "The identity stays three fields; the worker identity module still reads no city or country-code column"
    verification:
      - kind: unit
        ref: "tests/unit/identity.test.ts"
        status: pass
      - kind: other
        ref: "! grep -n \"CITY\\|COUNTRY_CODE\" src/lib/worker/identity.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "The Phase 3 copy contract and decision record name the new label with a dated amendment, and the colour contract is undisturbed"
    verification:
      - kind: unit
        ref: "tests/unit/contrast.test.ts"
        status: pass
      - kind: other
        ref: "grep -c 'Location code (per export)' 03-UI-SPEC.md == 2; grep -c 'G-05-7' 03-CONTEXT.md == 1"
        status: pass
    human_judgment: false
  - id: D4
    description: "Reading the real personal export and confirming the header shows 'Location code (per export)' with the export's own value and nothing that reads as a game server"
    verification: []
    human_judgment: true
    rationale: "The real zip is personal data and must never enter the repository, so no automated instrument can run this; the plan declares it as an out-of-CI human check (UAT test 7)"

# Metrics
duration: 4 min
completed: 2026-10-02
status: complete
---

# Phase 5 Plan 19: Relabel the identity region field Summary

**The identity header now labels `Account_Info.REGION` as "Location code (per export)", keeping the value raw while retiring the wording that read as a game server**

## Performance

- **Duration:** 4 min
- **Started:** 2026-10-02T11:57:34Z
- **Completed:** 2026-10-02T12:01:03Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- `IDENTITY_REGION_LABEL` is now `'Location code (per export)'`; the value rendered beside it is still the raw `REGION` cell, never mapped (Phase 3 D-13 holds).
- A new unit test refuses a label that leads with "Region" and requires the word "code", so the realm reading cannot come back through a copy edit.
- The worker identity module is untouched and still reads only the three fields; the negative grep for `CITY`/`COUNTRY_CODE` in `src/lib/worker/identity.ts` is part of the verify command, not a promise.
- 46 e2e tests across `dashboard.spec.ts` and `identity-privacy.spec.ts` pass with no spec edited, because both assert the label through the constant.
- The Phase 3 copy contract and decision record carry the new label with dated amendment markers, in the same style as the earlier W-03 amendment, and D-13's original text is preserved verbatim.

## Task Commits

Each task was committed atomically (TDD RED -> GREEN for task 1):

1. **Task 1 RED: pin the label wording** - `ef86c6f` (test)
2. **Task 1 GREEN: relabel the constant and fix the component comment** - `d79c529` (feat)
3. **Task 2: amend the Phase 3 copy contract and decision record** - `d195bba` (docs)

## Files Created/Modified

- `src/lib/ui-copy.ts` - `IDENTITY_REGION_LABEL` value and doc comment
- `tests/unit/ui-copy.test.ts` - pinned label text plus the realm-reading guard
- `src/lib/components/IdentityHeader.svelte` - HTML comment above the region `dt`; no markup, class, test id or logic changed
- `.planning/phases/03-dashboard-shell-account-identity/03-UI-SPEC.md` - loaded-header layout step and the Copywriting Contract row
- `.planning/phases/03-dashboard-shell-account-identity/03-CONTEXT.md` - dated amendment under D-13

## Decisions Made

- Relabel rather than hide or derive, as the plan decided. Hiding would break IDENTITY-01 and the eight e2e assertions on `identity-region`; deriving would have to read another `Account_Info` column, which widens the three-field identity D-18/D-19/D-20 keep narrow, and the threat register's T-05-57 names exactly that risk.
- Kept the exported constant name and the `identity-region` test id, so no spec needed editing. The change is one string plus one comment.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## TDD Gate Compliance

RED (`ef86c6f`) precedes GREEN (`d79c529`). The RED run failed on the two named target tests with behavioural assertions - `'Region (per export)'` is not `'Location code (per export)'` and does start with `'Region'` - not on a load error or an unrelated assertion. The plan is `type: execute` with a TDD task rather than `type: tdd`, so no plan-level gate block applies.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- UAT G-05-7 is closed in code. The remaining optional human check is UAT test 7 (drop the local real export, read the header), which is outside CI because the zip is personal data.
- The relabelling is reversible with a one-line edit to the constant plus its pinned test string.

## Self-Check: PASSED

- Files verified present: `src/lib/ui-copy.ts`, `tests/unit/ui-copy.test.ts`, `src/lib/components/IdentityHeader.svelte`, both Phase 3 planning artifacts.
- Commits verified in `git log`: `ef86c6f`, `d79c529`, `d195bba`.
- All task acceptance criteria re-run green: 233 unit tests across the three named files, `pnpm run check`, `pnpm run lint`, 46 Playwright tests, and the two negative greps.

---
*Phase: 05-vehicle-stats-financial-dashboards*
*Completed: 2026-10-02*
