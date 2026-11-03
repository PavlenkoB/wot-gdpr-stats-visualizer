---
phase: 12-account-timeline-perks
plan: 06
subsystem: features
tags: [privacy, allowlist, email-guard, code-mask, shared-table, account-tags, unit-tests]
status: complete

requires:
  - phase: 12-04
    provides: "the promoted folders and the History-file family patterns whose specs 12-08 will write, on top of the mechanism this plan lands"
  - phase: 11-new-game-data
    provides: "the allowlist projection, the shared NewDataTable and the Phase 11 cell formatter this plan extends rather than forks"
provides:
  - "SpecFile.emailGuard / AllowlistSpec.emailGuard and looksLikeEmail: projectRow drops any cell whose VALUE looks like an email (and any over-long cell with an at-sign in its first 2,000 characters)"
  - "SpecColumnKind and NewDataColumnKind gain `code`; maskCode (import-free) and the formatNewDataCell code branch; cellOf exported with an explicit string-only code branch"
  - "NewDataRowView.accounts?, NewDataTable/NewDataCard severalTags prop, the w-code and *-many geometry classes, and the +N overflow node"
  - "tests/unit/new-data/code-mask.test.ts plus extended allowlist, aggregate, blocks and key-audit tests"
affects: [12-08, 12-09, 12-10, 12-11, 12-13, new-data-allowlist, new-data-table]

actuals:
  tokens: 21000
  tasks: 3
  commits: 3
commits: 3
plan_head_before: 75948790a01f2deb8783e8a2c52eda55a7826ff6
plan_head_after: 08194bcb36724dcca8320a60567e6c784cce919e

tech-stack:
  added: []
  patterns:
    - "A maskable column is declared by KIND in the spec and rendered only through formatNewDataCell, so a new column cannot reach the DOM unmasked by omission"
    - "One projectRow serves import and in-place narrowing, so a value-level guard is idempotent and the two paths cannot disagree"
    - "Flush inline chip markup (no whitespace text node) with position-keyed each blocks, mirrored from the Login table"

key-files:
  created:
    - src/lib/features/new-data/code-mask.ts
    - tests/unit/new-data/code-mask.test.ts
  modified:
    - src/lib/worker/new-data-specs.ts
    - src/lib/worker/new-data-allowlist.ts
    - src/lib/features/new-data/new-data-shared.ts
    - src/lib/features/new-data/new-data-aggregate.ts
    - src/lib/features/new-data/new-data-cell.ts
    - src/lib/features/new-data/NewDataTable.svelte
    - src/lib/features/new-data/NewDataCard.svelte
    - tests/unit/import/new-data-allowlist.test.ts
    - tests/unit/new-data/new-data-aggregate.test.ts
    - tests/unit/new-data/new-data-blocks.test.ts
    - tests/unit/import/multi-account-keys.test.ts

key-decisions:
  - "emailGuard is a SpecFile flag defaulting to off; no existing spec sets it, and a test fails if one does until plan 12-08 updates that single expectation"
  - "The over-long-cell check looks at the RAW head (2,000 characters) for an at-sign, because the 200-character clamp can cut an address in half and leave a fragment that no longer looks like one"
  - "maskCode counts code points, stops walking at eight, and returns at most five code points, so its output reflects neither the length nor more than two characters of a code"
  - "The several-tags first cell is a separate branch behind the severalTags prop; the single-tag markup is untouched, so HEAT and Warships DOM is byte for byte what it was"
  - "The key-audit scanner was widened to read inline {#each blocks, which surfaced two chip blocks (NewDataTable and the earlier LoginTable) that had never been audited"

patterns-established:
  - "Pinned geometry source-shape tests are updated in step with a geometry change rather than loosened"

requirements-completed: [PERKS-02, TIMELINE-02, PRIV-01]
duration: ~20 min
completed: 2026-10-20
---

# Phase 12 Plan 06: Header-independent building blocks Summary

**A value-level email guard in the allowlist projection, a `code` column kind with a pure `maskCode`, and the shared new-data table extended for merged-row account tags, all landed before any Phase 12 spec exists.**

## Accomplishments

