---
phase: "01"
slug: "ingest-foundation-zero-network-guard"
status: validated
nyquist_compliant: true
wave_0_complete: true
validated: "2026-09-28"
backfill: true
backfill_note: "Reconstructed on 2026-09-29 from completion evidence (01-VERIFICATION.md, plan summaries, git history) — no pre-execution draft was seeded. Every status below was re-derived from the shipped suites and the verification report, not copied from a plan."
created: "2026-09-28"
---

# Phase 01 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Backfilled after the phase shipped; see `backfill_note` in the frontmatter.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 5.0.2 (unit, `environment: 'node'`) + Playwright 1.63.0 (e2e, Chromium only, built app only) |
| **Config file** | `vitest.config.ts`, `playwright.config.ts` |
| **Quick run command** | `pnpm test:unit` |
| **Full suite command** | `pnpm test:unit && pnpm build && pnpm test:e2e` |
| **Estimated runtime** | unit a few seconds, full suite ~2-3 minutes including build + e2e |

| Suite | Files | Tests (as shipped 2026-09-28) |
|-------|-------|------------------------------|
| Unit (Phase 1-owned files) | 4 (`classify`, `ingest-client`, `lint-guards`, `zip-paths`) | 170 |
| E2E (Phase 1-owned files) | 3 (`zero-network`, `import-failure`, `import-flow`) | 19 |

> The 19 e2e tests listed above include `import-flow.spec.ts` and `import-failure.spec.ts`, which were **introduced in Phase 1** but **re-pointed at the dashboard in Phase 3 plan 03-07**. Phase 1's original assertions no longer exist in those files; their authorship is Phase 1 but their current behaviour coverage is Phase 3 (see `03-VALIDATION.md` for the re-pointed evidence). `zero-network.spec.ts` is unchanged from Phase 1 and still asserts the standing PLATFORM-02 guard.

---

## Sampling Rate

- **After every task commit:** `pnpm test:unit` (the classifier is pure and runs in <2 s)
- **After every plan wave:** `pnpm test:unit && pnpm run lint && pnpm run check`
- **Before `/gsd-verify-work`:** full suite must be green (`pnpm test:unit && pnpm build && pnpm test:e2e`)
- **Max feedback latency:** unit <5 s — satisfied with wide margin

---

## Per-Requirement Verification Map

Keyed by requirement ID. Evidence column names the tests / fixtures that actually carry the check. The 01-06 plan closed G-01-20 (depth-tolerant classification for wrapper-around-account and rootless re-zip exports); the unit tests under "depth-tolerant detection (G-01-20)" below were added by 01-06 and were the RED that plan made GREEN.

