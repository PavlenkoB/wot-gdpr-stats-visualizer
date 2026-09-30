---
status: complete
phase: 01-ingest-foundation-zero-network-guard
source: [01-01-SUMMARY.md, 01-02-SUMMARY.md, 01-03-SUMMARY.md, 01-04-SUMMARY.md, 01-05-SUMMARY.md]
started: 2026-09-28T06:35:04Z
updated: 2026-09-30T00:00:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

[testing complete]

## Tests

### 1. Plain Vite + Svelte + TS scaffold, no router
expected: "pnpm run build && pnpm run preview" boots the app; package.json has no @sveltejs/kit dependency (no SvelteKit, no router).
result: pass

### 2. Build-time CSP meta tag
expected: The built dist/index.html carries a CSP meta tag with default-src 'self'; connect-src 'none' (no "unsafe-" substring), placed before the module script tag.
result: pass

### 3. Typed worker message contract
expected: The typed worker message contract (IngestRequest/IngestResponse/IngestStage/ClassifyResult/CategoryEntry/CategoryStatus/WorkerLike/WorkerScopeLike/IngestViewState) exists and `pnpm run check` (svelte-check + tsc) reports 0 errors.
result: pass

### 4. Long-lived worker: path-only unzip + classify
expected: The worker does path-only unzip + classify as a long-lived instance, posting stage messages and using a single error path — never inflating file contents just to list them.
result: pass

### 5. Single eager worker spawn (IngestClient)
expected: Exactly one Worker is spawned, eagerly at app init (before any file is chosen) — visible as data-worker-ready=true on load, and only one `new Worker(` call site in src/.
result: pass

### 6. Tracer import: account heading / failure banner
expected: Choosing a .zip file shows a heading "Account: {raw numeric ID}" on success, or a single generic failure banner on error.
result: pass
source: automated
coverage_id: 01-01-D6

### 7. Synthetic fixture + PII gitignore policy
expected: The committed test fixture is synthetic (built in-memory via fflate.zipSync, no real player data); tests/fixtures/private/ and any *.zip are gitignored, and no .zip file is tracked in git.
result: pass

### 8. Real Wargaming export: account heading / failure banner
expected: Uploading a REAL Wargaming data export (kept outside the repo, e.g. in tests/fixtures/private/, never committed) shows the raw numeric account ID heading on success, or the single generic failure banner on error — same behavior the synthetic fixture predicts. Needs a real Wargaming export; this is a privacy-boundary check the agent cannot automate.
result: pass
reported: "User confirmed with a real export — account heading '1234567' rendered with categorized results (4 supported, 2 known-deferred, 9 unknown)."

### 9. Lint/typecheck/unit toolchain green
expected: `pnpm run lint`, `pnpm run check`, and `pnpm run test:unit` all exit 0.
result: pass

### 10. Network-API ban in source
expected: Adding a raw network call (fetch, XMLHttpRequest, WebSocket, sendBeacon, etc.) anywhere under src/ — including inside the worker — fails lint at error severity.
result: pass
reported: "Verified via tests/unit/lint-guards.test.ts (part of the 143-test green run) — 16 no-restricted-globals probes across 8 APIs x 2 paths (src/lib, src/lib/worker) all fire correctly."

### 11. Raw-HTML / inline-style ban in Svelte markup
expected: Adding an {@html ...} tag, or a style="..." attribute, in any .svelte file fails lint at error severity (folder/file names from untrusted zip entries must never render as raw HTML; the CSP has no inline-style allowance).
result: pass
reported: "Verified via tests/unit/lint-guards.test.ts — svelte/no-at-html-tags and svelte/no-inline-styles probes both fire at error severity."

