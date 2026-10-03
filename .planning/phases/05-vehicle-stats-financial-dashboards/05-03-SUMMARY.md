---
phase: 05-vehicle-stats-financial-dashboards
plan: 03
subsystem: worker-classification
tags: [classification, replay, cached-dataset, dashboard-status, ui-copy, fixtures, playwright]

# Dependency graph
requires:
  - phase: 04-activity-history-dashboard
    provides: the single long-lived worker, resultFromMeta replay paths, db.verno 2 with its v1 wipe upgrader, and a cached-dataset population that stores pre-Phase-5 statuses
  - phase: 03-dashboard-shell-account-identity
    provides: SECTIONS / NAV_ORDER / BUILT_DASHBOARDS, SECTION_TITLES as a Record<NavId,string>, and the four-section / five-link claims this plan amends
  - phase: 05-vehicle-stats-financial-dashboards (05-01)
    provides: PREMIUM_HEADER and CURRENCY_OPS_HEADER — the authority for the sample's financial CSV headers
provides:
  - Financial_data as a supported category, classified on import
  - sortCategoryEntries, the comparator analyzeExport already used, now shared with the replay path
  - resultFromMeta re-classifies every stored category on replay (T-05-05), with no Dexie version bump
  - tests/helpers/worker-harness.ts, a reusable fake-self worker driver for 05-07
  - Five SECTIONS and six NAV_ORDER entries with financial-data third
  - A shared sample export carrying two real-header Financial_data CSVs
affects: [05-06, 05-07, 05-09, 05-10, 05-12, 05-15, classify.ts rootless-first ordering]

# Actuals
actuals:
  tokens: 21146
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Derived-at-replay over migration: a stale DERIVED label in a cache is repaired at read time, never by a schema bump"
    - "One comparator, two callers: sortCategoryEntries is imported by both analyzeExport and resultFromMeta so an import and a replay cannot order the same archive differently"

key-files:
  created:
    - tests/helpers/worker-harness.ts
    - tests/unit/replay-reclassify.test.ts
  modified:
    - src/lib/worker/categories.ts
    - src/lib/worker/classify.ts
    - src/lib/worker/ingest.worker.ts
    - src/lib/dashboard-status.ts
    - src/lib/ui-copy.ts
    - tests/fixtures/export-fixtures.ts

key-decisions:
  - "Re-derive status at replay instead of bumping Dexie: the user's rows are valid and only a label is stale, so version(3) would discard a cached dataset to fix a word"
  - "Extract the comparator rather than duplicate it: a replay sorting by anything else would reorder the same export across a page reload"
  - "Derive the unsupported-banner boundary from SAMPLE_EXPECTED_COUNTS.supported: the old literals still passed while comparing the wrong folder against the wrong data-status"
  - "Transcribe the two finance headers locally rather than importing them: the import closes a real cycle, and a new lockstep test over the real sample bytes guards the copy"

patterns-established:
  - "Pattern: replay re-classification — map every stored category through classifyFolder, sort, THEN derive counts; deriving counts first reports supported 4 over a list whose five entries all say supported"
  - "Pattern: shared worker harness — install the fake self and call vi.resetModules BEFORE the dynamic import, then import db.ts through the same reset registry so the test and the worker share one Dexie singleton"

requirements-completed: [FINANCE-01, FINANCE-02]