| Requirement / Criterion | Behavior | Test Type | Automated Command | Evidence | Status |
|-------------------------|----------|-----------|-------------------|----------|--------|
| IMPORT-02 / SC1 | Root + category auto-detection on renamed-root + extra-unknown-folder fixture | unit | `pnpm exec vitest run tests/unit/classify.test.ts` | `classify.test.ts` > `analyzeExport — happy paths via listEntryPaths` (6 tests) incl. `buildRenamedRootExport`, `buildSampleExport` (SAMPLE_BADGE_ORDER + SAMPLE_FILE_COUNTS), `buildBackslashExport` (separator normalized), `buildMacRezippedExport` (OS metadata filtered); `buildSampleExport` yields 12 names (`zip-paths.test.ts`); `buildWrapperExport` and `buildRootlessExport` (depth-tolerant) | ✅ green |
| IMPORT-02 / depth-tolerant (G-01-20) | Wrapper-around-account and rootless re-zip classify to the same SAMPLE_EXPECTED_COUNTS as a normal export; ambiguous wrapper (two unrecognized children) still fails rather than silently guessing | unit | `pnpm exec vitest run tests/unit/classify.test.ts -g 'depth-tolerant'` | `classify.test.ts` > `analyzeExport — depth-tolerant detection (G-01-20)` (7 tests) incl. wrapper/rootless/debug-session-literal/ambiguous-wrapper/pre-existing-fixture-preservation | ✅ green |
| IMPORT-02 / SC1 | Per-entry mapping: `${root}/${category}/${file}.csv` resolves correctly for normal, wrapper, and rootless paths; OS metadata and non-csv entries rejected | unit | `pnpm exec vitest run tests/unit/classify.test.ts -g 'resolveCsvFileCategory'` | `classify.test.ts` > `resolveCsvFileCategory — per-entry mapping` (7 tests) | ✅ green |
| IMPORT-02 / SC1 | Path normalization: backslash → forward slash, strip leading `./` and `/`, preserve trailing `/` | unit | `pnpm exec vitest run tests/unit/classify.test.ts -g 'normalizeEntryPath'` | `classify.test.ts` > `normalizeEntryPath` (4 tests) | ✅ green |
| IMPORT-02 / SC1 | macOS / Windows OS metadata filtering (`.DS_Store`, `Thumbs.db`, `desktop.ini`, `__MACOSX` sidecar) | unit | `pnpm exec vitest run tests/unit/classify.test.ts -g 'isOsMetadataEntry'` | `classify.test.ts` > `isOsMetadataEntry` (5 tests) | ✅ green |
| IMPORT-02 / SC1 | `detectRoot` returns null for empty list, lone top-level file, no-recognized-category; returns the segment when one path is wholly inside it and the directory entry also lives beneath it | unit | `pnpm exec vitest run tests/unit/classify.test.ts -g 'detectRoot'` | `classify.test.ts` > `detectRoot` (4 tests) | ✅ green |
| IMPORT-02 / SC1 | `classifyExport` back-compat wrapper returns the same `ClassifyResult` as `analyzeExport` for success and `null` for every failure case | unit | `pnpm exec vitest run tests/unit/classify.test.ts -g 'classifyExport'` | `classify.test.ts` > `classifyExport — back-compat wrapper (01-01 compatibility)` (2 tests) | ✅ green |
| IMPORT-05 / SC2 | Non-zip file, structurally-unrecognizable zip, multi-root zip, files-only-under-root zip, empty archive, metadata-only archive all map to one of the named failure reasons | unit | `pnpm exec vitest run tests/unit/classify.test.ts -g 'failure reasons'` | `classify.test.ts` > `analyzeExport — failure reasons` (6 tests) | ✅ green |
| IMPORT-05 / SC2 | Pre-check rejects non-zip by extension (case-insensitive), zero-byte file, multi-file selection, empty selection — with no worker message posted | unit | `pnpm exec vitest run tests/unit/ingest-client.test.ts -g 'precheckFiles'` | `ingest-client.test.ts` > `precheckFiles — pure function` (6 tests); `submitFiles — pre-check rejection` (4 tests) | ✅ green |
| IMPORT-05 / SC2 | Generic failure state shown in UI; reload after a failure lands on identity header without re-prompting the failure | e2e | `pnpm exec playwright test tests/e2e/import-failure.spec.ts` | `import-failure.spec.ts` (10 tests) — see *Authorship caveat* above; the **current** assertions live in `import-failure.spec.ts` (Phase 3-re-pointed) | ✅ green (Phase 3 re-pointed) |
| SC3 / dropzone | Drop target is disabled while a file is processing; every upload reuses the same Worker instance; the page stays responsive during unzip | e2e | `pnpm exec playwright test tests/e2e/import-flow.spec.ts` | `import-flow.spec.ts` (7 tests) incl. `(a)` stage feedback + account heading + summary + badges, `(b)` renamed root + never-seen folder, `(e)` one-worker + zero-network per session, `(f)` large-export responsiveness — *current assertions re-pointed in 03-07; the originals exercised the Phase 1 results view* | ✅ green (Phase 3 re-pointed) |
| SC3 / state machine | Pre-check / submit / ready handshake / `MIN_PROCESSING_MS` floor / `done`-state guard / replace-on-drop / cache-status / cache-check error recovery / `cleared` acknowledgment / `reset()` / worker `onerror` paths | unit | `pnpm exec vitest run tests/unit/ingest-client.test.ts` | `ingest-client.test.ts` (71 tests across 14 describes — `'checking-cache' initial state`, `'ready' handshake`, `MIN_PROCESSING_MS floor`, `STAGE_TEXT plumbing`, `cache-status response`, `precheckFiles`, `submitFiles — happy path / pre-check rejection / worker error responses`, `done-state guard`, `replace-on-drop`, `confirmPending`, `reset()`, `the displayed dataset survives a replace confirm and a failed replace`, `a worker error during the on-load cache check never leaves the spinner`) | ✅ green (Phase 1 owned the original ~25 tests; Phase 3 (03-03) added the `displayed dataset survives replace + failure` block + the cache-check error recovery + the widened replace guard) |
| SC3 / zip-bomb immunity | `listEntryPaths` enumerates entries without ever inflating any entry data; a full `unzipSync` on the same bytes throws | unit | `pnpm exec vitest run tests/unit/zip-paths.test.ts` | `zip-paths.test.ts` (7 tests) incl. `listEntryPaths — happy path` (2), `listEntryPaths — corrupt bytes throw (RESEARCH A2, locked)` (3), `listEntryPaths — valid empty zip does NOT throw` (1), `listEntryPaths — never inflates entry data (zip-bomb immunity)` (1) | ✅ green |
| SC3 / corrupt-zip handling | `unzipSync` throws rather than corrupting state silently; `analyzeExport` propagates the failure to a named reason | unit | `pnpm exec vitest run tests/unit/zip-paths.test.ts tests/unit/classify.test.ts` | `zip-paths.test.ts` > `corrupt bytes throw` (3 tests); `classify.test.ts` `analyzeExport — failure reasons` covers the resulting `no-recognized-category` and `no-single-root` paths | ✅ green |
| PLATFORM-02 / SC4 | Zero network requests after initial load, including the worker script fetch | e2e | `pnpm exec playwright test tests/e2e/zero-network.spec.ts -g 'no network requests'` | `zero-network.spec.ts` `(no network requests after initial load, including the worker script fetch)` — counts page-initiated requests after `page.goto()` and diffs against the baseline | ✅ green |
| PLATFORM-02 / SC4 | CSP meta tag present in served HTML with `default-src` and `connect-src 'none'` | e2e | `pnpm exec playwright test tests/e2e/zero-network.spec.ts -g 'CSP'` | `zero-network.spec.ts` `(served HTML carries the CSP meta tag with default-src and connect-src none)` | ✅ green |
| PLATFORM-02 / SC4 (defense-in-depth) | Source-level network ban: `fetch`, `XMLHttpRequest`, `WebSocket`, `WebTransport`, `EventSource`, `RTCPeerConnection`, `importScripts`, `fetchLater`, plus `window`/`self`/`globalThis`/`navigator` property access, are forbidden in `src/` and `src/lib/worker/` | unit | `pnpm exec vitest run tests/unit/lint-guards.test.ts` | `lint-guards.test.ts` (47 tests) — `no-restricted-globals` (8 network identifiers × 2 = 16 tests), `no-restricted-properties` (window/self/globalThis/navigator prefix × 2 scopes), `no-restricted-imports` (fflate worker-boundary 2 tests), markup ban (`svelte/no-at-html-tags`, `svelte/no-inline-styles`), clean control | ✅ green |
| PLATFORM-02 / SC4 (defense-in-depth) | Markup ban: `{@html ...}` and inline `style="..."` cannot be introduced anywhere in the codebase | unit | `pnpm exec vitest run tests/unit/lint-guards.test.ts -g 'markup ban'` | `lint-guards.test.ts` > `markup ban — Svelte rules` (2 tests) | ✅ green |

