---
status: complete
phase: 09-multi-account-import-account-identity
source: [09-05-SUMMARY.md, 09-06-SUMMARY.md, 09-08-SUMMARY.md, 09-10-SUMMARY.md, 09-11-SUMMARY.md]
started: 2026-10-21T00:00:00Z
updated: 2026-10-21T00:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Multi-account export imports without the failure banner
expected: Drop a zip with several account-ID folders. No failure banner. Header lists every account with ID, games and years; an account with no User_Info file appears, identified by ID only.
result: pass

### 2. Every pane says the data is combined
expected: With 2+ accounts loaded, the panes show an "{N} accounts combined" caption sitting about 4px below its block. The Account row and Overview card name the accounts. With a single account, no combined caption appears.
result: pass

### 3. Reload keeps the dataset; re-drop and replace behave
expected: Reload the page and the same accounts are still shown from cache. Dropping the same zip again is skipped as already loaded. Dropping a different zip replaces the old data entirely, with no old rows left. Clear returns to the empty dropzone.
result: pass

### 4. Phone width (375px) holds long account text
expected: At 375px width, an account with a 40-character nickname and a 20-digit ID shows its full text in the header with no horizontal page scroll and no clipped text.
result: pass

### 5. Archive with one data-less folder keeps the multi header
expected: An archive of two folders where one holds no data shows "1 account" in the header, the Account list row and the Overview card. It keeps the multi-account layout, with one row and no region or creation date. This is the same fresh and after reload.
result: pass

### 6. Bad archives still show the single failure banner
expected: A zip with a stray folder, photos only, or more than 32 account folders shows the one generic failure banner and imports nothing.
result: pass

## Summary

total: 6
passed: 6
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none yet]
