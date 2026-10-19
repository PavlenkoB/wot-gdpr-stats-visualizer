---
phase: 11-new-game-data
plan: 08
subsystem: ui
tags: [heat, warships, svelte5, windowing, copy, label-tables, account-tag, ip-mask, t-11-23, t-11-25, t-11-27, t-11-28]
requires:
  - phase: 11-new-game-data
    provides: "11-05's formatNewDataSkipped and provenance labels, 11-07's NewDataCardView, spec-only card views and pane state helpers"
provides:
  - HEAT_INTRO
  - WOWS_STORAGE_INTRO
  - HEAT_CARD_TITLES
  - WOWS_STORAGE_CARD_TITLES
  - HEAT_GEO_NOTE
  - HEAT_LOADING
  - WOWS_STORAGE_LOADING
  - HEAT_ERROR
  - WOWS_STORAGE_ERROR
  - NEW_DATA_FILE_LABELS
  - NEW_DATA_COLUMN_LABELS
  - formatNewDataColumnLabel
  - HEAT_BATTLE_TYPE_COLUMN_ID
  - formatNewDataCell
  - NewDataTable
  - NewDataCard
affects: [11-09, 11-10, 11-11]
tech-stack:
  added: []
  patterns:
    - "label tables keyed by record type and allowlisted column id, completeness proved by a cross-check against the worker spec table"
    - "one pure cell formatter shared by the table and the per-account dl blocks, so the null, number, battle-type and masked-address rules live in one place"
    - "plain-or-windowed table behind one {#each}: the plain mode is a window of the whole list with zero padding, spacers only above 500 rows"
key-files:
  created:
    - src/lib/features/new-data/NewDataTable.svelte
    - src/lib/features/new-data/NewDataCard.svelte
    - src/lib/features/new-data/new-data-cell.ts
    - tests/unit/new-data/new-data-blocks.test.ts
  modified:
    - src/lib/ui-copy.ts
    - tests/unit/shell/ui-copy.test.ts
    - tests/unit/import/multi-account-keys.test.ts
    - tests/helpers/components.ts
key-decisions:
  - "HEAT_BATTLE_TYPE_COLUMN_ID is 'GAME_MODE': 11-HEADERS.md names no column called a battle-type code, but GAME_MODE is 'the grouping key of the battle-types card' and the UI-SPEC puts formatBattleTypeLabel on that card's first cell."
  - "Cell rules live in new-data-cell.ts (formatNewDataCell), not in either component; an address-kind cell goes through displayIp and nothing else, and an address-kind value that is not a canonical address masks to the mask string instead of being echoed."
  - "A plain table is the same {#each} over drawn rows with an all-rows range and no padding; the two spacer rows exist only above 500 rows, so one block of markup serves both modes."
  - "The card orders nothing: it renders the rows it is given (the pane orders them with orderRowsByAccount), and the blocks layout takes the first row per account in that order."
  - "tests/helpers/components.ts lists features/new-data, so the keyed-each audit, the layout guards, the contrast test and the 14px-floor scan now cover the new components."
patterns-established:
  - "A column label that is missing falls back to the allowlisted id, never to a header from the archive."
requirements-completed: []
actuals:
  tokens: 16000
  tasks: 3
  commits: 3
metrics:
  duration: 15min
  completed: 2026-10-19
status: complete
commits: 3
plan_head_before: 1c61fca47f3826bc2e57230526b360a1a58758e7
plan_head_after: fe853ac1b106ea682f399fe5336bc5e3eb38547d
---

# Phase 11 Plan 08: Pane copy and card components Summary

The UI kit for the HEAT and Warships crews & storage panes is in place and unmounted: pinned copy and label tables cross-checked against the worker specs, one plain-or-windowed table with a sticky first column, tags only for several accounts and masked addresses, and a four-state card whose skipped state is a dashed sentence that names the file.

## What shipped

