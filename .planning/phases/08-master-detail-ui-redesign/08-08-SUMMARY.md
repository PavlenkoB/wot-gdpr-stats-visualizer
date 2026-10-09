---
phase: 08-master-detail-ui-redesign
plan: 08
subsystem: testing
tags: [playwright, e2e, master-detail, shell, svelte]
status: complete

requires:
  - phase: 08-master-detail-ui-redesign
    provides: "the master-detail shell, the openSection/ensureListScreen/expectSelected helpers and the R1-R10 rules (08-02 to 08-07)"
provides:
  - "tests/e2e/shell/dashboard.spec.ts migrated to the two-pane shell: 41 listed tests, all green under chromium"
  - "per-pane re-derivation of the heading, provenance, button and details counts of the old Activity/Player/Financial/Payment/User_Info cards"
  - "a list-row based 'old dataset still on screen' comparison for the app-state matrix"
affects: [08-09, 08-10, 08-11, 08-12, 08-13, 08-14, 08-15, 08-16, 08-17, 08-18]

actuals:
  tokens: 13750
  tasks: 3
  commits: 3
plan_head_before: 80b55363b5d5164f1500855950f4efb8ae282580
plan_head_after: 66dc4157ff55163de9249bffc022e51b99ca14f6
commits: 3

tech-stack:
  added: []
  patterns:
    - "A check that read all cards at once becomes a loop over panes: openSection, then the same expected values"
    - "Always-on-screen list rows carry the 'old dataset survives' comparison; the open section is compared as well"

key-files:
  created: []
  modified:
    - tests/e2e/shell/dashboard.spec.ts

key-decisions:
  - "The Activity_history card's 8 buttons are re-asserted as 0 on Playtime plus 8 on Login history, so the total of 8 still holds and the split is named"
  - "(skip) keeps its 'no other folder claims a skip' claim by opening every other pane and asserting no skip tag, because a page-wide count only sees the open pane now"
  - "The app-state matrix compares list-row text (rowSummaries) instead of section captions: rows are always mounted, sections are not"

patterns-established:
  - "Retire a single-scroll claim by replacing it with its new-contract equivalent in the same test, never by deleting the test"

requirements-completed: []

coverage:
  - id: D1
    description: "Identity fallbacks and DATA-04 absent-versus-empty wording are proven through the list-pane header and the opened Payments and Account panes"
    verification:
      - kind: e2e
        ref: "tests/e2e/shell/dashboard.spec.ts#(identity-loaded),(absent),(empty),(fallback),(empty-user-info),(partial-row),(multi-row),(case-sum)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Each data pane shows its pane title, a provenance line naming the canonical folder, its counts, and its own button and details set; no pane carries a collapse control"
    verification:
      - kind: e2e
        ref: "tests/e2e/shell/dashboard.spec.ts#(sections-pending)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Single-scroll claims are replaced by their new-contract equivalents: eight muted rows on a first visit, rows in PANE_IDS order, zero sections mounted during a first import and on Overview"
    verification:
      - kind: e2e
        ref: "tests/e2e/shell/dashboard.spec.ts#(skeleton),(order),(busy),(cache-check-window)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Import region, confirm panel and the app-state matrix keep their assertions; live regions are two on Overview plus one per opened block (R5)"
    verification:
      - kind: e2e
        ref: "tests/e2e/shell/dashboard.spec.ts#(slim-variant),(start-over),(confirmed-clear),(duplicate),(replace-in-flight),(failed-replace),(first-error),(cleared),(return-visit),(drop-during-confirm),(stray-drop),(phone-375)"
        status: pass
    human_judgment: false
  - id: D5
    description: "An untrusted folder name renders as text and creates no element in the unsupported pane, the list, the Overview or the detail pane"
    verification:
      - kind: e2e
        ref: "tests/e2e/shell/dashboard.spec.ts#(markup),(banners-sample),(banners-renamed),(skip)"
        status: pass
    human_judgment: false
---

# Phase 8 Plan 08: Migrate dashboard.spec.ts to the master-detail shell Summary

**All 41 tests of the shell, import-region and app-state spec now run against the two-pane shell with no assertion weakened: the all-cards checks became one-pane-at-a-time loops, the single-scroll claims became row/mount claims, and the live-region count is two on Overview plus one per opened block.**

## Performance

- **Duration:** about 6 min of tool time (2026-10-07T22:27Z to 22:33Z)
- **Tasks:** 3
- **Files:** 1 modified, 397 insertions and 203 deletions

## Accomplishments

