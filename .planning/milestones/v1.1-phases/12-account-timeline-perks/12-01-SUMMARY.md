---
phase: 12-account-timeline-perks
plan: 01
subsystem: testing
tags: [header-capture, allowlist, privacy, fixtures, pane-mapping]

requires:
  - phase: 11-new-game-data
    provides: "the header_capture.py output contract, CAPTURED_FILES and headersOf, and the names-only lint"
provides:
  - "header_capture_12.py: a values-free capture script scoped by folder, with a code-shape guard, proved on a synthetic archive"
  - "12-HEADERS.txt: the user's names-only capture of the Phase 12 families"
  - "CAPTURED_FILES extended with the nine Phase 12 files; COLUMN_RISK_ANSWERS, PANE_MAPPING and DATE_SHAPES as typed names-only constants"
  - "12-HEADERS.md: per-file allow/exclude tables, the Pane mapping, the completeness gate and the recorded user answers"
affects: [12-08, 12-10, 12-11, 12-13, new-data-specs]

actuals:
  tokens: 17700
  tasks: 3
  commits: 3
plan_head_before: 87b48eca0d5495f974fd18b64bf58493a05be69c
plan_head_after: 9a653cced1b701a2f387118867bb8771491ec3b9

tech-stack:
  added: []
  patterns:
    - "Header-only real-data contact: the user runs a script a test proved safe; only names, sizes and counts enter the repository"
    - "Risk answers, the pane mapping and date shapes are typed constants linted mechanically, so later plans derive counts from data instead of prose"

key-files:
  created:
    - .planning/phases/12-account-timeline-perks/header_capture_12.py
    - .planning/phases/12-account-timeline-perks/12-HEADERS.txt
    - .planning/phases/12-account-timeline-perks/12-HEADERS.md
    - tests/unit/guards/header-capture-script-12.test.ts
  modified:
    - tests/fixtures/new-data-headers.ts
    - tests/unit/guards/new-data-headers.test.ts

key-decisions:
  - "All nine Perks cards and timeline kinds are mapped; none was removed. Every row passed the completeness gate with a primary column (Language and country with a VALUE column that NAME discriminates)."
  - "Subscriptions maps on the single allowed column SUBSCRIBED, a TRUE/FALSE flag, because the user excluded SUBSCRIPTION as possible free text. The card can show only subscribed or not. Flagged for review."
  - "Roles follow the plan's deterministic rule (first allowed non-date column in file order is the primary), so Name's primary is OLD_NAME, Service's is OPERATION and Personal coupons' is STATUS."
  - "A scan flag that was not raised is recorded no; a column the user called possibly free text is unsure; nothing was left unanswered."
  - "Any file may hold exact duplicate rows within one account (the user's scan found some in Subscriptions and Personal_Coupons)."

patterns-established:
  - "Rules (d), (e) and (g) are asserted on the typed mapping: a mapped column cannot be yes or unsure for email, person name or free text, and address and code columns only sit in their admitted files"

requirements-completed: [TIMELINE-01, TIMELINE-02, PERKS-01, PERKS-02, PERKS-03, PRIV-01]

coverage:
  - id: D1
    description: "A values-free capture script, proved on a synthetic archive to print no cell, code, email, root number, Account_Info line or Game_Forums line"
    requirement: "PRIV-01"
    verification:
      - kind: unit
        ref: "tests/unit/guards/header-capture-script-12.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "The user's real headers committed as names-only constants with a lint, plus the typed risk answers, pane mapping and date shapes"
    requirement: "PRIV-01"
    verification:
      - kind: unit
        ref: "tests/unit/guards/new-data-headers.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "The column decision tables and Pane mapping in 12-HEADERS.md"
    requirement: "TIMELINE-01"
    verification: []
    human_judgment: true
    rationale: "The allowlist is Claude's discretion (CONTEXT); a human reads the allow rows and compares the JSON record with the constants before plan 12-08 starts."

duration: ~3h wall clock across two sessions (checkpoint wait included)
completed: 2026-10-20
status: complete
---

# Phase 12 Plan 01: Header capture and column decisions Summary

**The user's real column names for the nine Phase 12 files are captured values-free, committed as typed constants with a mechanical lint, and turned into per-column allow/exclude tables and a nine-row pane mapping that plans 12-08 to 12-13 build on.**

## Performance