coverage:
  - id: D1
    description: "Financial_data classifies as supported on import, and counts.supported includes it"
    requirement: FINANCE-01
    verification:
      - kind: unit
        ref: "tests/unit/replay-reclassify.test.ts#an export holding Financial_data classifies it supported and counts it"
        status: pass
      - kind: unit
        ref: "pnpm run test:unit (966 passed / 30 files)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A Phase-4 cache storing Financial_data as unknown is repaired on replay by both cache-status and duplicate, with counts recomputed and no Dexie version bump"
    requirement: FINANCE-01
    verification:
      - kind: unit
        ref: "tests/unit/replay-reclassify.test.ts#check-cache repairs a stale unknown status into supported, in order"
        status: pass
      - kind: unit
        ref: "tests/unit/replay-reclassify.test.ts#a hash-identical re-drop (duplicate) yields the same repaired list"
        status: pass
      - kind: unit
        ref: "tests/unit/replay-reclassify.test.ts#the Dexie schema version is still 2"
        status: pass
    human_judgment: false
  - id: D3
    description: "The page has five sections and six nav links in the agreed order, financial-data third and pending until 05-10"
    requirement: FINANCE-01
    verification:
      - kind: unit
        ref: "tests/unit/dashboard-status.test.ts (142 passed with ui-copy.test.ts)"
        status: pass
      - kind: unit
        ref: "tests/unit/dashboard-status.test.ts#financial-data status follows the summed rows of its folder (D-02)"
        status: pass
      - kind: e2e
        ref: "tests/e2e/dashboard.spec.ts#(order) the six section cards render in D-02 order with the block last"
        status: unknown
    human_judgment: true
    rationale: "Chromium cannot launch in this sandbox (MachPortRendezvousServer bootstrap_check_in Permission denied 1100), so the browser assertions that render the six cards were collected with --list but not executed. The ordering logic is pure and IS covered by unit tests; what is unverified is the DOM."
  - id: D4
    description: "The shared sample carries Financial_data with two real-header CSVs, and every count, order and offset assertion derives from a constant"
    requirement: FINANCE-02
    verification:
      - kind: unit
        ref: "tests/unit/replay-reclassify.test.ts#both finance files carry 05-01 headers verbatim, in 05-01 order"
        status: pass
      - kind: unit
        ref: "tests/unit/classify.test.ts (counts and order read SAMPLE_EXPECTED_COUNTS / SAMPLE_BADGE_ORDER)"
        status: pass
      - kind: e2e
        ref: "tests/e2e/import-flow.spec.ts + tests/e2e/persistent-dataset.spec.ts (banner offsets derived from SAMPLE_EXPECTED_COUNTS.supported)"
        status: unknown
    human_judgment: true
    rationale: "Same sandbox Chromium launch failure. The derived-offset values themselves are asserted by the unit suite (classify.test.ts reads the same constants), but the rendered banner list was not executed in a browser."
  - id: D5
    description: "Every Phase 3 claim of four sections or five links is amended where it lives — doc comments, test titles and six 03-UI-SPEC.md sentences"
    requirement: FINANCE-02
    verification:
      - kind: unit
        ref: "grep -c 'amended by Phase 5 D-01' 03-UI-SPEC.md => 6; grep -c 'all four sections|five muted|five unmuted' dashboard-status.test.ts => 0"
        status: pass
    human_judgment: false

# Metrics
duration: 30min
completed: 2026-10-01
status: complete
---

# Phase 05 Plan 03: Financial_data as a first-class category — Summary

**`Financial_data` is now classified supported on import AND repaired on replay, the page has five sections and six nav links, and the shared sample carries the folder with its real headers so every later plan builds on it.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-10-01T15:13Z
- **Completed:** 2026-10-01T15:41Z
- **Tasks:** 3 completed
- **Files modified:** 16 (2 created, 14 modified)

## Accomplishments