- **Email guard (T-12-16).** `projectRow` leaves a cell absent when its value looks like an email, or when a cell longer than the clamp holds an at-sign in its first 2,000 characters. The flag is off for every current spec, the projection is idempotent, and `narrowStoredNewDataRows` needed no change because it calls the same function. `fileMatchesSpec` is unchanged.
- **Code kind and mask (T-12-17, T-12-18).** `maskCode('AB7K-QX42')` is `ABxxx`; seven characters, empty and non-strings are `xxx`; a 1,000-character code gives five characters; surrogate pairs are never split. `cellOf` is exported and keeps a code cell as its trimmed string (leading zeros survive). `formatNewDataCell` masks a code cell unless the single global reveal is on.
- **Shared table (T-12-19).** `severalTags` draws one chip per contributing account in identity-header order (three, hidden-phrase tags, then a muted plain-text `+N`), flush against the cell text, with a 64px first-column growth (32px for the existing single tag, unchanged). A single-account table and the HEAT and Warships panes keep their existing markup.

## Verification

- `pnpm exec vitest run tests/unit tests/unit/import`: 122 files, 3,867 tests passed.
- `pnpm run check`: 0 errors, 0 warnings. `pnpm run lint`: clean.
- `git diff` of `HeatPane.svelte` and `WarshipsStoragePane.svelte`: empty.
- Rendering at one, two, three and four accounts is proved in the browser by plan 12-13, not here; this plan's evidence is source-shape tests.

## Task Commits

1. Task 1, email guard: `5c3533f`
2. Task 2, code kind, mask, formatter branch: `811ecba`
3. Task 3, several-tags table and card: `08194bc`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The key-audit scanner could not see inline `{#each` blocks**
- **Found during:** Task 3
- **Issue:** `keyedEachBlocks` only matched a line that starts with `{#each`. The flush chip markup puts its blocks mid-line, so a `tagIndex` AUDITED row would have failed the "audit names no block that no longer exists" test, while no row at all left the keys silently unaudited.
- **Fix:** the scan now reads every `{#each ... (key)}` on a line. It then reported four unaudited chip blocks (two in `NewDataTable.svelte`, two already in `LoginTable.svelte` from Phase 9), and one `tagIndex` AUDITED row was added for each file.
- **Files modified:** `tests/unit/import/multi-account-keys.test.ts`
- **Commit:** `08194bc`

**2. [Rule 1 - Bug, test pin] A geometry source-shape pin named the old formula**
- **Found during:** Task 3
- **Issue:** `new-data-blocks.test.ts` pinned `index === 0 && tagged ? base + TAG_EXTRA_PX : base`, which the several-tags growth necessarily changes.
- **Fix:** the pin now expects the extended expression and the `SEVERAL_TAGS_EXTRA_PX = 64` constant; the single-tag cell markup pins are untouched.
- **Commit:** `08194bc`

**3. [Scheduling] The spec-kind test update landed in Task 1's commit**
- The `code` kind was added to the allowed-kinds set in `new-data-allowlist.test.ts` while that file was already open for Task 1; the type change itself is in Task 2. No behavioural effect.

**Total deviations:** 3 (1 blocking test-infrastructure fix, 1 pin update, 1 ordering note). **Impact:** none on the product code paths.

## Known Stubs

None. `severalTags` and `accounts` are optional, unused-until-12-09/12-11 seams by design (no stub data flows to the UI).

## Threat Flags

None. No network, auth or file-access surface was added; all four threats owned by this plan (T-12-16 to T-12-19) are mitigated as planned.

## Next Phase Readiness

Plan 12-08 sets `emailGuard: true` on the nine Phase 12 specs (and updates the one "no spec sets the flag" expectation), and declares code columns with kind `code`. Plans 12-09 to 12-11 pass `severalTags` and `accounts` and import the exported `cellOf`.

## Self-Check: PASSED

- Created files exist: `code-mask.ts`, `code-mask.test.ts`, this SUMMARY.
- Commits `5c3533f`, `811ecba`, `08194bc` are ancestors of HEAD.
- Acceptance greps verified: `emailGuard` in both worker files, `export function looksLikeEmail`, `export function maskCode`, `export function cellOf`, `maskCode` in the cell module, `w-code` in the table, `severalTags` in table and card, `accounts?:` in the shared module, zero `^import` lines in `code-mask.ts` and `new-data-shared.ts`.