- **Copy and label tables (`ui-copy.ts`)**: `HEAT_INTRO`, `WOWS_STORAGE_INTRO`, the two card-title records, `HEAT_GEO_NOTE`, the two loading lines and the two fixed error sentences, all verbatim from the UI-SPEC and pinned in `ui-copy.test.ts`. `NEW_DATA_FILE_LABELS` maps the six pane file keys to the captured file names, and `NEW_DATA_COLUMN_LABELS` labels all 44 spec columns of those files. `formatNewDataColumnLabel(fileKey, id)` falls back to the id and reads own properties only, so `constructor` or `__proto__` is an unknown id, not a label. Tests walk `NEW_DATA_SPEC_FILES` and fail naming `file / column` when a label is missing, when a label key is not in the spec, and when a label still looks like a raw header.
- **Cell rules (`new-data-cell.ts`)**: `formatNewDataCell(cell, column, { revealed, battleTypeColumnId })` returns text and a muted flag. Null, undefined and empty are the muted words from `DEVICE_NOT_REPORTED`; address columns go through `displayIp`; the battle-type column reads `Battle type {code}`; numbers group through `formatNumber`; text and dates are shown as written.
- **`NewDataTable.svelte`**: a focusable named scroller (`data-testid="new-data-table"`, 480px, 3px focus ring), hidden caption, `th scope="col"` headings, sticky header and sticky opaque first column, fixed 40px rows. Up to 500 rows every row renders; above, `windowRange(scrollTop, SCROLLER_MAX_PX, rows.length)` picks the window and two spacer rows stand in for the rest. Spacer heights and the table min width are written through bound refs in an `$effect` that reads the derived values into locals first. Scroll resets when `rows` changes. The first cell starts with `AccountTag` only when the row's account is in a non-null tag map, flush against the text so a single-account cell holds no tag node and no whitespace text node; the first column is 32px wider only then, from one geometry record.
- **`NewDataCard.svelte`**: a `section` with `data-status`, a passed test id, an `h3` title, a `From {file}` caption for every state but `not-in-export`, an optional `header` snippet, and exactly one body: `DEVICE_TABLE_NOT_IN_EXPORT`, `formatDeviceNoRows(file)`, the skipped sentence in `data-testid="new-data-skipped"` inside a dashed `--faint` card on `--list`, or the table or per-account `dl` blocks (first row of each account, tag line only with tags).
- **Guards**: `new-data-blocks.test.ts` reads both components as text and pins the source-shape rules (no raw HTML, svg, media query, inline style, animation, console, network, live region or per-row listener; no attribute carrying a value; scale font sizes; keyed eaches by position) plus the cell rules as pure tests. Five rows were added to the keyed-each audit.

## Verification

- `pnpm run test:unit`: 113 files, 3637 tests pass.
- `pnpm run check`: 0 errors, 0 warnings. `pnpm run lint`: clean (Prettier and ESLint).
- The layout, contrast and keyed-each guards now scan the two new components; all pass.
- Not covered here, by design: the rendered proofs (DOM node count against the window, no horizontal overflow at 375px, no address in any attribute) belong to plan 11-11, and the visual reading of the four card states is the plan's human check after 11-09 mounts the panes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `tests/helpers/components.ts` did not list `features/new-data`**
- **Found during:** Task 2
- **Issue:** `componentPath` and `listComponentFiles` only search the listed folders, so the new components would be invisible to the source-shape tests and to the keyed-each audit, layout guards and contrast scan, which would then pass vacuously for them.
- **Fix:** added `'features/new-data'` to `COMPONENT_DIRS`.
- **Files modified:** tests/helpers/components.ts
- **Commit:** 064efc0

### Plan-shaped judgement calls

**2. `new-data-cell.ts` is a new file.** The plan asked for the shared cell formatting as "one small exported function in `new-data-state.ts`-style pure code". `new-data-state.ts` is documented as copy-free with type-only imports, so the function sits in its own module that imports copy and `displayIp`. Its tests are in `new-data-blocks.test.ts`.

**3. Keys named `rowIndex`, not `each rows`.** The windowed rows come from the derived `drawn` list, so the acceptance grep `each rows` finds nothing; the key is still the absolute row index and the audit row says why (rows repeat across accounts). `ROW_PX` is not imported by the table (the stylesheet declares the same 40px and a comment says so); an unused import would fail lint, and `SCROLLER_MAX_PX` and `windowRange` are the values the code reads.

**4. `HEAT_BATTLE_TYPE_COLUMN_ID` is `'GAME_MODE'`** (see key-decisions). If the real values turn out to be words rather than codes, the cell reads `Battle type {word}`; it is a one-constant change to null.

**5. The `ND` column label is "No decision".** 11-HEADERS.md calls `ND` only "a counter, on the same footing as the other battle totals", so the label is an interpretation. It is one string in `NEW_DATA_COLUMN_LABELS` if the export documents it differently.

TDD note: the copy tests were written first and failed (16 red), then the constants made them pass. For the two components the tests and the files were written together in the same task and committed together, so there is no separate RED commit for them.

## Known Stubs

None. Nothing in the new components takes empty or mock data; they are unmounted until plan 11-09 wires them to the `heat` and `warships-storage` channels, which is the plan's stated scope.

## Threat Flags

None. No network surface, no storage and no new dependency. T-11-25 (address only through `displayIp`, no cell in any attribute), T-11-26 (account text only inside the hidden tag phrase), T-11-27 (text interpolation only, no raw-HTML directive) and T-11-28 (windowed above 500 rows, no per-row SVG or listener) are mitigated and asserted by source-shape tests; the browser-side proofs are plan 11-11's. T-11-29 is satisfied by the fixed error constants, which plan 11-09 renders.

## Self-Check: PASSED

- FOUND: src/lib/features/new-data/NewDataTable.svelte, NewDataCard.svelte, new-data-cell.ts, tests/unit/new-data/new-data-blocks.test.ts
- FOUND commits: 18c61ac, 064efc0, fe853ac
