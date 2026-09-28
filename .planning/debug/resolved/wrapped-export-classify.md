---
status: resolved
trigger: "UAT Test 20 (01-ingest-foundation-zero-network-guard) — G-01-20: a real export wrapped in an extra top-level folder (or a rootless re-zip with category folders at the top level) shows the generic failure banner instead of classifying correctly."
created: 2026-09-28T00:00:00Z
updated: 2026-09-28T00:00:00Z
resolved: 2026-09-28T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED — see Resolution
test: read detectRoot/categoryFoldersUnder/analyzeExport in src/lib/worker/classify.ts (branch gsd/phase-01-ingest-foundation-zero-network-guard) and trace both zip shapes by hand
expecting: n/a — diagnosis complete, goal is find_root_cause_only
next_action: none — return ROOT CAUSE FOUND to caller; plan-phase --gaps handles the fix

## Symptoms

expected: Uploading a real export wrapped in an extra top-level folder (wrapper/accountId/category/...), or a rootless re-zip (category folders directly at the top level, no accountId folder), should classify correctly — at least as gracefully as the already-supported "renamed root" case.
actual: Both shapes show the generic failure banner ("This doesn't look like a Wargaming data export...") from src/lib/ui-copy.ts GENERIC_FAILURE_MESSAGE. Underlying worker error: "unrecognized export: no-recognized-category (<n> entries)" (wrapper case) thrown in src/lib/worker/ingest.worker.ts, caught generically, never surfaced to the UI (by design, D-05/D-07 — that part is correct behavior, not the bug).
errors: "Error: unrecognized export: no-recognized-category (<n> entries)" for the wrapper-folder shape; "Error: unrecognized export: no-single-root (<n> entries)" for the multi-category rootless-re-zip shape (derived by code trace, not yet observed live — see Evidence).
reproduction: UAT Test 20, .planning/phases/01-ingest-foundation-zero-network-guard/01-UAT.md, user testing with a real Wargaming export wrapped in an extra top-level folder.
started: Present since 01-03-PLAN.md shipped detectRoot()/analyzeExport() (documented in-plan as FA-01-03-3, "reversible", not treated as a bug until this UAT pass).

## Eliminated

(none — root cause found directly from code trace + pre-existing documented assumption, no false starts)

## Evidence

- timestamp: 2026-09-28T00:00:00Z
  checked: src/lib/worker/classify.ts detectRoot() (branch gsd/phase-01-ingest-foundation-zero-network-guard)
  found: detectRoot() collects the FIRST path segment of every prepared entry into segmentCounts, and only returns a root when segmentCounts.size === 1. It has no concept of "how many segments deep is the real account-ID folder" — it always treats the outermost segment as the root, regardless of nesting depth.
  implication: A wrapper folder around a real export (WrapperName/1234567/Activity_history/...) makes "WrapperName" the sole first segment → detectRoot() returns "WrapperName" as root. This is architecturally indistinguishable from the already-supported "renamed root" case at this step — the difference only manifests one level deeper.

- timestamp: 2026-09-28T00:00:00Z
  checked: src/lib/worker/classify.ts categoryFoldersUnder() and analyzeExport()
  found: categoryFoldersUnder("WrapperName", paths) looks at the segment immediately after "WrapperName/" for every path — which is "1234567" (the real account-ID folder), not a category name. Every path shares that one segment, so counts = { "1234567": <n> }. analyzeExport() then runs classifyFolder("1234567") via categories.ts, which checks case-insensitive membership in SUPPORTED (Activity_history, Player_statistics, User_Info, Payment_history) and KNOWN_DEFERRED (Chat_history, Clans) — "1234567" matches neither, so classifyFolder returns "unknown". hasRecognized stays false since it's the only category found → analyzeExport returns { ok: false, reason: 'no-recognized-category' }.
  implication: Confirms the exact error text reported ("unrecognized export: no-recognized-category"). The failure is NOT that the code can't find categories — it's that it looked for categories one level too shallow, so it found the real account-ID folder instead of the real category folders and correctly (by its own local logic) rejected it as unrecognized.

