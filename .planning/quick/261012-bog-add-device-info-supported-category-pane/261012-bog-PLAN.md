---
phase: 261012-bog-add-device-info-supported-category-pane
plan: 261012-bog
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/worker/categories.ts
  - src/lib/features/device-info/device-info-shared.ts
  - src/lib/features/device-info/device-info-aggregate.ts
  - src/lib/features/device-info/device-info-state.ts
  - src/lib/features/device-info/DeviceInfo.svelte
  - src/lib/features/device-info/DeviceTable.svelte
  - src/lib/core/types/worker-messages.ts
  - src/lib/worker/data-queries.ts
  - src/lib/worker/ingest.worker.ts
  - src/lib/shell/dashboard-status.ts
  - src/lib/shell/selection-state.ts
  - src/lib/shell/overview-model.ts
  - src/lib/shell/Dashboard.svelte
  - src/lib/ui-copy.ts
  - tests/fixtures/device-info-fixtures.ts
  - tests/fixtures/export-fixtures.ts
  - tests/fixtures/README.md
  - tests/helpers/components.ts
  - tests/unit/device-info/device-info-aggregate.test.ts
  - tests/unit/device-info/device-info-state.test.ts
  - tests/unit/device-info/device-info-blocks.test.ts
  - tests/unit/import/device-info-worker.test.ts
  - tests/unit/import/classify.test.ts
  - tests/unit/import/replay-reclassify.test.ts
  - tests/unit/import/ingest-worker.test.ts
  - tests/unit/import/data-query-worker.test.ts
  - tests/unit/shell/selection-state.test.ts
  - tests/unit/shell/dashboard-status.test.ts
  - tests/unit/shell/overview-model.test.ts
  - tests/unit/shell/ui-copy.test.ts
  - tests/unit/guards/sample-export-shape.test.ts
  - tests/unit/guards/phase8-ui-review-guards.test.ts
  - tests/e2e/shell/device-info.spec.ts
  - tests/e2e/shell/dashboard.spec.ts
  - tests/e2e/shell/master-detail-nav.spec.ts
  - tests/e2e/shell/identity-privacy.spec.ts
  - tests/e2e/shell/mobile-sweep.spec.ts
  - .planning/PROJECT.md
  - AGENTS.md
autonomous: true
requirements: []

estimate:
  tokens: 300000
  raw_tokens: 300000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "Device_info classifies as a supported category on import and on cache replay: it is never listed under Not yet supported, a stale cache that stored it as unknown is repaired at read time with no Dexie version bump, and the import counts show one more supported and one fewer unknown category"
    - "The master-detail shell has a ninth row and an Overview card titled Device info (list order: after Payments, before Account, with Not yet supported still last); its detail shows three per-source tables - PC hardware from WOT_Device_Info.csv, Blitz devices from WOTB_Device_Info.csv, Assistant app devices from WOT_Assistant_Device_Info.csv - under a counts summary of rows per source and rows that could not be read"
    - "A cell holding N/D (any case) or nothing renders as the muted words 'not reported'; GPU and main memory arrive in MB and render in GB through one ui-copy formatter (1,024 MB per GB, one decimal, trailing .0 dropped, under 1 GB kept in MB)"
    - "A category that is present but missing one of the three files shows that table as 'Not in this export'; a header-only file says it holds no rows; an Assistant row from which none of Device type, App, Platform or Version can be read is skipped and counted as 'could not be read'"
    - "The raw Assistant blob is never stored, never posted to the page and never rendered: import stores only the four extracted fields (or an explicit unreadable marker) per Assistant row, the query view carries only those four fields, and the Spa id and the PC configuration flags appear in no stored row, no view and no DOM text"
    - "A legacy cache whose Assistant rows still hold the raw POST cell answers the same view through the same extractor, so the blob is not exposed on that path either"
    - "No network API, no new dependency, no raw-HTML interpolation and no inline style attribute is added; fflate stays worker-only; every font size is on the 14/18/26/30 scale and every control keeps its 44px target"
    - "pnpm run lint, pnpm run check and pnpm run test:unit are green, the e2e enumerations that hardcoded eight panes and four unsupported folders are corrected, and the listed e2e test count stays at or under the 258 ceiling"
  artifacts:
    - path: "src/lib/features/device-info/device-info-shared.ts"
      provides: "the import-free view contract, file names, column ids, caps and the N/D token"
      contains: "DeviceInfoView"
    - path: "src/lib/features/device-info/device-info-aggregate.ts"
      provides: "extractAssistantFields, reduceBlobRow, hasBlobColumn, isDeviceInfoCategory and buildDeviceInfo (pure)"
      contains: "buildDeviceInfo"
    - path: "src/lib/worker/ingest.worker.ts"
      provides: "the import-time reduction of Assistant rows at the single row choke point, and the device_info presence category"
      contains: "reduceBlobRow"
    - path: "src/lib/worker/data-queries.ts"
      provides: "the device-info channel's file table and answer"
      contains: "device-info"
    - path: "src/lib/features/device-info/DeviceInfo.svelte"
      provides: "the pane body: counts summary and the three source tables"
      contains: "device-info-block"
    - path: "tests/fixtures/device-info-fixtures.ts"
      provides: "synthetic quote-all, bare-CR fixtures for the three files with canaries and hand-derived expectations"
      contains: "DEVICE_SPA_CANARY"
    - path: "tests/e2e/shell/device-info.spec.ts"
      provides: "the browser proof of the populated and the one-file-missing pane"
      contains: "device-info"
  key_links:
    - from: "src/lib/worker/ingest.worker.ts (row loop)"
      to: "src/lib/features/device-info/device-info-aggregate.ts reduceBlobRow"
      via: "a Device_info row carrying a POST header is replaced by its four extracted fields before allRows.push, so the blob is never persisted"
      pattern: "reduceBlobRow"
    - from: "src/lib/worker/data-queries.ts answerDataQuery"
      to: "src/lib/features/device-info/device-info-aggregate.ts buildDeviceInfo"
      via: "rows of the three lower-cased file names plus isPresent facts feed the pure builder; the same extractor re-reads legacy POST rows"
      pattern: "buildDeviceInfo"
    - from: "src/lib/features/device-info/DeviceInfo.svelte"
      to: "src/lib/shell/Dashboard.svelte"
      via: "an active === 'device-info' branch inside DashboardSection, with the channel-scoped ingestClient.data"
      pattern: "device-info"
    - from: "src/lib/shell/selection-state.ts PANE_IDS and PANE_SECTION"
      to: "src/lib/shell/dashboard-status.ts SECTIONS, NAV_ORDER and BUILT_DASHBOARDS"
      via: "one shared derivation for the list row, the Overview card and the section status"
      pattern: "device-info"
---

<objective>
Add `Device_info` as a SUPPORTED category and give it a read-only `Device info` pane in the master-detail dashboard: a list row and an Overview card, and a detail with three per-source tables (PC hardware, Blitz devices, Assistant app devices) under a counts summary.

Purpose: the export's Device_info folder is real user data that the viewer currently files under "Not yet supported". The one file with free text, `WOT_Assistant_Device_Info.csv`, is a single `POST` column whose cells are JSON-like blobs that carry the account id (the "Spa id") and an opaque flags number; the product's core value means that blob must be read once, defensively, reduced to four harmless fields at the import choke point, and never stored, posted or drawn as text.