- **`Financial_data` is supported, and the fix is backward safe for returning users.** This is the plan's load-bearing half and it is not the obvious half. Promoting the folder to `SUPPORTED` alone would have left every existing user seeing "Not in this export" for a folder whose rows are already sitting in their `rows` table — because the worker has always parsed every category regardless of status, so the cache holds correct data under a wrong label. `resultFromMeta` now re-derives every stored status from the stored name with `classifyFolder`, re-sorts with the same comparator `analyzeExport` uses, and derives `counts` **after** the remap. No Dexie version bump: a `version(3)` would discard a returning user's entire dataset — timestamp, identity, every parsed row — to correct a word.
- **The six-link page needed no component edits.** `Dashboard.svelte` iterates `SECTIONS` and `DashboardNav.svelte` iterates `NAV_ORDER`, so the new card and link appeared by changing the two constants. Worth stating because it means the Phase 3 shell was genuinely data-driven, and worth stating because it is the reason Task 2 touched no `.svelte` file.
- **Every count now derives from a constant, and the old literals were quietly wrong.** The e2e specs sliced `SAMPLE_BADGE_ORDER` at a fixed offset (4) and indexed `[4]..[7]`. Adding a fifth supported category moved that boundary — and the old code would have kept **passing** while comparing the wrong folder against the wrong `data-status`. The boundary now comes from `SAMPLE_EXPECTED_COUNTS.supported`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Tracer — Financial_data classifies supported on import, and a stale cache status is repaired on replay** — `233c3f2` (type)
2. **Task 2: Five sections and six nav links, with the Phase 3 claims amended where they live** — `0d87ae9` (type)
3. **Task 3: Financial_data in the shared sample and the count/order/offset assertions** — `3f6bdc0` (test)

## Files Created/Modified

- `src/lib/worker/categories.ts` — `Financial_data` added to `SUPPORTED`; the doc comment claiming the financial dashboard name is not a folder name is replaced with what the folder actually holds.
- `src/lib/worker/classify.ts` — the sort comparator extracted out of `analyzeExport` into exported `sortCategoryEntries` (body unchanged), called from `analyzeExport`.
- `src/lib/worker/ingest.worker.ts` — `resultFromMeta` re-classifies and re-sorts stored categories before deriving counts; comments name why there is no Dexie version.
- `src/lib/dashboard-status.ts` — `financial-data` inserted third in `SECTIONS` and `NAV_ORDER`; `BUILT_DASHBOARDS` deliberately unchanged; four/five comments corrected to five/six.
- `src/lib/ui-copy.ts` — `SECTION_TITLES['financial-data'] = 'Financial_data'`; the "four folder names" comment corrected.
- `tests/helpers/worker-harness.ts` (new) — `installWorkerScope`, `loadWorker`, `workerOnMessage`, `postRequest`, `waitForMessage`, `waitForTerminal`, `fileFromBytes`, `ingestExport`, `deleteActiveDatabase`, `importWorkerDb`.
- `tests/unit/replay-reclassify.test.ts` (new) — 10 tests: import classification, replay repair on both paths, other statuses untouched, `db.verno === 2`, the comparator's three-level order and purity, and the sample-header lockstep.
- `tests/fixtures/export-fixtures.ts` — two real-header `Financial_data` files in `sampleEntries`; `SAMPLE_FILE_COUNTS`/`SAMPLE_ROW_COUNTS` gain the folder; both expected-count constants move to `supported: 5`; `SAMPLE_BADGE_ORDER` takes `Financial_data` second; stale "twelve files"/"four supported" comments refreshed.
- `tests/unit/dashboard-status.test.ts` — five supported folders in the builders, six nav entries, a new summed-rows test for `financial-data`, and every count-naming title updated.
- `tests/unit/ui-copy.test.ts` — `SECTION_TITLES` assertion extended with the `Financial_data` literal.
- `tests/unit/ingest-worker.test.ts` — the supported-only counts assertion moves from four to five.
- `tests/e2e/dashboard.spec.ts`, `import-flow.spec.ts`, `persistent-dataset.spec.ts` — `financial-data` added to every supported-id list and heading map; the order test is six cards; the first-visit card count derives from `SUPPORTED_IDS.length + 1`; banner offsets derive from `SAMPLE_EXPECTED_COUNTS.supported`.
- `.planning/phases/03-dashboard-shell-account-identity/03-UI-SPEC.md` — six sentences amended in place, each marked "(amended by Phase 5 D-01)".
- `tests/unit/zip-paths.test.ts` — **outside the plan's `files_modified`**; see Deviations.

