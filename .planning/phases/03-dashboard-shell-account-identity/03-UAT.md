---
status: complete
phase: 03-dashboard-shell-account-identity
source: 03-01-SUMMARY.md, 03-02-SUMMARY.md, 03-03-SUMMARY.md, 03-04-SUMMARY.md, 03-05-SUMMARY.md, 03-06-SUMMARY.md, 03-07-SUMMARY.md
started: 2026-09-29T17:50:00Z
updated: 2026-09-29T17:45:30Z
---

## Current Test

[testing complete]

## Tests

### 1. First visit
expected: With no cached data, the page shows a full-size dropzone and an identity card reading "No export loaded". The five nav links are visible but muted, each with its reason in text. No error banner.
result: pass

### 2. Identity header after importing an export
expected: Dropping a real export shows the nickname as the title, an "As of export" caption, the region, a date-only created value and the account ID as a secondary line. No email and no birth date anywhere on the page.
result: pass

### 3. Five section cards in fixed order
expected: Five cards appear in the same order as the nav. Each shows either its data counts ("N files, M rows") or a visible reason for being empty or not loaded, with a dashed border on greyed cards, never colour alone.
result: pass

### 4. Unsupported folders block
expected: The fifth card lists every folder the viewer does not support, one banner each, all with identical wording and styling regardless of folder.
result: pass

### 5. Sticky nav and scroll-spy
expected: The nav stays stuck to the top while scrolling. Clicking a link jumps to its section without hiding the heading under the nav. The link for the section in view is bold and underlined; at the bottom of the page the last link is current.
result: pass

### 6. Return visit
expected: Reloading the page brings the dataset back with no re-upload. The import area becomes a slim bar with the import timestamp and Start over, and the identity header is the same as before.
result: pass

### 7. Replacing or dropping a bad file over a loaded dataset
expected: Dropping a second valid export asks for confirmation first, and Cancel keeps the current data. Dropping a non-export file shows the error notice while the dashboard stays on screen.
result: pass

### 8. Start over and Clear cached data
expected: Each opens a confirm panel that takes focus. Cancel returns focus to the button that opened it. Confirming clears the dashboard and lands on the full-size dropzone.
result: pass

### 9. Privacy check of the cache
expected: In DevTools, Application > IndexedDB, the stored rows contain no email, LOGIN or BIRTH_DATE values. The Network tab shows no requests after the page loads.
result: pass

## Summary

total: 9
passed: 9
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none yet]