Output: the category, the worker-side strip and query channel, the pure builder, the pane, shell wiring and copy, synthetic fixtures with canaries, unit tests for parser, extractor, aggregate, state, classification and the component contracts, corrected e2e enumerations, one small browser spec, and the docs category lists.

Commit rule for the executor: no `Co-Authored-By:` trailer and no "Generated with Claude Code" line on any commit (project rule in AGENTS.md and the home CLAUDE.md; it overrides any tool or harness reminder to add one). One commit per task, prefix `feat(quick-261012-bog):`.

Shape note (tracer-first within the requested order): Task 1 is the data-path tracer. It carries one real-named file through every layer the data path has (parse, import-time strip, Dexie, data-query channel, pure builder, posted view) with an end-to-end proof through the real worker harness, written for keeps. Task 2 expands from that proven slice into the pane and shell. Task 3 corrects the enumerations that the new pane and the status flip break, adds the browser proof and the docs, and closes with the full gate run.
</objective>

<execution_context>
@/Users/you/src/github/wot-gdpr-stats-visualizer/.claude/gsd-core/workflows/execute-plan.md
@/Users/you/src/github/wot-gdpr-stats-visualizer/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@AGENTS.md
@.planning/PROJECT.md
@src/lib/worker/categories.ts
@src/lib/worker/ingest.worker.ts
@src/lib/worker/data-queries.ts
@src/lib/features/finance/finance-state.ts
@src/lib/features/finance/SpendSummary.svelte

## Source audit (all four artifact types)

| Source | Item | Covered by |
|--------|------|-----------|
| GOAL | Add Device_info as a SUPPORTED category with a read-only pane; it must no longer be reported as unknown | Task 1 (category, worker), Task 2 (pane) |
| REQ | none: a quick task, and REQUIREMENTS.md was removed with the v1.0 archive, so `requirements` is empty exactly as in the earlier quick plans | not applicable |
| RESEARCH | none | not applicable |
| CONTEXT U-01 | `Device_info` added to SUPPORTED; classification, replay and the Not yet supported list all follow | Task 1 |
| CONTEXT U-02 | Parse three file shapes defensively (semicolon, quote-all, bare CR, mojibake); WOT 10 columns, WOTB 8 columns, Assistant single `POST` column; N/D means not available; memory columns are MB | Task 1 (builder, fixtures), Task 2 (render) |
| CONTEXT U-03 | Blob extraction: JSON.parse in try/catch, regex fallback, unparseable rows skipped and counted as "could not read"; only Device type, App, Platform, Version are read; the raw blob is never displayed or stored; the Spa id is never kept | Task 1 |
| CONTEXT U-04 | Follow the existing pattern exactly: categories, classify, csv-columns, csv-parse, data-queries, ingest.worker (PII strip and fail-closed header policy), db, finance feature layout, dashboard-status, selection-state, overview-model, Dashboard, ui-copy | Tasks 1 and 2 |
| CONTEXT U-05 | Pane: list row and detail, three per-source tables, counts summary (rows per source, unreadable rows), N/D as muted "not reported", MB to GB through ui-copy formatters, no free-text blob display, honest empty and missing states | Task 2 |
| CONTEXT U-06 | README and docs category lists, and every test that enumerates supported categories | Tasks 1 to 3 |
| CONTEXT U-07 | Unit tests for parser (incl. blob extraction), aggregate, state and classification; synthetic fixture rows; the real export is never committed and no real value is copied into a fixture or test | Tasks 1 and 2 |
| CONTEXT U-08 | e2e only minimally: eight panes become nine; fix guards and tests that hardcode 8 | Task 3 |
| CONTEXT U-09 | Constraints: zero-network guard kept, fflate worker-only, no raw-HTML interpolation, no inline style attributes, 44px targets, 14px floor, `pnpm run lint`, `pnpm run check`, `pnpm run test:unit` pass | all tasks, Task 3 closes |

## Planner decisions (record them in the SUMMARY; the requester can override any of them)

PD-01 **A new `device-info` data-query channel, answered on demand from the stored rows.** The pure builder runs in `answerDataQuery` over `readRowsByFile`, exactly like premium, currency and spend. No aggregate is stored on the meta record and the Dexie version stays 2 (`tests/unit/import/db.test.ts` pins both). Reason: the rows are the dataset, the view is derived, and a returning user's cached dataset then works with no migration.

PD-02 **The blob is reduced at the import choke point, keyed on the folder AND the header.** In the row loop of `ingest.worker.ts`, a row in the Device_info family (case-insensitive) that carries a header whose NFKC, trimmed, upper-cased form is `POST` is replaced by a NEW object holding only the allow-listed fields it yields under the stored headers `DEVICE_TYPE`, `APP`, `PLATFORM`, `VERSION`, or by `{ ROW_STATE: 'unreadable' }` when none could be read. The overflow bucket and every other key go with it. This runs before the existing User_Info strip in the same expression, so a row that is both is reduced and never merely sanitised. Three stored shapes therefore exist and each is tested: new-readable, new-unreadable marker, legacy-raw (a `POST` cell from a cache written before this change).

PD-03 **The builder re-applies the same extractor to legacy rows.** A stored row that still has a `POST` key is read through `extractAssistantFields` at query time and only its four fields reach the view. Residual risk, accepted and recorded in the threat model: a legacy cache keeps the raw blob at rest until the user imports again or clears the cache. The account id is already in `meta.accountRoot` and in the sanitised User_Info rows, so the exposure is not new, and a migration would cost every returning user their cached dataset.