## Decisions Made

- **Repair at read time, not by migration.** The alternative (a `version(3)` that rewrites stored statuses) was rejected because the rows are valid and only a derived label is stale. Wiping a user's cache to fix a label is a self-inflicted data loss, and it would also have required keeping the `version(2)` upgrader alive per db.ts's rule 1 for no benefit.
- **One comparator, two callers, rather than a second sort.** A replay that sorted differently would reorder the same export across a reload — a bug with no obvious cause. `sortCategoryEntries` returns a **new** array so `analyzeExport` can keep building `statusCounts` from the unsorted list without depending on evaluation order.
- **`Financial_data` is its own section, not merged into `Payment_history`.** Both hold money data, but they are different files with different headers, and one section summing two folders would make a card's counts untraceable to a file the user can find in the zip they unzipped.
- **D-02 needed no new status code.** `sectionStatus` already answers from a folder's SUMMED rows, so `financial-data` reads `pending` when its first file is header-only and its second has rows — asserted explicitly with an injected built set.

## Deviations from Plan

### Auto-fixed Issues

**1. Import cycle forced the finance headers to be transcribed locally — Category: build/tooling**
- **Found during:** Task 3 (Financial_data in the shared sample)
- **Issue:** The plan's D-03 intent is that the sample's headers trace to plan 05-01. Importing `PREMIUM_HEADER`/`CURRENCY_OPS_HEADER` from `finance-fixtures.ts` closes a real cycle — `finance-fixtures.ts` imports `mulberry32` from `sessions-fixtures.ts`, which imports `SAMPLE_ACCOUNT_ROOT` from `export-fixtures.ts` — so the module body read `undefined` and **two test files failed to load at all** (`finance-fixtures.test.ts` and `replay-reclassify.test.ts`).
- **Fix:** The two headers are written out as literals in `export-fixtures.ts`, transcribed from the real source at `finance-fixtures.ts:51` and `:62-69` (read directly, not from RESEARCH prose — the 05-01 failure mode). Because a copied constant with nothing comparing it to its source is exactly how 05-01 shipped a wrong answer key, a lockstep test was added in `replay-reclassify.test.ts` that unzips the **real sample bytes** and compares both header lines to 05-01's constants. A correction in 05-01 now fails loudly.
- **Files modified:** `tests/fixtures/export-fixtures.ts`, `tests/unit/replay-reclassify.test.ts`
- **Verification:** `pnpm exec vitest run tests/unit/replay-reclassify.test.ts` → 10 passed. The two headers are asserted both as exact strings and as `PREMIUM_HEADER.join(';')` / `CURRENCY_OPS_HEADER.join(';')` read out of the archive.
- **Committed in:** `3f6bdc0`

**2. `tests/unit/zip-paths.test.ts` held the sample's entry count as a literal — Category: stale test contract**
- **Found during:** Task 3 (after the fixture gained two files, a unit run showed the failures)
- **Issue:** Two tests asserted `expect(names).toHaveLength(12)` with "12 names" in their titles. The file is not in the plan's `files_modified` and RESEARCH Pitfall 3's dependant list missed it, but `pnpm run test:unit` cannot exit 0 without fixing it.
- **Fix:** Both moved to 14, titles updated (a stale title is a stale contract — the 04-15 lesson), and the happy-path test additionally asserts the new `Financial_data` entry name is enumerated.
- **Files modified:** `tests/unit/zip-paths.test.ts`
- **Verification:** `pnpm run test:unit` → 966 passed / 30 files, exit 0.
- **Committed in:** `3f6bdc0`

