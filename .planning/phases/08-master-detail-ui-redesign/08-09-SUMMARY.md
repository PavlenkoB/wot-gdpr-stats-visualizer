---
phase: 08-master-detail-ui-redesign
plan: 09
subsystem: testing
tags: [playwright, e2e, master-detail, import, persistence, privacy]
status: complete

requires:
  - phase: 08-master-detail-ui-redesign
    provides: "the master-detail shell, the openSection/expectSelected helpers and the R1-R10 rules (08-02 to 08-07), and the migration approach proven in 08-08"
provides:
  - "tests/e2e/import/import-flow.spec.ts migrated to the two-pane shell: 7 listed tests, all green under chromium"
  - "tests/e2e/import/persistent-dataset.spec.ts migrated: 8 listed tests, all green"
  - "tests/e2e/import/import-failure.spec.ts migrated: 10 listed tests, all green"
  - "a privacy scan (import-flow (g)) that reads the body text of all eight panes"
affects: [08-10, 08-11, 08-12, 08-13, 08-14, 08-15, 08-16, 08-17, 08-18]

actuals:
  tokens: 7669
  tasks: 3
  commits: 3
plan_head_before: 4079061116cc655e3faf0c69de795c00c49350a4
plan_head_after: d8d7e6782c219797bf2829ef5cc701e09e9593bf
commits: 3

tech-stack:
  added: []
  patterns:
    - "A check that read every card at once becomes a loop over panes: openSection, then the same expected values"
    - "Always-mounted list rows are read alongside the open pane's import line so list and pane cannot disagree"
    - "A reload test asserts expectSelected(overview) and then re-opens the same panes to re-compare snapshots"

key-files:
  created: []
  modified:
    - tests/e2e/import/import-flow.spec.ts
    - tests/e2e/import/persistent-dataset.spec.ts
    - tests/e2e/import/import-failure.spec.ts

key-decisions:
  - "The Account list row is asserted by its location code and ACCOUNT_ROW_SUMMARY, not by formatRowSummary: paneEntries words that row differently from the folder rows, and the Account pane's own import line carries the folder counts"
  - "import-flow (a) loops six data panes (Login history as well as Playtime) because both views of Activity_history show the same counts"
  - "Privacy scan (g) loops all eight PANE_IDS, Overview and Not yet supported included, and asserts the account-id line in every body so a blank page cannot pass"

patterns-established:
  - "Snapshot helpers (snapshotImportLines, snapshotListRows, snapshotBanners) open panes in turn and assert the expected value before returning it, so a before/after comparison can never compare two wrong-but-equal readings"

requirements-completed: []

coverage:
  - id: D1
    description: "Import classification: the six data panes show the fixture counts through their import line and the matching list row, the eight rows are in PANE_IDS order, and the unsupported banners (status, folder, counts) are read from the Not yet supported pane"
    verification:
      - kind: e2e
        ref: "tests/e2e/import/import-flow.spec.ts#(a),(b),(h)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Privacy: neither the synthetic email domain nor the synthetic IP appears in the body text of any of the eight panes"
    verification:
      - kind: e2e
        ref: "tests/e2e/import/import-flow.spec.ts#(g)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Persistence: import lines, list rows and banners are identical across a reload that lands on Overview; the skip tag survives a reload; the 10x import reports per-category progress and stays responsive"
    verification:
      - kind: e2e
        ref: "tests/e2e/import/persistent-dataset.spec.ts#(a),(a-skip),(b),(c)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Destructive flows keep every claim (confirm copy, old data untouched until confirmed, IndexedDB really cleared, Clear hidden with no dataset, no native dialog), now with the controls in the list pane and the empty state hosting the dropzone after a clear"
    verification:
      - kind: e2e
        ref: "tests/e2e/import/persistent-dataset.spec.ts#(d),(e),(f),(g)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Failure handling: the banner has no link or button, a precheck rejection posts no worker message, the banner persists 1500 ms, a following valid import clears it, loads the identity header and moves the slim bar into the list pane"
    verification:
      - kind: e2e
        ref: "tests/e2e/import/import-failure.spec.ts#(a)-(j)"
        status: pass
    human_judgment: false
---

# Phase 8 Plan 09: Migrate the import specs to the master-detail shell Summary

**The three import specs (25 listed tests) now run against the two-pane shell with no assertion weakened: per-folder counts are read by opening each pane and from the always-visible list rows, the privacy scan covers all eight panes instead of one page, and the reload round trip lands on Overview and re-compares identical snapshots.**

## Performance

- **Duration:** about 8 min (2026-10-07T22:34Z to 22:43Z)
- **Tasks:** 3 (1 tracer, 2 auto)
- **Files:** 3 modified, 253 insertions and 117 deletions

## Accomplishments