*Status: ✅ green · ⚠️ covered with a known seam · ❌ red · ⏭ manual-only*

---

## Wave 0 Requirements (backfilled reference)

Phase 1 was the greenfield scaffold — there was no `package.json` and no test framework at the start. The Wave 0 gate established in `01-RESEARCH.md`:

- [x] `vitest.config.ts` — created in 01-01
- [x] `playwright.config.ts` — created in 01-01
- [x] `tests/fixtures/export-fixtures.ts` — synthetic builders (`buildSampleExport`, `buildEmptyZip`, `buildSingleFileZip`, `buildMultiRootZip`, `buildNoRecognizedCategoryZip`, `buildFilesOnlyUnderRootZip`, `buildMacRezippedExport`, `buildBackslashExport`, `buildRenamedRootExport`, `buildWrapperExport`, `buildRootlessExport`, `buildInflateTrapExport`, `buildNotAZipBytes`, `buildTruncatedExport`); no committed binary fixtures; `fflate.zipSync` builds them in test setup
- [x] `tests/unit/classify.test.ts` — 45 tests at shipment, plus 7 G-01-20 tests added by 01-06
- [x] `tests/e2e/zero-network.spec.ts`, `tests/e2e/import-failure.spec.ts`, `tests/e2e/import-flow.spec.ts` — created in Phase 1, partially re-pointed in 03-07
- [x] Framework install: `sv create` `--add vitest,playwright`