**3. A stale e2e test title that the plan's literal-by-literal scan would have missed — Category: stale test contract**
- **Found during:** Task 3 (static audit of the e2e specs, since the browser cannot run here)
- **Issue:** `dashboard.spec.ts`'s `(absent)` test was titled "…and the other two stay pending" and looped over `['player-statistics', 'user-info']`. With `Financial_data` in the sample that fixture now has **three** pending sections. The test would still have passed — it never asserted `financial-data` — so this was a silently weakened contract, not a failure.
- **Fix:** `financial-data` added to the loop and the title corrected to "the other three". This is the 04-15 note ("a stale test TITLE is a stale contract") applied to a title that enumerates a count.
- **Files modified:** `tests/e2e/dashboard.spec.ts`
- **Verification:** `pnpm run check` and `pnpm run lint` exit 0; the browser assertion itself is unverified (see Limitations).
- **Committed in:** `3f6bdc0`

---

**Total deviations:** 3 auto-fixed (1 import cycle, 2 stale literal/title contracts)
**Impact on plan:** All three were necessary for `pnpm run test:unit` to exit 0 or for a claim in a changed file to stay true. No new subsystem and no scope creep; the only file outside `files_modified` is `tests/unit/zip-paths.test.ts`, a two-line literal fix.

## Issues Encountered

- **Chromium cannot launch in this sandbox.** `browserType.launch: Target page, context or browser has been closed`, with `[pid][err] FATAL:base/apple/mach_port_rendezvous_mac.cc:159 Check failed: kr == KERN_SUCCESS. bootstrap_check_in org.chromium.Chromium.MachPortRendezvousServer: Permission denied (1100)`. This is the Phase-4 sandbox defect recurring, so **the Playwright suite is reported NOT RUN, not passed.** See Limitations.
- **Heredocs are blocked in this shell** (`/bin/bash: cannot create temp file for here document: Operation not permitted`), so commit messages and scratch scripts were written with `git commit -m` and the file tools instead of `<<'EOF'`.

## Verification Actually Run

| Command | Result |
|---|---|
| `pnpm run test:unit` (baseline, before any edit) | exit 0 — **955 passed / 29 files** |
| `pnpm exec vitest run tests/unit/replay-reclassify.test.ts` (Task 1 **RED**) | exit 1 — 7 failed / 1 passed. Primary failure was a **value** failure: `AssertionError: expected 'unknown' to be 'supported'`, i.e. `Financial_data` classified unknown today. The other 6 failed with `TypeError: sortCategoryEntries is not a function` (the export does not exist yet). |
| `pnpm exec vitest run tests/unit/replay-reclassify.test.ts tests/unit/classify.test.ts` (Task 1 **GREEN**) | exit 0 — **61 passed** |
| `pnpm exec vitest run tests/unit/dashboard-status.test.ts tests/unit/ui-copy.test.ts` (Task 2 **RED**) | exit 1 — 7 failed / 135 passed, all value failures (`to have a length of 6 but got 5`, `{ …(5) } to deeply equal { …(6) }`) |
| `pnpm exec vitest run tests/unit/dashboard-status.test.ts tests/unit/ui-copy.test.ts` (Task 2 **GREEN**) | exit 0 — **142 passed** |
| `pnpm run test:unit` (final) | exit 0 — **966 passed / 30 files** (baseline 955 + 8 new Task-1 tests + 3 added Task-3 lockstep/renames) |
| `pnpm run check` (`tsc -b`) | exit 0 |
| `pnpm run lint` (`prettier --check . && eslint .`) | exit 0 — "All matched files use Prettier code style!" |
| `pnpm run build` | exit 0 — built in 173ms |
| `pnpm exec playwright test --list` (5 specs) | exit 0 — **72 tests collected in 5 files** |
| `pnpm exec playwright test tests/e2e/dashboard.spec.ts -g "six section cards render in D-02 order"` | **exit 1 — browser launch failure, NOT a test failure.** See Limitations. |
| `git diff --quiet HEAD~3 -- package.json pnpm-lock.yaml src/lib/worker/db.ts` | exit 0 — no dependency change, no Dexie change across all three commits |