- **Tracer (Task 1).** `(sections-pending)` loops the six data panes. Per pane it checks one section mounted, the data-status (ready for four, pending for Account), the `h2` equal to `PANE_TITLES[pane]`, a provenance line starting `From <folder> ·`, the import line text, no skip tag, and the real DOM's buttons and details (Playtime 0 buttons and the two `about-*` details; Login history the mask toggle, six sort buttons and the city Load button for 8 in total, plus `about-map` and `country-list`; Vehicles six sort buttons and exactly two details; Account no details). `(skeleton)` now asserts the skeleton header and all eight rows muted with their pane title and the not-loaded wording. `(absent)` reads the Payments pane and then opens every other pane to keep its status and un-muted row.
- **Identity and block describes (Task 2).** The identity tests that read the section (`(empty)`, `(fallback)`, `(empty-user-info)`, `(case-sum)`, `(case-variants)`) open the Account or Payments pane first, and `(empty)` also checks the row says the same words. Banner tests open the Not yet supported pane. `(skip)` opens every other pane to prove no other folder claims a skip tag, then reloads (landing on Overview) and reopens the pane. `(markup)` is stronger than before: the chip count, the Overview, the list pane and the whole detail pane hold zero created elements, and the folder name is shown literally in the pane.
- **Import region and state matrix (Task 3).** `(busy)` asserts zero mounted sections during a first import and one live region; `(slim-variant)` asserts the bar sits in the list pane, two live regions on Overview, then three for each of Playtime, Vehicles and Login history with the other two blocks' status lines absent. The matrix compares `rowSummaries` (list-row text); `(failed-replace)` also opens Finance and compares its import line before and after the failure and again after a reload. `(cache-check-window)` swaps the retired nav for `list-pane`/`list-nav` and checks eight rows and zero sections once resolved.

## Task Commits

1. **Task 1 (tracer): identity, sections, skeleton and absent** - `9ef94e6` (test)
2. **Task 2: identity variants and not-yet-supported block** - `982d15d` (test)
3. **Task 3: import region, confirm panel, state matrix, cache check** - `66dc415` (test)

## Replaced and deleted claims

| Old claim | Disposition | Reason |
| --------- | ----------- | ------ |
| Every card is `not-loaded` on a first visit (`(skeleton)`) | Replaced: eight muted rows with the not-loaded wording, no section mounted | No section exists on a first visit |
| Six cards in document order (`(order)`, `sectionIdsInOrder`) | Replaced: eight list rows in `PANE_IDS` order, Not yet supported last | The cards are never side by side now |
| `[aria-live]` count 5 after an import (`(slim-variant)`) | Replaced: 2 on Overview, 3 for each of the three own-status panes (R5) | The three status lines exist only while their block is mounted |
| Page-wide skip-tag count of 1 (`(skip)`) | Kept for the open pane, plus a zero count on every other pane | Page-wide now sees only the open pane |
| `sectionSummaries` (all import lines at once) | Replaced by `rowSummaries` on the list rows, plus an open-section read in `(failed-replace)` | Rows are always mounted; sections are not |
| `section count == SUPPORTED_IDS.length + 1` (`(busy)`, `(cache-check-window)`) | Replaced: zero sections (and eight rows after the cache check) | Sections mount per pane |
| `dashboard-nav` visibility (`(cache-check-window)`) | Replaced by `list-pane`/`list-nav` | Nav retired in 08-07 |

No test was deleted. The final listed count is **41** (`playwright test --list` prints `Total: 41 tests in 1 file`), unchanged.

## Deviations from Plan

None - plan executed exactly as written. One note, not a deviation: `importLines` stayed imported until Task 3 so the intermediate Task 1 and 2 commits type-check, then it was removed together with the other unused helpers.

## Issues Encountered

None. The only non-pane failures seen mid-way were `(empty)` and `(first-error)` being matched by the Task 1 `-g` filter before their own tasks had migrated them.

## Verification

- `pnpm exec playwright test -c <throwaway config> --project=chromium tests/e2e/shell/dashboard.spec.ts` - 41 passed
- `pnpm exec playwright test --project=chromium tests/e2e/shell/dashboard.spec.ts --list` - `Total: 41 tests in 1 file`
- `pnpm run check` - 0 errors, 0 warnings; `pnpm run lint` (prettier and eslint) - clean
- `grep -cE "dashboard-nav|nav-link-|scrollIntoView" tests/e2e/shell/dashboard.spec.ts` - 0; `grep -c openSection` - 23
- Other specs were not run (they stay red until 08-09 to 08-18).

## Known Stubs

None.

## Threat Flags

None. T-08-27 and T-08-28 are mitigated: every rewritten loop keeps its expected values, and `(markup)` now proves zero created elements on four surfaces.

## Next Phase Readiness

Ready for 08-09.

## Self-Check: PASSED

- `tests/e2e/shell/dashboard.spec.ts` present; commits `9ef94e6`, `982d15d`, `66dc415` found in `git log`; `git rev-list --count 80b5536..HEAD` is 3 before the SUMMARY commit.