### 12. fflate import confined to the worker
expected: Importing `fflate` from any file under src/ EXCEPT src/lib/worker/** fails lint; the same import inside src/lib/worker/** is allowed.
result: pass
reported: "Verified via tests/unit/lint-guards.test.ts — no-restricted-imports fires for src/lib/__lint_probe__.ts, does not fire for src/lib/worker/__lint_probe__.ts (negative case)."

### 13. No false positives on clean code
expected: A benign, ordinary source file triggers none of the network-API / raw-HTML / inline-style / fflate-boundary guard rules.
result: pass
reported: "Verified via tests/unit/lint-guards.test.ts clean-control probe — guard-id set is empty for a benign file."

### 14. CI runs full gate on every push/PR
expected: The GitHub Actions workflow runs lint, typecheck, unit tests, and Playwright (incl. the zero-network spec) as separate, non-skippable steps on every push and every PR, with every third-party action pinned to a full commit SHA.
result: pass

### 15. Path-only zip enumeration module
expected: Zip entries are enumerated by path only, in one dedicated module that is the sole fflate importer in src/ — it lists names without inflating any entry's contents.
result: pass

### 16. Export classifier handles real-world zip shapes
expected: The classifier normalizes entry paths, ignores OS metadata (e.g. __MACOSX/, .DS_Store), detects the single account-ID root folder, and maps category folders beneath it — correctly handling a renamed root folder, a macOS-rezipped export, and backslash path separators.
result: pass

### 17. Unrecognized export shape -> single generic error
expected: An export with no single root folder, or no recognizable category folders, surfaces as one generic error message to the UI — no real folder or file names ever cross the worker boundary.
result: pass

### 18. Fixture matrix covers edge-case zip shapes
expected: Synthetic fixtures exist for a renamed root, macOS re-zip, backslash separators, directory entries, no-recognized-category, multi-root, empty, not-a-zip, truncated, and a corrupted/inflate-trap zip — and the original 12-name sample the zero-network e2e spec depends on is unchanged.
result: pass

### 19. Zero-network regression still green
expected: The zero-network Playwright spec from plan 01-01 still passes (Account heading renders, no requests after initial load).
result: pass
source: automated
coverage_id: 01-03-D5

### 20. Real export: edge-case zip shapes via the app
expected: Uploading a REAL Wargaming export with a renamed root / macOS re-zip / backslash paths / empty folders / a corrupted zip, through the actual app dropzone, resolves the same way the synthetic fixtures predict. Needs a real Wargaming export; this is a privacy-boundary check the agent cannot automate.
result: pass
reported: "User confirmed a mac-rezipped real export classifies fine. Separately found: wrapping the export in an extra top-level folder shows the generic failure banner — this is documented as a known, deliberate limitation (01-03-PLAN.md FA-01-03-3), not a new bug; see Gaps for the disposition question."

### 21. Only a single valid .zip file is accepted
expected: Selecting anything other than exactly one non-empty file whose name ends in .zip (case-insensitive) is rejected before it reaches the worker (e.g. wrong extension, no file, multiple files, a 0-byte file).
result: pass

### 22. Every IngestClient failure path recovers cleanly
expected: Pre-check rejection, a worker error, a worker onmessageerror, a broken worker, a stale job, and a second submission while busy are all handled correctly, with no dangling auto-dismiss timer and a clean re-arm after error.
result: pass

### 23. Real-browser Dropzone visuals
expected: In an actual browser, dragging a file over the Dropzone shows a real hover highlight and a visible focus ring, and the native file picker filters to .zip files. Playwright's synthetic drag/focus events don't render these — needs a human eye.
result: pass

### 24. Failure banner placement + stray-drop guard
expected: On any import failure, a FailureBanner appears above the Dropzone; dropping a file anywhere else on the window (outside the dropzone) does not trigger the browser's default "open this file" navigation.
result: pass

### 25. E2E drag-and-drop test helper
expected: The Playwright test helper's dropFiles() synthesizes a real File-backed DataTransfer and dispatches dragenter/dragover/drop, so e2e tests can simulate a real drag-and-drop.
result: pass

### 26. Import-failure paths covered end-to-end
expected: Every IMPORT-05 failure mode (wrong extension, no file, multiple files, empty file, not-a-zip, truncated, no-recognized-category, multi-root, recovery, no-auto-dismiss, click-to-pick, drag-to-pick, stray-drop prevention) works correctly through the built app.
result: pass
source: automated
coverage_id: 01-04-D6

### 27. Failure banner has no interactive children
expected: The FailureBanner never renders a link or button inside it (plain-text alert only).
result: pass
source: automated
coverage_id: 01-04-D7

### 28. One generic failure sentence, no leaks
expected: There is exactly one generic failure sentence used anywhere for import failures in the shipped source — no per-cause custom copy that leaks additional detail.
result: pass

### 29. Zero-network regression still green (post-dropzone)
expected: The zero-network Playwright spec still passes with the new Dropzone in place (file-input test id preserved, Account heading preserved, no requests after the drop).
result: pass
source: automated
coverage_id: 01-04-D9

### 30. Worker message contract untouched (plan 4)
expected: Plan 01-04 does not modify the Phase-1 worker message contract from plan 01-01.
result: pass

### 31. Minimum-visible-processing floor
expected: A very fast import still shows the "processing" state for a minimum floor duration (no instant flash), before settling to done or error.
result: pass
source: automated
coverage_id: 01-05-D1

### 32. Done-state guard and reset()
expected: Submitting a new file while already "done" is a no-op that leaves the current result intact; a "Start over" reset returns the app to the initial import-ready state.
result: pass
source: automated
coverage_id: 01-05-D2

### 33. Stage text and summary copy
expected: Processing-stage labels and the post-import summary line render correct, non-placeholder text for every stage and outcome.
result: pass
source: automated
coverage_id: 01-05-D3

### 34. Category badges after import
expected: After a successful import, category badges appear grouped by status, including for an export whose folder layout isn't one of the fixed known layouts (e.g. a renamed root with a never-seen folder).
result: pass
source: automated
coverage_id: 01-05-D4

### 35. Results view: heading, summary, badges, Start over
expected: After import, the account heading, a summary line, the grouped category badges, and a "Start over" control all appear; "Start over" works in a single click with no confirmation dialog.
result: pass
source: automated
coverage_id: 01-05-D5

### 36. Processing feedback (spinner + stage text)
expected: While an import is in progress, a spinner and per-stage status text are visible (with a reduced-motion-safe fallback), and the control is marked busy/disabled.
result: pass
source: automated
coverage_id: 01-05-D6

### 37. Start-over wiring end-to-end
expected: Clicking "Start over" after a completed import returns to the Dropzone, and importing a second file afterward classifies correctly as a fresh result.
result: pass
source: automated
coverage_id: 01-05-D7

### 38. Large export (20,000 entries) fixture
expected: A 20,000-entry synthetic export fixture (8 categories x 2,500 files) exists and is used to exercise the import path at scale.
result: pass
source: automated
coverage_id: 01-05-D8

### 39. Page stays responsive on a large import
expected: Importing the 20,000-entry export keeps the page responsive — no single main-thread task blocks for 250ms or more.
result: pass
source: automated
coverage_id: 01-05-D9

### 40. Zero network + single worker across multiple uploads
expected: Across a whole session — sample import, start over, a second import, a bad file, a truncated file, a renamed-root file — there is exactly one worker URL and zero network requests after the initial page load.
result: pass
source: automated
coverage_id: 01-05-D10

### 41. No file contents ever rendered
expected: Synthetic PII-shaped strings from the fixture (a fake email, a fake IP) never appear anywhere in the rendered page body.
result: pass
source: automated
coverage_id: 01-05-D11

### 42. Real 2021 Wargaming export: full flow end-to-end
expected: Importing a REAL Wargaming data export (kept outside the repo, gitignored) completes the whole import flow successfully on a real account. Owner-only PII backstop — needs a real export; queued until one is available.
result: pass
reported: "User confirmed — real export completed the full flow: account heading, categorized results view with badges, and Start over control all rendered correctly."

## Summary

total: 42
passed: 42
issues: 0  # G-01-20 resolved by 01-06
pending: 0
skipped: 0

## Gaps

- gap_id: G-01-20
  truth: "A real export wrapped in an extra top-level folder (or a rootless re-zip with category folders at the top level) classifies correctly, same as a normal single-root export."
  status: resolved
  resolved_by: 01-06-PLAN.md
  resolved_at: 2026-09-30
  reason: "User reported: adding an additional top-level folder around a real export shows the generic failure banner (\"This doesn't look like a Wargaming data export...\") instead of classifying successfully. This reproduces the documented-but-deferred limitation FA-01-03-3 (01-03-PLAN.md:344); user chose to fix it now rather than accept it as-is."
  severity: major
  test: 20
  root_cause: "detectRoot() in src/lib/worker/classify.ts hard-codes a single fixed depth: it always treats the FIRST path segment as the account-ID root, and categoryFoldersUnder() always looks exactly one segment below that root for category names. A wrapper folder (WrapperName/1234567/Activity_history/...) makes detectRoot() return \"WrapperName\" as root, so categoryFoldersUnder() finds only \"1234567\" (an unrecognized 'category') -> analyzeExport() returns no-recognized-category. A rootless re-zip (category folders directly at top level, no account-ID folder) instead trips no-single-root (multi-category case) or no-category-folders (single-category case) because detectRoot() sees >1 (or a non-category) first segment. All three collapse to the same generic UI failure by design (D-05/D-07, confirmed correct and unrelated)."
  artifacts:
    - path: "src/lib/worker/classify.ts"
      issue: "detectRoot()/categoryFoldersUnder()/analyzeExport() assume a single fixed nesting depth (root/category/...); no fallback for an extra wrapper level or for category folders with no account-ID root at all"
    - path: "tests/fixtures/export-fixtures.ts"
      issue: "no fixture for genuine two-level wrapper nesting (wrapper/accountId/category/...) or a multi-category rootless re-zip — the shapes needed to regression-test the fix"
    - path: "src/lib/worker/ingest.worker.ts"
      issue: "confirmed correct and unrelated (generic-failure-only UI surfacing is intentional, D-05/D-07) — no change needed here"
  missing:
    - "detectRoot()/analyzeExport() become depth-tolerant: when the first segment's children yield no recognized category, try the second segment as the candidate root (handles wrapper folder)"
    - "when there is no single first segment but the top-level segments themselves match recognized/known category names, treat the archive root itself as the account root with no account-ID folder (handles rootless re-zip)"
    - "new fixtures in export-fixtures.ts: a two-level wrapper export and a multi-category rootless re-zip, to regression-test the fix"
  debug_session: ".planning/debug/wrapped-export-classify.md"
