---
phase: 12-account-timeline-perks
reviewed: 2026-10-20T00:00:00Z
depth: standard
files_reviewed: 26
files_reviewed_list:
  - src/lib/core/types/worker-messages.ts
  - src/lib/features/account-timeline/AccountTimelinePane.svelte
  - src/lib/features/account-timeline/TimelineKindFilter.svelte
  - src/lib/features/account-timeline/TimelineTable.svelte
  - src/lib/features/account-timeline/timeline-aggregate.ts
  - src/lib/features/account-timeline/timeline-instant.ts
  - src/lib/features/account-timeline/timeline-shared.ts
  - src/lib/features/account-timeline/timeline-state.ts
  - src/lib/features/new-data/NewDataCard.svelte
  - src/lib/features/new-data/NewDataTable.svelte
  - src/lib/features/new-data/PerksPane.svelte
  - src/lib/features/new-data/account-merge.ts
  - src/lib/features/new-data/code-mask.ts
  - src/lib/features/new-data/new-data-aggregate.ts
  - src/lib/features/new-data/new-data-cell.ts
  - src/lib/features/new-data/new-data-shared.ts
  - src/lib/features/new-data/new-data-state.ts
  - src/lib/shell/Dashboard.svelte
  - src/lib/shell/selection-state.ts
  - src/lib/ui-copy.ts
  - src/lib/worker/categories.ts
  - src/lib/worker/data-queries.ts
  - src/lib/worker/db.ts
  - src/lib/worker/ingest.worker.ts
  - src/lib/worker/new-data-allowlist.ts
  - src/lib/worker/new-data-specs.ts
findings:
  critical: 0
  warning: 5
  info: 5
  total: 10
status: issues_found
---

# Phase 12: Code Review Report

**Reviewed:** 2026-10-20
**Depth:** standard
**Files Reviewed:** 26 source files (the `git diff main...HEAD -- src` set), plus a read of the CI budget, Playwright config and zero-network spec diffs, and a skim of the new e2e spec and fixtures for the privacy canaries.
**Status:** issues_found

## Summary

The privacy-critical core holds up. I traced every storage path in `ingest.worker.ts` (lines 1136-1299) and in `narrowStoredNewDataRows` (`db.ts` 1256-1418), and found no route by which an excluded column reaches Dexie, a posted view, or the DOM:

- Family files, by name or by category, are projected through `projectRow`. Output keys are spec constants and never copied from the file. A family file with no spec, or in the wrong category, stores nothing.
- The identity and Account-record pools skip family files (`ingest.worker.ts:1290`), and `readLoginRowData` applies the same exclusion (`db.ts:782`). Import and rebuild agree.
- The two-walk narrowing (by name, then by category) shares one `narrowGroup` function and uses the same `specFor` and `projectRow` as the import. It is idempotent: `sameRowData` guards the writes, and the `alreadyEmpty` exemption stops an all-email-dropped group from being deleted on the second run.
- `projectRow` with `emailGuard` is idempotent. A stored cell is at most 200 characters and non-email-shaped, so a second pass is a no-op. The over-long-cell case (an `@` anywhere in the first 2,000 characters drops the cell) closes the clamp-splits-the-address hole.
- `isDataQuery` now rejects any extra key on every field-less channel.
- No `fetch`, XHR, WebSocket, dynamic import or new dependency appears in the diff.
- No cell, address or code reaches an attribute. The only account-derived string is the visually hidden `AccountTag` phrase, which existed before this phase.
- Code and address cells cross the worker boundary in clear and are masked at render time by `formatNewDataCell`. This is the documented D-13 design, not a defect.

I found no BLOCKER-class defects. The findings below are correctness gaps in the timeline and cell handling, one under-validated allowlisted column, a privacy-copy overclaim, and dead code.

## Warnings

### WR-01: The `\N` null marker is handled for one column only; `Bans.EXPIRED_AT` is stored, never read, and `\N` leaks to the screen elsewhere