- **Duration:** about 3 hours wall clock across two sessions (includes the human-action checkpoint)
- **Completed:** 2026-10-20
- **Tasks:** 3 (Task 2 was the user's checkpoint)
- **Files modified:** 6

## Accomplishments

- A capture script that scopes by folder and refuses anything that is not identifier-only or looks like a code, with a guard test that plants canaries and proves none reaches the output.
- The user's capture (13 FILE groups: nine distinct Phase 12 files across three accounts) as `12-HEADERS.txt`, and the typed constants in `tests/fixtures/new-data-headers.ts`.
- `12-HEADERS.md`: user answers, a machine-readable JSON record equal to the typed constants, nine decision tables, the Pane mapping, the completeness gate result, and date-shape notes.
- Lint tests that re-check, on every run, rules (d), (e) and (g) against the mapping: no mapped column may be yes or unsure for email, person name or free text, addresses sit only in Bans, Authorized_Third_Parties and Bonus_Code_Usage, and codes only in Personal_Coupons and Bonus_Code_Usage.

## Task Commits

1. **Task 1: values-free capture script and its safety guard** - `c46d9e9` (feat)
2. **Task 2: user runs the script on the real export** - no commit (human action; output committed with Task 3)
3. **Task 3: transcribe the capture and write the decision tables**
   - RED: `a4e8fb7` (test)
   - GREEN: `9a653cc` (feat)

**Plan metadata:** the docs commit that carries this file.

Note on `plan_head_before`: Task 1 ran in an earlier session and plans 12-04 and 12-05 committed on the same branch before Task 3. `git rev-list --count 87b48ec..HEAD` therefore reports more than 3, because it includes nine commits that belong to plans 12-04 and 12-05. The three commits above are this plan's (`git log --grep='(12-01)'`).

## Files Created/Modified

- `.planning/phases/12-account-timeline-perks/header_capture_12.py` - the capture script the user ran
- `tests/unit/guards/header-capture-script-12.test.ts` - safety proof on a synthetic archive
- `.planning/phases/12-account-timeline-perks/12-HEADERS.txt` - the raw names-only capture
- `.planning/phases/12-account-timeline-perks/12-HEADERS.md` - decision tables, Pane mapping, answers, notes
- `tests/fixtures/new-data-headers.ts` - Phase 12 files plus COLUMN_RISK_ANSWERS, PANE_MAPPING, DATE_SHAPES
- `tests/unit/guards/new-data-headers.test.ts` - lint cases for the new files and constants

## Decisions Made

See `key-decisions` above. The two that matter downstream: Subscriptions is a flag-only card, and roles follow the deterministic rule rather than display preference.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Extra mapping fields and a wider DATE_SHAPES scope**
- **Found during:** Task 3
- **Issue:** The plan's PANE_MAPPING row has no place for up to two secondary columns or for the NAME column that says whether `Language_And_Country_History.VALUE` holds a language or a country. Without them the typed constants could not match the Pane mapping table. The plan also scopes DATE_SHAPES to timeline date columns, but the user gave shapes for the Perks files too, and the Perks rows have a date column.
- **Fix:** Added `secondary` and `discriminator` fields to PANE_MAPPING rows. DATE_SHAPES holds every captured date column and the lint requires its file to be a mapped row (timeline or Perks) rather than a timeline row only.
- **Files modified:** tests/fixtures/new-data-headers.ts, tests/unit/guards/new-data-headers.test.ts
- **Committed in:** 9a653cc

---

**Total deviations:** 1 auto-fixed (Rule 2)
**Impact on plan:** additive; no plan consumer is broken, and the plan-named fields are all present.

## Issues Encountered

None.

## Authentication Gates

None. Task 2 was a planned human-action checkpoint (the user ran the script on their own zip); no agent ever opened the zip.

## Known Stubs

None.

## Threat Flags

None. No network endpoint, auth path, file access or schema change was added.

## Self-Check: PASSED

- Files exist: header_capture_12.py, 12-HEADERS.txt, 12-HEADERS.md, header-capture-script-12.test.ts, new-data-headers.ts, new-data-headers.test.ts.
- Commits exist: c46d9e9, a4e8fb7, 9a653cc.
- `pnpm exec vitest run tests/unit/guards` passes (17 files, 311 tests); `pnpm run lint` and `pnpm run check` exit 0.
- Acceptance greps: 13 FILE lines, 13 HDR lines, 0 import lines in the fixture module, no at-sign in the capture or decision file.