---

## Manual-Only Verifications

- [x] None — every Phase 1 behavior has automated coverage per the map above (unit + e2e)
- [x] `01-RESEARCH.md` A2 (fflate corrupt-zip throw behaviour) was promoted to a locked RED-then-GREEN test (`zip-paths.test.ts` > `corrupt bytes throw`) rather than left as a manual spike

---

## Coverage seams / known limitations (backfilled)

- **`import-flow.spec.ts` and `import-failure.spec.ts` assertions are no longer Phase 1 behaviour** — they were re-pointed in plan 03-07 against the dashboard shell. The Phase 1 originals (which asserted `results`, `account-heading`, `summary-line`, `category-badge`, `badge-skipped-count`, and a level-2-heading count) no longer exist in the file. Phase 1's claim is on the authorship + the original assertions at the time the phase closed; the *current* e2e coverage of those user-visible behaviors is Phase 3's responsibility (see `03-VALIDATION.md`).
- **`ingest-client.test.ts` Phase 1 vs Phase 3 split** — the original Phase 1 file covered precheck, submit, ready handshake, MIN_PROCESSING_MS floor, replace-on-drop, and reset. Plan 03-03 widened the replace guard (now keyed on `result !== null`, not `state === 'done'`), made `result` mean "the last known cached dataset" (D-27), and added cache-check error recovery; those tests landed in the same file under new `describe` blocks. The 71-test count is the merged total at the time this backfill was written.
- **CR-01, WR-01..06, IN-01..05** — advisory code-review findings from `01-VERIFICATION.md`. None block the phase goal; CR-01 (wrapper-around-categories misclassification when the wrapper sits directly above recognized categories with no inner account folder) is the only correctness finding and is logged for follow-up in a later phase.
- **`webserver-teardown.test.ts`** exists for the Phase 1 webServer teardown handling and is not Phase 1's primary behaviour coverage. It is excluded from the Phase 1 count.

---

## Validation Sign-Off

- [x] All Phase 1-owned tasks had `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covered all MISSING references (`vitest.config.ts`, `playwright.config.ts`, fixture builders, test files)
- [x] No watch-mode flags in any test command
- [x] Feedback latency < 30 s for unit; full suite green in < 3 min
- [x] `nyquist_compliant: true` set in frontmatter

---

## Metadata

**Validation date:** 2026-09-28 (Phase 1 close)
**Backfilled:** 2026-09-29 (when `gsd-health` flagged the missing `VALIDATION.md`)
**Source of truth for status:** `01-VERIFICATION.md` (`status: passed`, `score: 9/9 plan 01-06 must-haves verified · 4/4 ROADMAP success criteria met · 3/3 requirement IDs satisfied`, `gaps_remaining: []`)