Plan acceptance-criteria greps, all confirmed:

- `grep -c "Financial_data" src/lib/worker/categories.ts` → **2**; `grep -c "does not appear here"` → **0**
- `grep -c "sortCategoryEntries"` → classify.ts **3**, ingest.worker.ts **2**
- `grep -c "financial-data" src/lib/dashboard-status.ts` → **3**; `grep -c "'financial-data': 'Financial_data'" src/lib/ui-copy.ts` → **1**
- `grep -c "amended by Phase 5 D-01"` 03-UI-SPEC.md → **6**
- `grep -c "all four sections\|five muted\|five unmuted"` dashboard-status.test.ts → **0**
- `grep -c "slice(4)"` persistent-dataset.spec.ts → **0**; `grep -c "SAMPLE_BADGE_ORDER\[[0-9]\]"` import-flow.spec.ts → **0**
- `git diff -- src/` during Task 3 → empty (fixtures and tests only)

## Limitations — what is NOT verified

**The Playwright suite was NOT RUN.** Chromium cannot start in this sandbox (`MachPortRendezvousServer ... Permission denied (1100)`), the same failure Phase 4 hit. Per the plan's own human-check I ran the `--list` fallback, which exits 0 with 72 tests collected in the five specs — but **collecting a test is not passing it**, and I am not reporting these as green.

What I did instead, for the e2e edits:

- Confirmed `scroll-nav.spec.ts` needs **no** edit: its link count is `NAV_ORDER.length` (line 113) and its accessible names are built from `SECTION_TITLES` (lines 264, 272, 279, 286, 292), so it absorbs the new id automatically. Its "five links" comments (lines 40, 111) are stale but, per the plan, 05-09 owns that file.
- Confirmed the `(none)` and `(skip)` dashboard tests assert **4** unsupported banners, which is unchanged — `Financial_data` moved into the supported group, not the banner list.
- Confirmed `buildLargeExport` and `buildScaleExport` are unaffected: the first has its own 8-category list (so its "8 categories" comment and the 20,000-entry arithmetic stay true), and the second builds from `SCALE_ROW_TEMPLATES`, which does not read `sampleEntries`. Per the plan both were left alone.
- Confirmed `zero-network.spec.ts` asserts **relative** request counts (baseline vs post-submit), not an absolute entry count, so the sample's 12 → 14 growth is safe for it.
- Statically traced `UNSUPPORTED_BANNERS`: `SAMPLE_BADGE_ORDER.slice(5)` on a 9-entry array yields `[Chat_history, Clans, Bans, Device_info]`, and the status split `index < SAMPLE_EXPECTED_COUNTS['known-deferred']` yields `known-deferred, known-deferred, unknown, unknown` — identical to the literals it replaced.

**The unverified risk is the DOM**, specifically: that the sixth card renders `pending` with the pending note in a real browser, that the banner list is still exactly four, and that the nav's live-region count is unchanged at 2. The last one is worth flagging for 05-12: a new *pending* section must not introduce a fourth live region.

## Interaction with the Open Windows

**1. `src/lib/worker/classify.ts:271` — rootless-first ordering: WIDENED by exactly one folder name. Confirmed empirically.**

This plan adds `Financial_data` to `SUPPORTED`, and `hasRecognizedCategory` at Strategy 1 accepts any archive whose **top-level** folder is named after a recognized category regardless of content. Probing the shipped code:

```
Payment_history/invoice.pdf  (pre-existing surface) => OK root="" cats=[{"name":"Payment_history","status":"supported","fileCount":1}]
Financial_data/invoice.pdf  (surface my change adds) => OK root="" cats=[{"name":"Financial_data","status":"supported","fileCount":1}]
User_Info/Account_Info.csv  (01-07 disclosed case) => OK root="" cats=[{"name":"User_Info","status":"supported","fileCount":1}]
Financial_data only, no slash => rejected (no-single-root)
```