**File:** `src/lib/features/new-data/new-data-aggregate.ts:83-129` (also `src/lib/features/account-timeline/timeline-aggregate.ts:85-117`, `src/lib/worker/new-data-specs.ts:573-577`)
**Issue:** `12-HEADERS.md:343` flags that the export writes `\N` for an unset date (an open ban's end). It says this "must read as 'no end date, open', never as an invalid or undated row".

- `cellOf` only treats `N/A` and `N/D` as not-reported. The `\N` check lives in `timeline-aggregate.dateTextOf`, so it covers the entry's date column only.
- Every other `\N` is rendered as the literal two characters `\N`. This applies to:
  - Perks `personal_coupons.csv` `EXPIRED_AT` and `UPDATED_AT` (date columns, drawn by `NewDataTable`);
  - any timeline secondary part, such as `OLD_NAME` or `NEW_NAME` in name history, where a first-ever nickname change plausibly has an empty or `\N` old name.
- `bans.csv` `EXPIRED_AT` is allowlisted and written to IndexedDB, but no view reads it (`TIMELINE_ENTRY_MAP.bans.secondaryColumns` is `[]`). The user's data is therefore stored without being shown. The "open ban" semantics the capture asked for are not implemented. A ban entry shows only its `STATUS`.

**Fix:** Normalise the marker once, in `cellOf`, so every pane benefits:
```ts
const NOT_REPORTED_TOKENS = new Set(['N/A', 'N/D', '\\N']); // compare against trimmed.toUpperCase()
```
Then either surface the end of a ban (map `EXPIRED_AT` as a secondary part, or add a muted "Ongoing" word when the marker is seen), or drop `EXPIRED_AT` from the `bans.csv` spec so it is not stored unused.

### WR-02: Language/country rows the discriminator cannot place are silently dropped, yet still counted as stored rows

**File:** `src/lib/features/account-timeline/timeline-aggregate.ts:267-274` (and `AccountTimelinePane.svelte:154,165-170`)
**Issue:**
- `languageOrCountry` is deliberately tolerant (`lang` / `countr`). When `NAME` matches neither, or both, the row is skipped with `continue` and yields no entry.
- `storedRows` still counts the row, and the file state is `'ready'`. The list headline and provenance therefore claim N rows while the pane lists fewer, with no explanation.
- If the real `NAME` vocabulary is something like `locale` or `region`, all rows of the file vanish. `isWholePaneEmpty` looks only at file states, so the pane then renders "Showing all 0 entries" above an empty table instead of a skipped or header-only line.

**Fix:** Count unplaceable rows and surface them. For example, return `files.languageCountry = 'skipped'` when a ready file produced zero entries, or emit a generic fallback entry with the kind `language` and the raw `NAME` as a secondary part rather than discarding the row. At minimum, make `isWholePaneEmpty` also true when `entries.length === 0`.

### WR-03: Survey `PLAYER_ANSWER` is admitted on an assertion, with no value-shape validation

**File:** `src/lib/worker/new-data-specs.ts:527-532` (guard at `new-data-allowlist.ts:292-311`)
**Issue:** The column is allowlisted because the user stated it is "an enumerated rating, one numeric character". Nothing enforces this. The only protection is the email-shape guard. A future export revision, or a crafted archive, with a free-text answer is stored (up to 200 characters) in Dexie and shown in the Perks table. That contradicts the fail-closed posture the module otherwise holds ("narrowing is free, widening costs a rebuild"). The same applies, to a lesser degree, to other free-text-capable allowlisted columns (`STATUS`, `OPERATION`, `NAME`, `THIRD_PARTY_SITE`).

**Fix:** Add an optional per-column `pattern` (or `maxLength`) to `SpecColumn` and enforce it in `projectRow` before the clamp. A cell that does not fit is left absent, exactly like an email cell. For example, `PLAYER_ANSWER: /^\d{1,2}$/` and `QUESTION_ID: /^[\w.-]{1,64}$/`. Because absent is the safe direction and the narrowing already re-projects, this needs no migration.

### WR-04: The email guard is a heuristic, but the user-facing copy states an absolute

**File:** `src/lib/worker/new-data-allowlist.ts:255` and `src/lib/ui-copy.ts:4258` (`TIMELINE_ABOUT`)
**Issue:** `EMAIL_SHAPE = /[^\s@]+@[^\s@]+\.[^\s@]+/` requires a dot after the at-sign. These values are stored and shown:
- `user@localhost` and `user@intranet`;
- `user@example.` (trailing dot);
- full-width `user＠example.com` (U+FF20);
- `user at example dot com`.

`TIMELINE_ABOUT` says "Email addresses in these files are never read, stored or shown". They are parsed, so "read" is wrong, and the guard cannot guarantee "never stored". For a product whose entire value is a verifiable privacy claim, the copy overclaims relative to the mechanism.

**Fix:** Soften the copy to what is true, for example "Cells that look like email addresses are dropped before anything is stored". Optionally widen the shape: treat any `@` or U+FF20 in an allowlisted, non-`code` cell as disqualifying, since none of these columns legitimately contains one.

### WR-05: The timeline Entry column is a fixed 360px, nowrap, ellipsised cell with no way to read the clipped text

**File:** `src/lib/features/account-timeline/TimelineTable.svelte:314-328,391-393` (`ENTRY_PX = 360` at line 97)
**Issue:** A name-change entry renders as `OLD · NEW`. Two 24-character nicknames plus the separator exceed 360px at 14px. The table uses `table-layout: fixed` with `white-space: nowrap; overflow: hidden; text-overflow: ellipsis`, and no `title` or alternative exposes the clipped text. The most useful entry (the previous nickname) is therefore unreadable for long names. A fixed row height is required by `windowRange`, so wrapping is not an option.

**Fix:** Let the Entry column take the remaining width (`width: auto`, with the existing 360px as a floor) and keep the horizontal scroller. Alternatively, raise `ENTRY_PX` to roughly 480 and update `minWidthPx` and the `.w-entry` class together.

## Info

### IN-01: The timeline's address-masking UI and copy are unreachable

**File:** `src/lib/features/account-timeline/AccountTimelinePane.svelte:161-162,184-188,220-235`; `timeline-state.ts:138-142`; `src/lib/ui-copy.ts:4258`
**Issue:** None of the five timeline specs allowlists an address column. The comments in `new-data-specs.ts` say an address is admitted in Bans and Authorized_Third_Parties, but the specs carry no `IP`. `hasMaskableEntries` is therefore always false, `canReveal` never becomes true, and `onToggle`, the `MASK_*` imports and the `announcement` state are dead. The Dashboard still threads `revealed` and `onRevealChange` into the pane. `TIMELINE_ABOUT` also tells the reader "IP addresses stay masked until you choose to show them", which describes nothing the pane holds. The e2e spec asserts the toggle never appears, which confirms it is dead by design.
**Fix:** Remove the reveal wiring and the IP sentence, or keep it behind the commented plan to add an address column later. Do not keep a copy claim about data that is not held.

### IN-02: Merge-note and showing-line wording is inaccurate in edge cases

**File:** `src/lib/ui-copy.ts:4196-4214`; `src/lib/features/new-data/account-merge.ts:139`
**Issue:**
- `mergedAway` is the number of stored rows removed. With three accounts holding one identical row, `mergedAway` is 2, and the note says "2 entries are identical on more than one account". There is one such entry.
- `formatTimelineShowing(1, 1)` reads "Showing all 1 entries".

**Fix:** Count merged entries (`rows.filter(r => r.accounts.length > 1).length`) for the note, or reword it as "N duplicate rows were merged". Special-case the singular in `formatTimelineShowing`.

### IN-03: A row whose every allowlisted cell was email-dropped becomes a ghost row

**File:** `src/lib/features/new-data/new-data-aggregate.ts:175-209`
**Issue:** A stored `{}` row counts toward `rowCount`, the list headline and `storedRows`. If every row is empty, `listed` is `[]` and the card renders a ready table with no columns. In a merged file (Subscriptions, services, language/country), all such rows share one signature, so they collapse across accounts into a single empty row.
**Fix:** In `buildCard`, treat a ready card with `listed.length === 0` as `skipped`. Optionally exclude empty rows from the stored count.

### IN-04: Fractional seconds are discarded when ordering the timeline

**File:** `src/lib/features/account-timeline/timeline-instant.ts:71-87` (via `playtime-aggregate.ts:123`)
**Issue:** `ISO_TIMESTAMP_RE` accepts `(?:\.\d+)?` but ignores the fraction. Every capture date is `YYYY-MM-DD HH:MM:SS.mmm`. Two same-kind, same-file events within one second therefore fall back to input order rather than true order. The impact is small, but the comparator comment calls the order "newest first".
**Fix:** Either carry the milliseconds as a tie-break field in `TimelineSortKey`, or note the one-second granularity in the comparator doc.

### IN-05: Stale comments after the later plans landed

**File:** `src/lib/features/new-data/new-data-shared.ts:295-303`; `src/lib/worker/data-queries.ts:505-507`; `src/lib/features/new-data/new-data-aggregate.ts:28-35`
**Issue:**
- `PerksView.mergedAway` is documented as "zero until plan 12-10", but the merge exists.
- The memo bound comment says "four channels", but there are now nine, and `MAX_MEMO_ENTRIES = 16` is tight once the vehicle selections are counted.
- The aggregate header says "Only Subscriptions merges across accounts", but the timeline merges `service` and `languageCountry` through the same module.

**Fix:** Update the comments, and re-check that 16 memo entries still covers the working set.

---

_Reviewed: 2026-10-20_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