- timestamp: 2026-09-28T00:00:00Z
  checked: src/lib/worker/classify.ts detectRoot() traced against a rootless re-zip (category folders directly at top level, e.g. "Activity_history/...", "Payment_history/...", no accountId wrapper)
  found: With ≥2 real category folders at the top level, detectRoot() sees ≥2 distinct first segments → segmentCounts.size !== 1 → returns null. analyzeExport() then returns { ok: false, reason: 'no-single-root' } BEFORE categoryFoldersUnder ever runs. (Edge case: a rootless re-zip with only ONE category folder at the top level would instead pass detectRoot with that category name as "root", then hit categoryFoldersUnder finding 0 sub-segments for files directly under it → 'no-category-folders'. This sub-case is rare — a real export always has multiple category folders — but is a third distinct reason code the same root defect can produce.)
  implication: "Wrapper folder" and "rootless re-zip" are the SAME underlying defect (detectRoot's rigid "exactly one first path segment, exactly one level, no more no less" assumption) but manifest through two (or three) DIFFERENT named reasons — no-recognized-category vs no-single-root (vs no-category-folders in the one-category edge case) — because they hit different points in the same linear pipeline (detectRoot → categoryFoldersUnder → classifyFolder loop). A fix must handle both entry points, not just one.

- timestamp: 2026-09-28T00:00:00Z
  checked: src/lib/worker/ingest.worker.ts
  found: The worker throws `unrecognized export: ${outcome.reason} (${entryNames.length} entries)` and the catch block posts only `${e.name}: ${e.message}` back to main thread; nothing in the UI layer branches on `outcome.reason` — all failure reasons collapse to the same GENERIC_FAILURE_MESSAGE by design (D-05/D-07: never leak entry names/reasons to the UI banner). This generic-message behavior is confirmed correct/unrelated to the bug — the defect is entirely upstream, in classify.ts's structural detection, not in how the worker reports failure.
  implication: Fix belongs in src/lib/worker/classify.ts (detectRoot / categoryFoldersUnder / analyzeExport), not in ingest.worker.ts or the UI messaging layer.

- timestamp: 2026-09-28T00:00:00Z
  checked: tests/fixtures/export-fixtures.ts (all builders)
  found: buildRenamedRootExport() renames the account-ID folder itself but keeps it at depth 1 (single level) — it does not add a wrapper level. buildMultiRootZip() and buildNoRecognizedCategoryZip() exist and exercise no-single-root / no-recognized-category, but buildNoRecognizedCategoryZip()'s own fixture (`holiday-photos/2019/...`, `holiday-photos/2020/...`) is structurally IDENTICAL in shape to a wrapped export (wrapper/accountId/category/...) — both are "root/one-unrecognized-subfolder/...". No fixture exists for a genuine two-level nested export (wrapper/accountId/category/...) or a multi-category rootless re-zip.
  implication: The gap is untested by construction — the exact shape that would have caught this (two-level nesting with a real account-ID segment one level down) was never built as a fixture, so 01-03's otherwise-thorough edge-case suite could not have caught it before real-export UAT did.

- timestamp: 2026-09-28T00:00:00Z
  checked: .planning/phases/01-ingest-foundation-zero-network-guard/01-03-PLAN.md, Flagged Assumptions section
  found: FA-01-03-3 (line ~344, verbatim): "an export zipped one folder deeper (wrapper folder) and a rootless re-zip (category folders at the top level) are not auto-detected; both show the generic failure. Reversible." This is a pre-existing, planner-acknowledged and consciously deferred limitation, not a regression.
  implication: This UAT result is the project owner choosing to close a previously-accepted gap now (per G-01-20 in 01-UAT.md: "user chose to fix it now rather than accept it as-is"), not a surprise defect. Root-cause work is really just precisely characterizing FA-01-03-3's already-known mechanism for the planner.

## Resolution

root_cause: |
  detectRoot() in src/lib/worker/classify.ts (branch gsd/phase-01-ingest-foundation-zero-network-guard) hard-codes the assumption that the Wargaming account-ID folder is ALWAYS exactly the first path segment of every entry, with category folders always exactly one level below it. It has no mechanism to detect or skip an extra wrapping directory, and no mechanism to treat top-level segments as category folders directly (rootless case). Two related-but-distinct manifestations of the same rigid-depth assumption:
    1. Wrapper folder (extra level ABOVE the account-ID folder): detectRoot() returns the wrapper folder name as "root". categoryFoldersUnder() then finds the real account-ID folder name as the sole "category" one level down. classifyFolder() correctly reports it as "unknown" (it's not a real category name) and, being the only category found, analyzeExport() returns reason 'no-recognized-category'. Evidence: src/lib/worker/classify.ts detectRoot()/categoryFoldersUnder()/analyzeExport(); confirmed against the exact reported error text.
    2. Rootless re-zip (account-ID folder missing entirely, category folders at the top level): with ≥2 categories, detectRoot() sees ≥2 distinct first segments and returns null, so analyzeExport() returns reason 'no-single-root' before categoryFoldersUnder ever runs. (A degenerate single-category rootless re-zip instead reaches 'no-category-folders'.) Evidence: same functions, traced by hand against a synthetic rootless path set.
  Both are pre-existing, planner-flagged behavior — FA-01-03-3 in 01-03-PLAN.md — not a regression; ingest.worker.ts's generic-failure-message behavior (D-05/D-07, never leak reason/entry-names to the UI) is confirmed correct and unrelated to the defect.
fix: (not applied — goal: find_root_cause_only; plan-phase --gaps handles the fix)
verification: (not applicable — diagnose-only session)
files_changed: []