- **Tracer (Task 1, import-flow (a) and (b)).** `(a)` keeps the busy/done stage feedback and adds that the dropzone is now inside `list-pane` (and absent from `detail-pane`). The five-card loop is a loop over six data panes: `openSection`, exactly one section mounted, `importLine` equals `formatImportSummary(fileCount, rowCount)` from the same fixture constants, and the matching list row contains `formatRowSummary` and `formatRowCount`. The eight `list-row-*` ids are asserted in `PANE_IDS` order, the Not yet supported pane is opened for the four banner assertions, and the pixel-position chain became two containment facts (identity header in `list-pane`, open section in `detail-pane`). `(b)` opens Not yet supported before counting five banners. `boundingBox` went from 5 uses to 0.
- **import-flow rest (Task 2).** `(f)` opens Playtime before reading the 2,500-file caption. `(g)` now loops every pane id, reading `body.innerText()` on each and asserting neither `example.invalid` nor `192.0.2.10` appears, plus the account-id sanity line on every pane. `(h)` asserts the empty state hosts the dropzone after Start over, then reads the five banners from the unsupported pane. `(d)` and `(e)` needed no change.
- **persistent-dataset (Task 2).** `(a)` snapshots the five folders' import lines pane by pane (Playtime stands for Activity_history), the eight list rows and the unsupported banners, reloads, asserts Overview is selected, and re-opens the same panes to compare. `(a-skip)` reads the Bans tag in Not yet supported, asserts zero skip tags in every data pane, and re-reads the tag after a reload. `(c)` opens Playtime before the 10x row-count assertion. `(d)` reads the five banners from their pane after the replace. `(e)` and `(f)` additionally assert the controls sit in `list-pane` and, after a clear, that the empty state hosts the dropzone.
- **import-failure (Task 3).** The file already passed on the new shell (all 10 tests), so only `(f)` was strengthened: after the valid import the banner count is 0, the slim bar sits inside `list-pane` and `empty-state` is gone. The header comment now describes the empty-state detail pane as the first-visit home.

## Task Commits

1. **Task 1 (tracer): import-flow (a) and (b)** - `7ac1fd6` (test)
2. **Task 2: rest of import-flow and persistent-dataset** - `2222ee4` (test)
3. **Task 3: import-failure** - `d8d7e67` (test)

## Replaced and deleted claims

| Old claim | Disposition | Reason |
| --------- | ----------- | ------ |
| Card tops increase in D-02 document order | Replaced: eight list rows in `PANE_IDS` order | Cards are never side by side |
| Header, first section and first banner tops strictly increase | Replaced: header in `list-pane`, section in `detail-pane` | Pixel order has no meaning in a two-pane layout |
| Page-wide `importLines` returns five elements | Replaced: exactly one import line per opened pane, five panes read in turn | Only the open pane's section is in the DOM |
| Privacy scan reads one `body.innerText()` | Strengthened: scans all eight panes | Otherwise it would only cover Overview |
| Page-wide skip-tag count is 1 | Kept for the unsupported pane, plus zero in each data pane | Page-wide sees only the open pane |

No test was deleted or added. Final listed counts (`playwright test --list`): import-flow **7**, persistent-dataset **8**, import-failure **10**, total **25** in 3 files.

## Deviations from Plan

None - plan executed exactly as written. Two notes, neither a deviation:

- The plan asks every data pane's list row to contain `formatRowSummary` and `formatRowCount`. The Account row is worded differently by `paneEntries` (location code headline and `ACCOUNT_ROW_SUMMARY`), so it is asserted by `SAMPLE_REGION` and `ACCOUNT_ROW_SUMMARY`; its folder counts are still asserted through the pane's import line.
- The plan expected `import-failure` to need fixes after a first run. It passed unmodified against the new shell, so the only change there is the strengthened `(f)` and a comment.

## Issues Encountered

None. The throwaway Playwright config (outside the repo) was used for every e2e run because the installed browsers do not match the pinned version; the repo's `playwright.config.ts` was not touched.

## Verification

- `pnpm exec playwright test -c <throwaway config> --project=chromium tests/e2e/import` - 25 passed (baseline before migration: 17 passed, 8 failed)
- `pnpm exec playwright test --project=chromium tests/e2e/import --list` - `Total: 25 tests in 3 files`
- `pnpm run check` - 0 errors, 0 warnings; `pnpm run lint` (prettier and eslint) - clean
- `grep -cE "dashboard-nav|nav-link-" tests/e2e/import/*.spec.ts` - 0 for every file; `grep -c boundingBox` on import-flow - 0

## Known Stubs

None.

## Threat Flags

None. T-08-29 is mitigated: `(g)` scans the body text of every pane id in a loop. T-08-30 is mitigated: every destructive-flow assertion is intact; only locators, waits and extra containment checks changed.

## Next Phase Readiness

Ready for 08-10.

## Self-Check: PASSED

- `tests/e2e/import/import-flow.spec.ts`, `persistent-dataset.spec.ts` and `import-failure.spec.ts` present; commits `7ac1fd6`, `2222ee4`, `d8d7e67` found in `git log`; `git rev-list --count 4079061..HEAD` is 3 before the SUMMARY commit.