So a non-Wargaming zip whose top-level folder is `Financial_data` now produces a **successful empty import** (1 file counted, 0 CSVs inflated) instead of a clear rejection — identical in class and severity to the already-disclosed `Payment_history` case, one recognized name wider. Not worsened beyond that: the "lone top-level file is not a root folder" guard still holds, and no other code path changed. **Not fixed — out of scope by instruction.** Worth noting that every future `SUPPORTED` addition widens this surface by one name, so the fix belongs with whoever closes the defect rather than in each promoting plan.

**2. `src/lib/worker-client.svelte.ts:239` — not touched.** This plan did not open, read or modify that file, so the `requestStartOver` / `requestClearData` / `confirmPending` dead-worker parking is unchanged. Flagged only because the new `Financial_data` card is one more thing a user could be looking at when they hit it; 05-07 still owns the fix.

**3. `src/lib/worker/csv-parse.ts:79` `fixed[k] = v` — not encountered.** The two sample files use real headers (`PREMIUM;CURR_PREMIUM;CREATED;UPDATED` and `CREATED;CURRENCY_CODE;CURRENCY_TITLE;AMOUNT;TYPE;ORDER`); neither has a column named `__proto__`. Worth distinguishing for 05-01/05-06: `finance-fixtures.ts:485` has a `__proto__` **value** in a `CURRENCY_CODE` cell, which is a different thing from a `__proto__` **column name**, so the hand fixtures do not currently trip this either.

## User Setup Required

None.

## Handoff for a Verifier

Most relevant, in order:

1. `pnpm run test:unit` — expect **966 passed / 30 files**, exit 0 (baseline was 955 / 29).
2. `pnpm run check && pnpm run lint` — both exit 0.
3. `git diff HEAD~3 -- src/lib/worker/db.ts` and `git diff HEAD~3 -- package.json pnpm-lock.yaml` — both must be empty.
4. **On a machine with working Playwright browsers**, run the five specs — this is the gap:
   `pnpm exec playwright test tests/e2e/dashboard.spec.ts tests/e2e/import-flow.spec.ts tests/e2e/persistent-dataset.spec.ts tests/e2e/scroll-nav.spec.ts tests/e2e/zero-network.spec.ts`
   Expect all 72 to pass, with the `Financial_data` card `pending` + carrying the pending note, six nav links, and still exactly four unsupported banners. Also confirm the page still carries exactly **2** `[aria-live]` regions (05-12 will assert 3).
5. `grep -rn "four supported sections\|five links\|five section cards" tests/e2e/dashboard.spec.ts tests/e2e/import-flow.spec.ts tests/e2e/persistent-dataset.spec.ts` — should return only the 4 **non-supported** folder claims and the `SAMPLE_UNSUPPORTED_ORDER` comment, which are still true.

Edge cases I reasoned about but did not execute:

- A real browser rendering of `financial-data` when the folder is **absent** (greyed card, "Not in this export"). The unit test covers `sectionStatus` and `formatSectionStatus`; only the DOM is unverified.
- The replay path when a user's cache holds a **stale `supported`** status for a folder that is no longer supported. The repair direction is symmetric (`classifyFolder` runs on every entry regardless of the stored value), and the "other categories keep their own status" test proves non-sweeping, but no test seeds a stale `supported` entry.
- Duplicate-fixture interaction: after Task 3 the sample itself contains `Financial_data/Virtual_Currencies_Operations.csv`, and `replay-reclassify.test.ts`'s `buildFinancialExport` overlays that same path. The overlay **replaces** it (2 files / 2 rows total), and the assertions deliberately check status and `counts` rather than `fileCount`, so they hold in both worlds — but that is worth a glance.
- `SCALE_ROW_TEMPLATES` still names the four **invented** `*_stats.csv` files, per the plan's instruction to leave the scale templates alone. Plan 05-06 replaces them with the real 05-02 vehicle file names.