PD-04 **The shared sample export gets the three files, not `Devices.csv`.** `sampleEntries()` in `tests/fixtures/export-fixtures.ts` replaces `Device_info/Devices.csv` with the three real-named synthetic files from a new `tests/fixtures/device-info-fixtures.ts`, and `SAMPLE_FILE_COUNTS` and `SAMPLE_ROW_COUNTS` derive the Device_info counts from that module (the file's own rule: counts are derived, never typed). `Devices.csv` and its two constants stay only in `SCALE_ROW_TEMPLATES` so the 10x scale export and its answer key are unchanged. With the sample carrying the files, every sample-driven spec that loops the data panes covers the new pane for free.

PD-05 **Pane position and card.** `device-info` sits after `payments` and before `account`; `not-yet-supported` stays last. It gets an Overview card (seven cards), because otherwise the "sections with data" chip undercounts.

PD-06 **Not reported.** A cell is `null` ("not reported") when it is absent, blank after trim, or `N/D` in any case. The word renders in muted ink so the meaning never depends on colour. Anything else is shown as written, clamped to 200 characters.

PD-07 **Memory.** A memory cell is a number of MB when it is all digits (at most nine). The formatter divides by 1,024, rounds to one decimal, drops a trailing `.0`, and keeps values under 1,024 MB in MB. Non-numeric memory text is shown as written. A one-line caption on the pane states the rule. (A value near 2,000 MB reads `2 GB` and one near 6,000 MB reads `5.9 GB`; fixtures use clearly synthetic values, never the requester's real ones.)

PD-08 **"Could not be read" means blob-extraction failures only.** A parse-level skip already shows in the provenance skip tag, and `DatasetFile` has no per-file skip count to extend. An Assistant row counts as unreadable when none of the four fields could be extracted. A WOT or WOTB file none of whose expected columns resolve from its first row is reported as `no-usable` for the same reason.

PD-09 **Bounds.** At most 200 rows per table cross `postMessage`, with an "and N more rows not listed" line; every text value is clamped to 200 characters (the same bound as `MAX_STORED_STRING` in finance-shared, pinned equal by a test); a blob longer than 8,192 characters is unreadable before any parse or pattern runs.

PD-10 **Columns.** PC: PC_TYPE, OS, OS_BIT, CPU_VENDOR, CPU_NAME, CPU_CORES, GPU_VENDOR, GPUMEMORY (memory), MAINMEMORY (memory), MULTI_GPU. Blitz: PLATFORM_NAME, VENDOR_NAME, MODEL_NAME, OS, REGION, SHOP_NAME, COUNTRY_BY_IP, COUNTRY_BY_TZ. Assistant: Device type, App, Platform, Version. Rows keep file order and are not de-duplicated.

PD-11 **e2e budget.** The listed Playwright total is 254 and the ceiling is 258 (`tests/unit/guards/ci-budget.test.ts`). This plan adds at most two tests (one new spec file) and none to `master-detail-nav.spec.ts` (guarded at 19). Existing loops (`DATA_PANES`, the pane lists, `folderOf`) are extended instead of adding tests.

PD-12 **Error box colours.** The block's red error box uses the same three status literals as the other blocks, so `DeviceInfo.svelte` is added to the three existing entries of the colour allow-list in `phase8-ui-review-guards.test.ts`. No new literal and no new token is introduced.

## Facts the executor must not re-discover

- Discovery level 0: no new dependency, every pattern exists in the repo. `package.json` and `pnpm-lock.yaml` must not change.
- The parser, not the fixture, decides record boundaries: a file that mixes a bare-CR record terminator with an LF inside a quoted cell takes the "mixed terminators" path in `csv-parse.ts` (every CRLF and bare CR becomes LF, cells keep their inner LF). A file that is uniformly bare CR, with CRs inside quoted cells too, takes the other path. The Assistant fixtures must exercise BOTH.
- `renderQuoteAllCsv(header, rows)` in `tests/fixtures/finance-fixtures.ts` is the writer for the export's physical shape (bare header, every data cell quote-wrapped with inner quotes doubled, bare CR after every line). Reuse it; do not write a second writer.
- Worker tests go through `tests/helpers/worker-harness.ts` (`installWorkerScope`, `loadWorker`, `ingestExport`, `postRequest`, `waitForMessage`, `importWorkerDb`, `deleteActiveDatabase`) exactly as `tests/unit/import/data-query-worker.test.ts` does. `buildCustomExport({ overrides, omitFiles, omitFolders })` builds variants of the sample.
- Component contracts are tested by source (Vitest has no DOM), modelled on `tests/unit/finance/spend-blocks.test.ts`: assert the file exists first, strip comments, then assert test ids and imports. `tests/helpers/components.ts` resolves component names through a directory list that needs the new folder.
- The colour guard, the 14/18/26/30 font-size guard and the phone-query guard scan every file under `src`. New Svelte files use only `var(--token)` colours and 14px text.
- `playwright test` builds and previews the app itself and `playwright test --list` counts both projects. After this plan it must report at most 258 tests; expect 256. The full e2e run takes several minutes with `--workers=2`; run it in the background if one foreground call would pass the 10 minute tool limit.
- `.planning/` is ignored by prettier and eslint. After `.svelte` and `.ts` edits run `pnpm exec prettier --write <files>`, then `pnpm run lint`. Use the Edit and Write tools for edits, never a shell heredoc.
- Real export values must not appear anywhere in the repo: fixtures use `Synth`-prefixed strings and unmistakable synthetic numbers, and the two canaries are fabricated strings that match nothing else in the sample.
</context>

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1: Tracer - Device_info supported, Assistant blob reduced at import, device-info query answered through the real worker</name>
  <files>src/lib/worker/categories.ts, src/lib/features/device-info/device-info-shared.ts, src/lib/features/device-info/device-info-aggregate.ts, src/lib/core/types/worker-messages.ts, src/lib/worker/data-queries.ts, src/lib/worker/ingest.worker.ts, tests/fixtures/device-info-fixtures.ts, tests/fixtures/export-fixtures.ts, tests/unit/device-info/device-info-aggregate.test.ts, tests/unit/import/device-info-worker.test.ts, tests/unit/import/classify.test.ts, tests/unit/import/replay-reclassify.test.ts, tests/unit/import/ingest-worker.test.ts, tests/unit/import/data-query-worker.test.ts, tests/unit/guards/sample-export-shape.test.ts</files>
  <read_first>
    - src/lib/worker/categories.ts and src/lib/worker/classify.ts (classifyFolder, sortCategoryEntries, resolveCsvFileCategory: classification is case-insensitive and is re-derived at replay by resultFromMeta)
    - src/lib/worker/ingest.worker.ts (PRESENCE_CATEGORIES near the top; the per-file loop and the single row choke point around the `userInfo || hasSensitiveColumn(raw)` expression; handleDataQuery; resultFromMeta)
    - src/lib/worker/identity.ts (hasSensitiveColumn, sanitizeUserInfoRow, normalizeKey: the shape of a header-keyed strip) and src/lib/worker/csv-columns.ts (headerKey, cell)
    - src/lib/worker/csv-parse.ts header comment (items 1 to 8: delimiter choice, mixed terminators, blank-record filter, mojibake)
    - src/lib/worker/data-queries.ts (DATA_FILES, isPresent, rowsOf, answerDataQuery, the legacy-presence asymmetry) and src/lib/worker/db.ts readRowsByFile, RowsSnapshot and DatasetFile
    - src/lib/features/finance/finance-shared.ts (a no-import contract module: keep `grep -c '^import'` at 0) and the top 80 lines of src/lib/features/finance/finance-aggregate.ts (header-keyed column resolution from the FIRST row's keys, never reading a column by a guessed name)
    - src/lib/core/types/worker-messages.ts (DataQuery, DataResult)
    - tests/unit/import/data-query-worker.test.ts (the tracer idiom, RED_TIMEOUT_MS, the presence-list test) and tests/helpers/worker-harness.ts
    - tests/fixtures/finance-fixtures.ts renderQuoteAllCsv and tests/fixtures/export-fixtures.ts (SAMPLE_FILE_COUNTS, SAMPLE_ROW_COUNTS, SAMPLE_EXPECTED_COUNTS, SAMPLE_BADGE_ORDER, sampleEntries, buildOnlySupportedExport, SCALE_ROW_TEMPLATES)
    - tests/unit/import/replay-reclassify.test.ts (REPAIRED_ORDER, PRE_PHASE5_SUPPORTED, the byName expectations) and tests/unit/guards/sample-export-shape.test.ts (the CRLF control list)
  </read_first>
  <behavior>
    Pure builder and extractor (tests/unit/device-info/device-info-aggregate.test.ts, written first):
    - extractAssistantFields reads a multi-line pretty JSON blob, a single-line JSON blob and a JSON blob whose Version is a number; returns null for text that is not JSON-like, for a valid object with none of the four keys, for a blob whose four values are all N/D or blank, for an array or a bare string, and for text longer than 8,192 characters (the length check runs before any parse).
    - A JSON-like blob that JSON.parse rejects (a trailing comma, single-quoted keys) is read by the anchored fallback patterns; a hostile object with an own `__proto__` key and a nested object holding the four keys yields null (allow-listed own string or number values only).
    - Output carries exactly four fields, each a clamped string or null; the Spa id value, the flags value and every other key never appear in the result, whatever the blob holds.
    - reduceBlobRow returns an object with only the non-null stored headers, or `{ ROW_STATE: 'unreadable' }`; hasBlobColumn is true for `POST`, ` post `, a fullwidth spelling and a row with extra keys, false for a row without that header and for a header such as `POST_ID`.
    - buildDeviceInfo: for each of the three sources, seen=false gives not-in-export, seen with zero rows gives no-rows, rows with no resolvable expected column give no-usable; PC and Blitz rows are read through headerKey columns resolved from the first row; N/D in any case and blank cells become null; memory columns become numbers when all digits and stay clamped text otherwise; more than 200 rows list 200 and report `more`; Assistant rows are read from the stored fields, from the unreadable marker and from a legacy raw POST cell with the same result, and rows yielding no field count in `unreadable`; an Assistant source whose rows are all unreadable is no-usable with its counts; no value of the view contains either canary, the key `POST` or the text `Spa id`.
    - The fixture CSVs, parsed with the REAL parseCsvFile, give the hand-derived row counts, with the multi-line blob cells intact (both the LF-inside-bare-CR file and the uniform bare-CR file).
    Through the real worker (tests/unit/import/device-info-worker.test.ts):
    - Tracer: ingest the sample, terminal `done`; counts show six supported; the Device_info entry is `supported`, fileCount 3 and rowCount equal to the fixture's derived total; a posted `device-info` data-query answers `data-result` with the done result's importedAt and a view deep-equal to buildDeviceInfo over the rows the fixtures hold, all three tables ready, the Assistant table with four listed rows and four unreadable.
    - Canary: every stored row of the Assistant file is one of the two new shapes (only the four stored headers, or the unreadable marker); no stored row of any category and the whole posted view contain neither canary, the key POST nor the text Spa id.
    - Absent versus empty: omitting one file gives not-in-export for that table only; a header-only Assistant file gives no-rows; omitting the whole folder gives three not-in-export tables; a legacy snapshot (meta.files null, raw POST rows written straight into Dexie) answers ready with the extracted fields and no canary.
    - isDataQuery accepts `{ channel: 'device-info' }` and rejects the same query with a `title` smuggled in; a cache-status replay lists Device_info as supported.
    Classification (classify.test.ts and replay-reclassify.test.ts): classifyFolder is `supported` for Device_info, device_info and DEVICE_INFO; analyzeExport puts it in the supported group, second by lower-case order; resolveCsvFileCategory resolves `123/Device_info/WOT_Device_Info.csv` to category Device_info; a stale cache that stored it as unknown replays as supported and the list is re-sorted, while Bans stays unknown.
    RED evidence: before any source edit the new tests fail because the modules and the channel do not exist and Device_info is still unknown; any other red is invalid.
  </behavior>
  <action>
    Step A (fixtures and RED). Create tests/fixtures/device-info-fixtures.ts first, then the tests listed under behavior, then run `pnpm exec vitest run tests/unit/device-info tests/unit/import/device-info-worker.test.ts tests/unit/import/classify.test.ts` and confirm the stated RED.
    - The module exports the three header lists (the ten PC names, the eight Blitz names and the single `POST` name, per PD-10), the synthetic row arrays, the blob list, the two canaries `DEVICE_SPA_CANARY` and `DEVICE_FLAGS_CANARY` (fabricated strings that equal nothing else in the sample, the account root and the nickname included), the rendered CSV texts, a record mapping the three relative paths `Device_info/WOT_Device_Info.csv`, `Device_info/WOTB_Device_Info.csv` and `Device_info/WOT_Assistant_Device_Info.csv` to those texts, and a derived row-count object.
    - Rows are written with renderQuoteAllCsv from finance-fixtures, so every file is bare-header, quote-all and bare-CR. Every string value is `Synth`-prefixed or an unmistakable synthetic number; none is a real value. PC rows: four, including a row with `N/D` and a row with lower-case `n/d`, memory values 4096, 1536 and 3000, one memory cell `N/D`, and one non-numeric memory cell. Blitz rows: three, including a blank cell and an `N/D`.
    - The blob list holds eight entries, each with its derivation in a comment: a pretty multi-line JSON blob (Device type, App, Spa id canary, Platform, Version, PC configuration flags canary, in that order), a single-line JSON blob, a JSON-like blob with a trailing comma, a JSON blob with a numeric Version, a valid JSON object with none of the four keys, plain non-blob text, a blob whose four values are all N/D, and a blob with an own `__proto__` key. Four are readable and four are not; the expected readable field values are stated beside them.
    - Two renderings of the Assistant file: one with LF inside the cells (record terminator bare CR, so the parser's mixed path) and one with every inner LF replaced by CR (uniform bare CR). The shared sample uses the first.
    Step B (shared contract and builder, GREEN for the pure tests).
    - device-info-shared.ts has no imports at all. It exports: the lower-cased category constant `device_info`; the source ids pc, blitz and assistant as a tuple and a type; the three lower-cased file names; the three column-id tuples with their types, the canonical upper-case header each id reads, and the set of memory column ids; the N/D token; the three caps (text 200, rows 200, blob 8,192); the four stored Assistant headers, the `ROW_STATE` key and the `unreadable` value; and the types DeviceRow, DeviceCell (string, number or null), DeviceTableView (not-in-export, no-rows, no-usable with rowCount and unreadable, ready with columns, rows, rowCount, more and unreadable) and DeviceInfoView (status ready, with pc, blitz and assistant tables). The top-level status is always ready so the existing finance state functions apply unchanged.
    - device-info-aggregate.ts imports only the shared module and `cell` and `headerKey` from the worker's csv-columns module. It exports isDeviceInfoCategory (case-insensitive), hasBlobColumn, extractAssistantFields, reduceBlobRow and buildDeviceInfo, behaving as the behavior block states. extractAssistantFields order: length bound, then JSON.parse in try and catch; a parsed non-array object is read through its own entries and matched against the four allow-listed keys case-insensitively and trimmed, accepting string and finite-number values only; a JSON.parse failure or a non-object result goes to four fixed anchored patterns (double or single quoted key, a colon, then a quoted value without quotes or line breaks or a bare token of at most 50 word, dot or hyphen characters). No pattern is built from data and none has nested quantifiers. If every field is null the result is null.
    - buildDeviceInfo takes one input per source holding rows and a seen flag, resolves each table's columns once from the first row's keys through headerKey, builds the Map-keyed lookups it needs with Map rather than plain objects (a `__proto__` header is an ordinary key), and never reads a column by a name it did not resolve. It never returns a row object, only cells.
    Step C (worker wiring, GREEN for the worker tests).
    - categories.ts: add `Device_info` to SUPPORTED and extend the doc comment with a sentence on why (a real top-level folder holding the PC, Blitz and Assistant device lists, promoted from unknown the way Financial_data was in Phase 5).
    - worker-messages.ts: import the DeviceInfoView type and add `{ channel: 'device-info' }` to DataQuery and `{ channel: 'device-info'; view: DeviceInfoView }` to DataResult, with a comment that it takes no further fields (isDataQuery rejects a smuggled title, as for the finance channels).
    - data-queries.ts: add the `device-info` entry to DATA_FILES (the three lower-cased names from the shared module, category `device_info`), and a case in answerDataQuery that builds the view from rowsOf and isPresent for each file. Update the "four channels" comments to say five.
    - ingest.worker.ts: add `device_info` to PRESENCE_CATEGORIES (and correct the comment that says the set is exactly the three Phase 5 categories); compute `deviceInfo = isDeviceInfoCategory(entry.name)` beside `userInfo`; in the row choke point, when deviceInfo and hasBlobColumn(raw) hold, store reduceBlobRow(raw); otherwise the existing expression is untouched. Extend the choke-point comment with the PD-02 reasoning and its accepted residual (a misfiled copy outside Device_info keeps its cells, the same class as the D-18 deny-list residual).
    - Do NOT touch db.ts, csv-parse.ts, identity.ts or the Dexie version.
    Step D (status flip fallout, in this task so the unit suite stays green).
    - export-fixtures.ts: replace the Devices.csv entry of sampleEntries with the three files from the new module; derive SAMPLE_FILE_COUNTS.Device_info and SAMPLE_ROW_COUNTS.Device_info from it; SAMPLE_EXPECTED_COUNTS becomes supported 6, known-deferred 2, unknown 1; SAMPLE_BADGE_ORDER moves Device_info to second place (lower-case order: activity_history, device_info, financial_data, payment_history, player_statistics, user_info); buildOnlySupportedExport stops omitting Device_info; update the doc comments that say "five supported" and "unknown (Bans, Device_info)". Leave SCALE_ROW_TEMPLATES, DEVICES_HEADER and DEVICES_ROW alone.
    - Fix every unit test the flip breaks, by correcting the expectation to the new truth and never by loosening it: replay-reclassify (REPAIRED_ORDER, the byName block: Device_info is now repaired to supported, Bans is the remaining unknown example, and the sortCategoryEntries examples keep working with Device_info in the supported group), ingest-worker (the supported-only count, the category-count expectations that derive from SAMPLE_BADGE_ORDER), data-query-worker (the presence-list test now allows Device_info), sample-export-shape (drop `Device_info/Devices.csv` from the CRLF control list, which Bans, Messages and Clan_membership still serve; add a test that the sample holds exactly the three real-named Device_info files and that neither the NAME canary nor either device canary leaks outside its own file). Run `pnpm run test:unit` and fix whatever else it names the same way; expect the dashboard-status, selection-state and overview-model tests to stay green in this task because their results are hand-built.
    Step E (verify and commit). `pnpm exec prettier --write` on the touched files, then the verify command. Commit as `feat(quick-261012-bog): support Device_info, reduce the Assistant blob at import and answer a device-info query`.
  </action>
  <verify>
    <automated>pnpm exec prettier --check src tests && pnpm run test:unit && pnpm run check && pnpm run lint</automated>
  </verify>
  <done>The new tests were observed red for the stated reason and are green; Device_info classifies as supported on import and replay and is absent from the unsupported list; an import stores only the four extracted fields or the unreadable marker for Assistant rows; a posted device-info query answers the hand-derived view with the snapshot's importedAt; neither canary appears in any stored row or posted view, on the fresh path and the legacy path; the sample export carries the three synthetic files with derived counts; db.ts, the Dexie version and package.json are untouched; unit, check and lint are green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: The Device info pane - state, components, shell wiring and copy</name>
  <files>src/lib/shell/dashboard-status.ts, src/lib/shell/selection-state.ts, src/lib/shell/overview-model.ts, src/lib/shell/Dashboard.svelte, src/lib/ui-copy.ts, src/lib/features/device-info/device-info-state.ts, src/lib/features/device-info/DeviceInfo.svelte, src/lib/features/device-info/DeviceTable.svelte, tests/helpers/components.ts, tests/unit/device-info/device-info-state.test.ts, tests/unit/device-info/device-info-blocks.test.ts, tests/unit/shell/selection-state.test.ts, tests/unit/shell/dashboard-status.test.ts, tests/unit/shell/overview-model.test.ts, tests/unit/shell/ui-copy.test.ts, tests/unit/guards/phase8-ui-review-guards.test.ts</files>
  <read_first>
    - src/lib/shell/dashboard-status.ts (SECTIONS, NAV_ORDER, BUILT_DASHBOARDS and their long doc comments; the order is declared there and not derived from SUPPORTED)
    - src/lib/shell/selection-state.ts (PANE_IDS, PANE_SECTION, paneEntries) and src/lib/shell/overview-model.ts (OVERVIEW_CARD_IDS, overviewChips, overviewCards)
    - src/lib/shell/Dashboard.svelte (the {#if}/{:else if} chain inside DetailPane, sectionProps) and src/lib/shell/DashboardSection.svelte (the ready body and the provenance line)
    - src/lib/features/finance/SpendSummary.svelte script (the shown, load, effect, deriveFinanceState pattern, copied verbatim in shape) and src/lib/features/finance/FinancialData.svelte (the block-stack wrapper)
    - src/lib/features/finance/finance-state.ts (acceptDataOutcome, ShownBlock, deriveFinanceState, ViewOf) and src/lib/features/vehicles/vehicle-state.ts (reuses acceptDataOutcome across features: the precedent)
    - src/lib/features/logins/LoginTable.svelte stylesheet and markup of the scroller (named, focusable region with a visually hidden caption) and src/lib/shell/ExcludedNotice.svelte (pill, explanation, testId props; renders nothing for an empty pill)
    - src/lib/ui-copy.ts: SECTION_TITLES, PANE_TITLES, formatRowCount, formatNumber, the Financial copy block (FINANCIAL_LOADING, FINANCIAL_ERROR, formatFinancialNoRows) and the Phase 8 block at the end
    - tests/unit/finance/spend-blocks.test.ts (the source-contract style) and tests/unit/shell/ui-copy.test.ts (the PANE_TITLES test and the table of pinned strings)
    - tests/unit/guards/phase8-ui-review-guards.test.ts ALLOWED_COLOUR_LITERALS and the 14/18/26/30 font-size test; tests/helpers/components.ts COMPONENT_DIRS
  </read_first>
  <behavior>
    Shell lists (selection-state, dashboard-status, overview-model tests, corrected to the new truth):
    - PANE_IDS is overview, playtime, login-history, vehicles, finance, payments, device-info, account, not-yet-supported; PANE_SECTION maps device-info to the device-info section; every id has a title and a section.
    - SECTIONS and NAV_ORDER list device-info between payment-history and user-info; sectionStatus is ready for Device_info with rows, empty with zero rows and no-export when absent; BUILT_DASHBOARDS holds it; a null result gives nine muted rows.
    - paneEntries gives the Device info row the headline `{n} rows` and summary `Device_info · {n} files` from the one derivation; OVERVIEW_CARD_IDS has seven ids with device-info before account; the "with data" and "not in this export" chips count it like the others.
    Copy (ui-copy.test.ts): PANE_TITLES names the nine panes with `Device info`; SECTION_TITLES has `Device_info`; every new constant and formatter below is pinned with its exact string, including formatMemoryFromMb for 0 (0 MB), 512 (512 MB), 1023 (1,023 MB), 1024 (1 GB), 1536 (1.5 GB), 3000 (2.9 GB), 4096 (4 GB), 16384 (16 GB) and a non-finite or negative input (0 MB, never NaN), and singular and plural forms of every count sentence.
    State (device-info-state.test.ts): deviceInfoSummary over hand-built views returns per-source status, rows and unreadable plus totals and the number of sources present, for each of the four table statuses; acceptDataOutcome admits a device-info result for the dataset on screen, drops a superseded outcome, a wrong-dataset answer, a null result and another channel's result, and turns an error outcome into a failed block with no worker detail; deriveFinanceState gives loading with no answer, ready with a view and error for a failed block; the view type is the one ViewOf resolves for the channel.
    Component contracts (device-info-blocks.test.ts, by source, file existence asserted first, comments stripped): DeviceInfo.svelte asks the `device-info` channel through the passed client, derives its state with the shared deriveFinanceState and acceptDataOutcome, carries the block, summary and per-source summary hooks, sets busy only while loading, renders the error as an alert and the loading line as a status, and takes every sentence from ui-copy; DeviceTable.svelte renders the per-source section hook with a status attribute, the not-reported span from the ui-copy constant, the shared ExcludedNotice with a per-source test id, and a named, focusable scroll region with a visually hidden caption; neither file contains raw-HTML interpolation, an inline style attribute, a font size off the scale or a colour literal outside the three status literals; Dashboard.svelte mounts DeviceInfo behind the device-info branch with the data client.
    RED evidence: before any source edit the shell-list, copy, state and component tests fail because the id, the strings, the module and the components do not exist; any other red is invalid.
  </behavior>
  <action>
    Step A (RED). Write or correct the tests listed under behavior and run `pnpm exec vitest run tests/unit/shell tests/unit/device-info` to confirm the stated RED. Add `features/device-info` to COMPONENT_DIRS in tests/helpers/components.ts in this step, because the component contract test resolves names through it.
    Step B (shell wiring, per PD-04 and PD-05).
    - dashboard-status.ts: add `{ id: 'device-info', folder: 'Device_info' }` to SECTIONS after payment-history, add `device-info` to NAV_ORDER in the same position and to BUILT_DASHBOARDS, and rewrite the doc comments that count sections ("five supported", "six nav links", "Four ids") to the new numbers with a bullet saying this id was added by this plan in the same commit that mounted its body.
    - selection-state.ts: add `device-info` to PANE_IDS between payments and account, add its PANE_SECTION entry, and fix the "eight" wording in the comments and in stepSelection's doc.
    - overview-model.ts: add `device-info` to OVERVIEW_CARD_IDS between payments and account and fix the "six" wording.
    - Dashboard.svelte: import the DeviceInfo component and add an `active === 'device-info'` branch before the account branch, wrapped in DashboardSection through sectionProps('device-info', 'device-info') with the channel-scoped `ingestClient.data`, with a comment naming the `device-info` channel in the same style as its neighbours.
    Step C (copy, in ui-copy.ts, as a new clearly headed block after the Phase 8 block).
    - Add `'device-info': 'Device info'` to PANE_TITLES and `'device-info': 'Device_info'` to SECTION_TITLES.
    - Constants, with these exact strings: DEVICE_INFO_LOADING `Reading device information...`; DEVICE_INFO_ERROR `Device information could not be read from this export. Your imported data is unchanged. Drop the export again to retry.`; DEVICE_INFO_INTRO `The computers and devices your export lists, one table for each source file.`; DEVICE_SUMMARY_HEADING `In this export`; DEVICE_NOT_REPORTED `not reported`; DEVICE_TABLE_NOT_IN_EXPORT `Not in this export`; DEVICE_UNREADABLE_EXPLANATION `These rows held no device type, app, platform or version this viewer can read, so they are counted but not listed.`; DEVICE_MEMORY_NOTE `Memory is shown in GB (1 GB = 1,024 MB). Values under 1 GB stay in MB.`
    - Record constants: DEVICE_HEADINGS (pc `PC hardware`, blitz `Blitz devices`, assistant `Assistant app devices`), DEVICE_FILE_LABELS (the three file names with their original capitalisation: `WOT_Device_Info.csv`, `WOTB_Device_Info.csv`, `WOT_Assistant_Device_Info.csv`) and DEVICE_COLUMN_LABELS typed per source over the column-id types from the shared module via a type-only import. Labels: PC `PC type`, `OS`, `OS bits`, `CPU vendor`, `CPU`, `CPU cores`, `GPU vendor`, `GPU memory`, `Main memory`, `Multi-GPU`; Blitz `Platform`, `Vendor`, `Model`, `OS`, `Region`, `Shop`, `Country by IP`, `Country by time zone`; Assistant `Device type`, `App`, `Platform`, `Version`.
    - Formatters: formatMemoryFromMb per PD-07 (through formatNumber, so the locale rules stay in one place); formatDeviceFromFile (`From {file}`); formatDeviceNoRows (`{file} is in this export but holds no rows`); formatDeviceNoUsable (`The 1 row in this file could not be read` and `None of the {n} rows in this file could be read`); formatDeviceUnreadablePill (empty string for 0, `1 row could not be read`, `{n} rows could not be read`); formatDeviceMoreRows (`and {k} more row(s) not listed`); formatDeviceSourceCount for the summary value (`not in this export`, `no rows`, `{n} rows`, with `, {u} could not be read` appended when u is above 0); formatDeviceTableLabel (`{heading} table`).
    - Nothing in the existing strings changes: `git diff -U0` on ui-copy.ts must show added lines, plus the two record entries.
    Step D (state and components).
    - device-info-state.ts: pure, no copy and no Svelte. It exports deviceInfoSummary as specified under behavior and re-states nothing that finance-state already owns; the component imports acceptDataOutcome, deriveFinanceState and ShownBlock from finance-state, as vehicle-state already does.
    - DeviceInfo.svelte: props result and client, the SpendSummary script shape (a stamped `$state.raw` answer, a load function guarded by an alive flag, an effect keyed on importedAt, a derived block state), the channel `device-info`. Ready state renders one description list as the counts summary (one row per source in the fixed order pc, blitz, assistant, each with its heading, its formatted count and a per-source hook), the DEVICE_MEMORY_NOTE caption, then the three DeviceTable components in that order. The wrapper carries the block hook, a state attribute and aria-busy only while loading; the error is a role alert paragraph and the loading line a role status paragraph, both from ui-copy.
    - DeviceTable.svelte: props source and table. One section per source with a per-source hook and a status attribute, the heading from DEVICE_HEADINGS, the provenance caption from DEVICE_FILE_LABELS, then by status: Not in this export; the no-rows sentence; the no-usable sentence plus the unreadable notice; or the table inside a named, focusable horizontal scroll region with a visually hidden caption. A null cell renders the DEVICE_NOT_REPORTED word in a span styled with the muted token; a number renders through formatMemoryFromMb; a string renders as text. After the table: the more-rows line when `more` is above 0, then the shared ExcludedNotice with the per-source unreadable test id for the unreadable count. All text is interpolated, never injected as markup; the file declares no inline style attribute, no font size other than 14px, and no colour except `var(--token)` reads.
    - Copy the error box rule from SpendSummary and add `src/lib/features/device-info/DeviceInfo.svelte` to the files lists of the three existing status-colour entries in the allow-list in phase8-ui-review-guards.test.ts (PD-12), so the stale-entry guard still finds each literal in each listed file.
    Step E (verify and commit). `pnpm exec prettier --write` on touched files, then the verify command. `pnpm run build` is not needed: svelte-check inside `pnpm run check` compiles the components. Note for the executor: some existing e2e specs hardcode eight rows and four unsupported folders and are expected to be red until Task 3; do not edit them here. Commit as `feat(quick-261012-bog): add the Device info pane to the master-detail shell`.
  </action>
  <verify>
    <automated>pnpm exec prettier --check src tests && pnpm run test:unit && pnpm run check && pnpm run lint</automated>
  </verify>
  <done>The shell-list, copy, state and component-contract tests were observed red for the stated reason and are green; the list shows a ninth Device info row and the Overview a seventh card from the one shared derivation; the pane renders the counts summary and three tables with not-reported cells, GB memory and honest not-in-export, no-rows and could-not-be-read states, all through ui-copy; no new colour literal, font size, dependency or network API; unit, check and lint are green.</done>
</task>

<task type="auto">
  <name>Task 3: Correct the e2e enumerations, add the browser proof, update the docs, and run the full gates</name>
  <files>tests/e2e/shell/dashboard.spec.ts, tests/e2e/shell/master-detail-nav.spec.ts, tests/e2e/shell/identity-privacy.spec.ts, tests/e2e/shell/mobile-sweep.spec.ts, tests/e2e/shell/device-info.spec.ts, tests/fixtures/README.md, .planning/PROJECT.md, AGENTS.md</files>
  <read_first>
    - tests/e2e/shell/dashboard.spec.ts: SUPPORTED_IDS, SECTIONS_BY_ID, DATA_PANES and folderOfPane (near lines 95-140); the (sections-pending) test; SAMPLE_UNSUPPORTED_ORDER and the banner count assertions (near lines 600-760, including the case-variants test with five banners and the markup test's chip count); the (order) test; the parsing-progress expectation that maps SUPPORTED_IDS (near line 845)
    - tests/e2e/shell/master-detail-nav.spec.ts: the two `toHaveCount(8)` row-count assertions (near line 163), the `folderOf` map and the `panes` list (near lines 255-285), and the comments that say eight
    - tests/e2e/shell/identity-privacy.spec.ts near line 254 and tests/e2e/shell/mobile-sweep.spec.ts near lines 188 and 433 (loops over panes: confirm whether each enumerates pane ids and, if so, extend it)
    - tests/e2e/_support/helpers.ts: openSection, importExport, importAndOpen, listRow, detailPane (read only: no helper changes are needed, the PaneId type follows PANE_IDS)
    - tests/e2e/finance/spend.spec.ts (the shape of a block spec) and tests/unit/guards/ci-budget.test.ts (the 258 ceiling and how the total is measured)
    - tests/unit/guards/phase8-shell-guards.test.ts (master-detail-nav stays within 19 tests; a spec reading a dashboard section imports an opener; no skip, only or fixme marker)
    - .planning/PROJECT.md lines 5-30 and AGENTS.md lines 1-30 (the project paragraph and the Validated list); tests/fixtures/README.md (the Phase 5 data modules section)
  </read_first>
  <action>
    Step A (find every enumeration). Run `grep -rnE "toHaveCount\((4|5|8)\)|SAMPLE_UNSUPPORTED_ORDER|DATA_PANES|SUPPORTED_IDS|\beight\b|folderOf|'payments'" tests/e2e` and `pnpm run test:unit` as the starting point, then read each hit in its context. Correct only what the new category and the ninth pane make false; do not loosen an assertion to make it pass.
    Step B (correct the existing specs).
    - dashboard.spec.ts: add `device-info` to SUPPORTED_IDS, SECTIONS_BY_ID (`Device_info`) and DATA_PANES, update the comments that count sections and panes; the (sections-pending) test now names five sections as ready and Account as the one pending, with the ready list written out by name; SAMPLE_UNSUPPORTED_ORDER becomes Chat_history, Clans, Bans (three) and every banner count derived from it follows (the sample shows three banners; the case-variants export shows four: Chat_history, Clans, Bans, bans, with Device_info removed from its expected folder list); the (order) test title and comment say nine rows; the parse-progress expectation includes the Device_info category through SUPPORTED_IDS (it is derived) and nothing else needs a literal.
    - master-detail-nav.spec.ts: both row-count assertions become 9 (the muted count too), add device-info to `folderOf` and to the `panes` list so the provenance loop covers it. Add no test: this file is guarded at 19.
    - identity-privacy.spec.ts and mobile-sweep.spec.ts: if their pane lists are literal, add device-info to them so the privacy and no-horizontal-scroll sweeps cover the new pane; if they derive the list from PANE_IDS, change nothing.
    Step C (browser proof, at most two tests, PD-11). Create tests/e2e/shell/device-info.spec.ts in the style of the other shell specs, importing the opener helpers and the fixtures module for expected values, with no skip or only marker.
    - Test 1: import the sample, open the device-info pane, and assert in one flow: the section is ready and its provenance counts equal the derived sample counts; the three source sections exist in order with status ready; the PC table lists the fixture's row count, shows the muted not-reported word for the N/D cell, and shows a memory cell as GB through formatMemoryFromMb of the fixture value; the Assistant table lists the four readable rows with their extracted fields and the unreadable notice carries formatDeviceUnreadablePill of the fixture's unreadable count; the whole detail text contains neither canary, the key POST nor the text Spa id; the list row and the Overview card agree on the row total. Keep the 44px and 14px expectations to what the existing shell specs already assert globally; add no new geometry test.
    - Test 2: import a custom export that omits the Blitz file (`omitFiles` with its relative path), open the pane, assert the Blitz section says Not in this export while the PC and Assistant sections are still ready, and that the summary row for Blitz reads `not in this export`.
    Step D (docs, U-06). In .planning/PROJECT.md add `device information` to the dashboard list in "What This Is" and add a Validated bullet for Device_info in the style of its neighbours (three per-source tables, N/D as not reported, GB memory, the Assistant blob reduced at import and never stored or shown, the pane and its phase-less quick id 261012-bog); mirror the one-sentence change into the same paragraph of AGENTS.md inside its GSD project block. Add a short "Device_info data module" section to tests/fixtures/README.md describing the new fixture module, its canaries and why the sample carries it. README.md holds no category list (checked by grep), so it is not edited and no section is invented there.
    Step E (full gates, in this order).
    - `pnpm exec prettier --write` on touched files, then `pnpm run lint`, `pnpm run check`, `pnpm run test:unit`.
    - `pnpm exec playwright test --workers=2` for the whole suite (background if needed); every failure is either an enumeration this task missed or a real defect: fix it at its cause.
    - `pnpm exec playwright test --list | tail -1` must report at most 258 tests; expect 256 tests in 27 files. If it is higher, merge the two new tests into one.
    - `git diff --stat <commit before Task 1> HEAD -- package.json pnpm-lock.yaml src/lib/worker/db.ts` must print nothing.
    - Optional hygiene from the home CLAUDE.md: `graphify update .`, committing its output only if graphify-out is already tracked.
    Step F (summary and commit). Write 261012-bog-SUMMARY.md in this directory recording the planner decisions PD-01 to PD-12 as built or overridden, the three stored row shapes, the accepted legacy residual, every changed expectation by file, and the final listed e2e count. Commit as `feat(quick-261012-bog): cover Device info in the e2e enumerations and update the docs`.
  </action>
  <verify>
    <automated>pnpm exec prettier --check src tests && pnpm run lint && pnpm run check && pnpm run test:unit && pnpm exec playwright test --workers=2 && pnpm exec playwright test --list | tail -1</automated>
  </verify>
  <done>No spec still hardcodes eight rows or four unsupported folders; the sample-driven specs open Device info and pass; the new spec proves the populated pane, the not-reported and GB rendering, the unreadable count, the missing-file state and the absence of both canaries from the DOM; the docs name the category; lint, check, unit and the full Playwright suite are green; the listed e2e count is at most 258; package.json, the lockfile and db.ts are unchanged.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| export zip to worker row loop | Untrusted CSV cells, including a multi-line JSON-like blob that carries the account id (Spa id) and an opaque flags value, enter the import choke point |
| worker to IndexedDB | Whatever the choke point stores rests on the user's disk until Clear or replace |
| worker to main thread (postMessage) | The device-info view and its error detail cross to the page |
| view to DOM | Device strings are untrusted text rendered into tables and a summary |
| cached dataset from an earlier build | Rows stored before this change may still hold the raw POST cell |

## STRIDE Threat Register

Threat IDs continue the quick-plan convention (`T-{quick id}-NN`); `T-bog-SC` is the reserved supply-chain row.

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-bog-01 | Information Disclosure | Assistant blob persisted, posted or drawn (the Spa id and the flags value) | high | mitigate | The row is replaced by its four allow-listed fields or an unreadable marker before allRows.push (PD-02); the builder and the posted view carry cells only; canary tests scan every stored row, the posted view and the e2e DOM for both canaries, the key POST and the text Spa id (Tasks 1 and 3) |
| T-bog-02 | Information Disclosure | Legacy cache rows still holding the raw POST cell | low | accept | The same extractor re-reads them at query time so the view and DOM stay clean (PD-03, tested on a hand-written legacy snapshot). The blob remains at rest in that old cache until the next import or Clear; the account id is already in meta.accountRoot and in sanitised User_Info rows, and a version bump would cost every returning user the cached dataset |
| T-bog-03 | Denial of Service | Hostile blob or file: oversized cell, catastrophic pattern, `__proto__` keys | medium | mitigate | Length bound before any parse or pattern (8,192 chars); four fixed anchored patterns with no nested quantifiers and none built from data; allow-listed own string or number values only; Map-keyed lookups; tested with an oversized blob and a `__proto__` blob (Task 1) |
| T-bog-04 | Denial of Service | Very large Device_info files | low | mitigate | At most 200 rows per table cross postMessage with a "more rows" count; every text value is clamped to 200 characters; the row loop is the existing one (PD-09) |
| T-bog-05 | Information Disclosure | Worker error detail printed on the page | low | mitigate | acceptDataOutcome drops the detail and the block shows one fixed sentence; the worker answers with the error name only (existing handleDataQuery behaviour, covered by the state test in Task 2) |
| T-bog-06 | Information Disclosure | Zero-network guarantee across the new modules and the e2e spec | low | mitigate | No network API, import or dependency is added; the ESLint network ban stays in force over src/lib/worker and src/lib/features; the zero-network spec runs in the full e2e pass (Task 3) |
| T-bog-07 | Information Disclosure | Strip keyed on the folder name and a header spelling | low | accept | A copy of the Assistant file misfiled outside Device_info, or under a homoglyph header, keeps its cells at rest; this is the same accepted class as the D-18 deny-list residual (T-03-03) and the cells never reach the view because the Device channel reads three exact file names in one category |
| T-bog-SC | Tampering | npm/pip/cargo installs | high | accept | No package is installed and neither package.json nor the lockfile changes (asserted by the final git diff in Task 3), so the package-legitimacy gate has nothing to audit |
</threat_model>

<verification>
Run in order at the repository root after Task 3:
1. `pnpm exec prettier --check src tests` (clean).
2. `pnpm run lint`, `pnpm run check`, `pnpm run test:unit` (all green, including the new aggregate, worker, state, component-contract, shell-list and copy tests, the colour and font-size guards, and the CI budget guard).
3. `pnpm exec playwright test --workers=2` (full suite, no skip or only marker), then `pnpm exec playwright test --list | tail -1` reports at most 258 tests (expected 256 in 27 files).
4. `git diff --stat <commit before Task 1> HEAD -- package.json pnpm-lock.yaml src/lib/worker/db.ts` prints nothing (no dependency, no schema change); use the commit that was HEAD when execution started, not a relative HEAD~N.
5. Privacy spot check on the built preview with the sample export: open Device info and confirm in the page text that the Spa id canary, the flags canary and the key POST appear nowhere; open DevTools Application, IndexedDB, rows, and confirm the Assistant rows hold only DEVICE_TYPE, APP, PLATFORM and VERSION or a ROW_STATE marker; the Network tab stays empty after the drop.
6. Visual spot check at 1280 and 375 wide: the list shows nine rows with Not yet supported last; Device info opens with the summary and three tables; the not-reported words are muted; wide tables scroll inside their own region and the page itself does not scroll sideways.
</verification>

<success_criteria>
- Device_info is a supported category on import and on replay, is never listed as not yet supported, and every test and doc that enumerated the supported set says so.
- The Device info pane exists as a list row, an Overview card and a detail with three per-source tables and a counts summary, with N/D and blanks as muted "not reported", memory in GB through one ui-copy formatter, and honest not-in-export, no-rows and could-not-be-read states.
- The raw Assistant blob and the Spa id are in no stored row, no posted view and no DOM, on the fresh path and the legacy path; both are proven by canary tests.
- No dependency, no network API, no schema change, no raw-HTML interpolation, no inline style attribute; fflate stays worker-only; the listed e2e count stays within the 258 ceiling; the e2e enumerations are corrected rather than loosened.
- Three commits with the `feat(quick-261012-bog):` prefix and no co-author trailer, and a SUMMARY that records the planner decisions so the requester can override any of them.
</success_criteria>

<output>
Create `.planning/quick/261012-bog-add-device-info-supported-category-pane/261012-bog-SUMMARY.md` when done
</output>
