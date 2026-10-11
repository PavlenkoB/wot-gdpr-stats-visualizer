---
phase: 02-defensive-parsing-persistent-dataset
reviewed: 2026-10-10T00:00:00Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - src/lib/worker/hash.ts
  - src/lib/worker/mojibake.ts
  - src/lib/worker/csv-parse.ts
  - src/lib/worker/db.ts
  - src/lib/worker/ingest.worker.ts
  - src/lib/worker/identity.ts
  - src/lib/core/types/worker-messages.ts
  - src/lib/import/worker-client.svelte.ts
  - src/lib/import/ingest-client.ts
  - src/lib/ui-copy.ts
  - src/App.svelte
  - src/lib/shell/ConfirmPanel.svelte
findings:
  critical: 3
  warning: 4
  info: 6
  total: 13
status: issues_found
---

# Phase 2: Code Review Report

**Reviewed:** 2026-10-10
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Summary

Scope note: the repo HEAD (88bb9e3) already contains phases 3-8, so the Phase 2 key-files have moved
and grown. `src/lib/types/worker-messages.ts` is now `src/lib/core/types/worker-messages.ts`;
`worker-client.svelte.ts` and `ingest-client.ts` moved under `src/lib/import/`; `ConfirmPanel.svelte`
moved to `src/lib/shell/`; `CategoryBadge.svelte` and `ResultsView.svelte` no longer exist (replaced by
`ImportSummary.svelte` / `Dashboard.svelte`). The review is of the current files and concentrates on
the Phase 2 surface: CSV parsing, mojibake repair, hash dedup, the Dexie write/clear path, and the
confirm/replace/clear state machine. Later-phase code (aggregates, geo, city load) was read only where it
shares a handler with Phase 2 code. `classify.ts` was not reviewed in depth.

The persistence layer itself (`db.ts` transactional `writeDataset`/`clearData`, sole-owner worker
pattern, hash-before-unzip gate) is sound. The defects are concentrated in `csv-parse.ts`, whose
"skip a single malformed row" contract does not hold against actual PapaParse 5 behaviour. All three
critical findings below were reproduced by running the installed `papaparse` directly against small
inputs (scratchpad scripts, not committed). They silently lose or corrupt data while the UI reports a
small or zero skip count, which defeats the point of the defensive-parsing phase. The state machine has
one real desync (cancel after confirm) and several swallowed-failure paths.

## Critical Issues

### CR-01: A single unbalanced quote silently drops the remainder of the file but is reported as "1 row skipped"

**File:** `src/lib/worker/csv-parse.ts:52-72` (count at `:84`)
**Issue:** The wrapper assumes a `Quotes` error means "one row is bad". PapaParse does not isolate the
bad row: on `MissingQuotes` it treats everything from the opening quote to EOF as one quoted field of
that row. Verified:

```
parse('A;B\r\n1;2\r\n3;"abc\r\n4;5\r\n6;7\r\n')
data   -> [{A:1,B:2}, {A:3, B:"abc\r\n4;5\r\n6;7\r\n"}]
errors -> [{type:"Quotes", code:"MissingQuotes", row:2}]
```

`skipIndices` receives one index, so `skippedCount === 1`, yet every row after the quote (potentially
tens of thousands in a session or vehicle file) is gone. The UI then shows "1 row skipped" next to a
category that has lost most of its data. The same happens for `InvalidQuotes`, which in practice is
always followed by a `MissingQuotes` at the same row (both land in the `Set` and count once). A stray
`"` in a free-text column (clan tag, nickname, vehicle note) is enough to trigger this. D-03/D-04's
promise of an honest skip count is false for this class of input.
**Fix:** Count what was actually lost. The swallowed field contains the remaining source lines, so for a
`Quotes` error on row `k`, treat the number of line breaks inside the offending cell as additional
skipped rows, or fail the file loudly rather than reporting 1. Minimal version:

```ts
const lost = (cell: string) => (cell.match(/\r\n|\r|\n/g)?.length ?? 0);
// for each dropped row, skippedCount += 1 + max over its cells of lost(cell)
```

Better: parse with `header: false`, detect any cell containing a line break after a `Quotes` error,
and surface the whole file as "parse truncated at row N" through the existing skip tag rather than as 1
row.

### CR-02: `error.row` is mapped to a `data` index without accounting for blank lines, so a valid row is dropped and the malformed one is kept

**File:** `src/lib/worker/csv-parse.ts:43-47, 63-65`
**Issue:** The parse uses `skipEmptyLines: true`, but PapaParse's `error.row` for `Quotes` errors counts
physical rows including the skipped blank ones, while `result.data` does not contain them. `dataIndex =
error.row - 1` is therefore wrong by the number of preceding blank lines. Verified:

```
'A;B;C\r\nr0;a;b\r\n\r\n\r\nr2;"a"x";c\r\nr3;d;e\r\nr4;f;g\r\n'
data   -> r0, r2 (malformed cell kept), r3, r4
errors -> [{InvalidQuotes, row:4}]    // dataIndex 3 -> r4, a VALID row, is dropped
```

and for a trailing malformed row with blank lines before it, `dataIndex >= data.length` hits the
silent `continue` at `:64`, so the malformed row (carrying the swallowed tail of the file) is stored
as-is with `skippedCount === 0`. The summary for plan 02-02 records that the test fixture "must NOT have
a leading CRLF" because of exactly this mismatch: the fixture was adjusted to avoid the bug instead of
the mapping being fixed.
**Fix:** Do not rely on `error.row`. Keep blank lines in the parse and filter them yourself so indices
line up, or locate the bad row by content:

```ts
const result = Papa.parse<Record<string, string | undefined>>(text, {
  header: true,
  skipEmptyLines: false,          // keep row numbering aligned with error.row
  worker: false,
});
// then drop rows where every value is '' / undefined while iterating,
// and keep `error.row - 1` as the data index
```

Add a unit test with a blank line before the malformed row.

### CR-03: Delimiter is auto-detected, and a ragged row in the first preview rows makes a 2-column file parse as one giant column with no error surfaced

**File:** `src/lib/worker/csv-parse.ts:43-47` (error filter at `:53`)
**Issue:** `Papa.parse` is called without `delimiter`. Auto-detection requires an average field count
above 1.99 over the preview rows. For a two-column semicolon file with one short row, the average falls
below that and PapaParse silently falls back to `,`. Verified:

```
header 'ID;NAME', 8 valid rows plus one row '99'
meta.delimiter -> ","
data[0]        -> {"ID;NAME": "0;n0"}
errors         -> [{type:"Delimiter", code:"UndetectableDelimiter"}]   // ignored at :53
```

Every row of the file is stored under a single key `"ID;NAME"`, nothing is counted as skipped, and the
`Delimiter` error is thrown away because only `Quotes` errors are inspected. Besides corrupting that
file's data, this weakens the header-keyed PII strip in `ingest.worker.ts:883`: `hasSensitiveColumn`
tests individual header keys, so a two-column file whose header is `LOGIN;BIRTH_DATE` and which has one
ragged row would be stored with the whole line, email included, under a key that no longer matches
`DROPPED_COLUMN`. Likelihood is low, but the failure is silent and the file is stored unredacted.
**Fix:** Pin the delimiter (AGENTS.md describes the exports as semicolon-delimited) or detect once from
the header line only, and treat a `Delimiter` error as a file-level failure:

```ts
const eol = text.search(/\r\n|\r|\n/);
const headerLine = eol === -1 ? text : text.slice(0, eol);
const delimiter = headerLine.includes(';') ? ';' : ',';
Papa.parse(text, { header: true, skipEmptyLines: true, worker: false, delimiter });
```

## Warnings

### WR-01: Cancel (or Escape) after "Delete cached data" is confirmed leaves the UI showing a dataset that is already wiped

**File:** `src/lib/import/worker-client.svelte.ts:406-417, 434-451, 741-742`; `src/lib/shell/ConfirmPanel.svelte:87-100`
**Issue:** For `start-over` / `clear-data`, `confirmPending()` posts `clear-data` and deliberately keeps
`state === 'confirm-pending'` with the panel still mounted and both buttons live. If the user presses
Cancel or Escape in that window, `cancelPending()` restores `'done'` and clears `pendingAction`. The
worker then finishes the wipe and posts `cleared`; `#handle` ignores it because
`state !== 'confirm-pending'`. Result: the app shows the dataset and "Imported on" as if it were kept,
while IndexedDB is empty, `result` is stale, and every data query returns `importedAt: null`. The window
is proportional to dataset size (single transaction over all rows). A second click on the commit button
also posts a second `clear-data` with a new jobId.
**Fix:** Track that the clear has been posted and make confirm idempotent and cancel inert after that
point:

```ts
#clearInFlight = false;
confirmPending() { ... if (this.#clearInFlight) return false; this.#clearInFlight = true; ... }
cancelPending()  { if (this.#clearInFlight) return; ... }
// reset #clearInFlight in the 'cleared' and clear-failure branches
```

and pass a `busy`/`disabled` prop to `ConfirmPanel` so both buttons are disabled while it is set.

### WR-02: Hash-only dedup means a re-drop can never refresh data written by an older parser, so fixes to parsing do not reach cached datasets

**File:** `src/lib/worker/ingest.worker.ts:709-718`; `src/lib/worker/db.ts:68-150` (`DatasetMeta`)
**Issue:** `existing.hash === hash` short-circuits to `duplicate` before any parse. The meta record
stores no parser/pipeline version. Any dataset imported by a build with the CR-01..CR-03 behaviour, the
earlier folder-keyed PII strip, or a different mojibake rule is replayed forever as "already loaded". The
only remedy is for the user to find and use "Clear my cached data" first, which nothing tells them to
do. `resultFromMeta` re-derives statuses at read time (05-03) but that does not cover row-level
parsing.
**Fix:** Add `parserVersion: number` to `DatasetMeta` (non-indexed, no Dexie bump needed) and compare it
in the gate: `if (existing && existing.hash === hash && existing.parserVersion === PARSER_VERSION)`.
Bump the constant whenever parse/strip rules change.

### WR-03: Storage failures (quota, blocked IndexedDB) are reported with the "This doesn't look like a Wargaming data export" banner

**File:** `src/lib/worker/ingest.worker.ts:985-993`; `src/lib/import/worker-client.svelte.ts:768-773`; `src/lib/ui-copy.ts:21-22`
**Issue:** D-06 routes `QuotaExceededError` and other Dexie write errors through the single failure
path, whose only on-screen copy is `GENERIC_FAILURE_MESSAGE`. The cache-check branch in the same file
already acknowledges that this sentence "is simply false" for storage problems and special-cases it; the
write path was left with the false message. A user with a valid but large export and a full disk is told
their file is not a Wargaming export, and they have no hint to free space or use another browser. The
`error` message also carries only `name: message`, so the main thread cannot distinguish the cases.
**Fix:** Have the worker send a `kind: 'storage' | 'format'` (derive from `err.name`:
`QuotaExceededError`, `DatabaseClosedError`, `AbortError`, Dexie `*Error` from the write stage) and add
a second copy constant such as `STORAGE_FAILURE_MESSAGE` shown through the same banner.

### WR-04: Worker `error` events outside `processing` are swallowed, which can strand the UI in `checking-cache` or a replace confirm

**File:** `src/lib/import/worker-client.svelte.ts:225-269, 375-404`
**Issue:** The `onerror` handler acts only for `state === 'processing'` or `!workerReady`. If the worker
errors after `ready` while `state === 'checking-cache'` (the `check-cache` reply never arrives) the page
shows the spinner paragraph forever, and `App.svelte` renders nothing else in that state. If it errors
while `confirm-pending` with a `replace` action, `confirmPending()` bypasses the guards in
`submitFiles` (no `#workerBroken`/`workerReady` check) and moves to `processing` with a message to a
worker that may not answer, which strands the busy floor until reload. The comment block at `:230-251`
documents this as an accepted tradeoff, but the `checking-cache` case has no recovery at all.
**Fix:** In `onerror`/`onmessageerror`, add `else if (this.state === 'checking-cache') { this.state = 'idle'; ... }`
(same recovery the `error` message branch already uses at `:695-704`), and re-check `#workerBroken` at
the top of `confirmPending()` for the `replace` branch.

## Info

### IN-01: `fixMojibake` cannot repair mojibake that came through Windows-1252

**File:** `src/lib/worker/mojibake.ts:33`
**Issue:** The `code > 0xff` guard returns the input untouched, so text double-encoded via cp1252
(`â€™`, `Ð\u0090` rendered as `Ð` plus `‚`-range characters) is never repaired, even though it is
the common real-world form. Only pure Latin-1 round trips work. Whether Wargaming exports contain this
form is not established by the repo; the guard simply encodes an assumption that the tool used ISO-8859-1.
**Fix:** If real samples show it, map the 27 cp1252 code points above 0x7f back to bytes before the
strict decode, keeping the round-trip-or-reject safety.

### IN-02: `__parsed_extra` cells skip mojibake repair, and the row type misdescribes them

**File:** `src/lib/worker/csv-parse.ts:33-35, 77-80`
**Issue:** For a row with extra cells PapaParse stores `__parsed_extra` as `string[]`. The loop
guards on `typeof v === 'string'`, so the array is stored unrepaired, and the declared type
`Record<string, string | undefined>` is wrong for that key. Header keys are also never repaired. The
`ParsedRow { data }` wrapper adds a level with no second field.
**Fix:** Either drop the key explicitly or map `Array.isArray(v) ? v.map(fixMojibake) : ...`, and widen
the type to `string | string[] | undefined`.

### IN-03: `rowIndex` is not a source row number

**File:** `src/lib/worker/ingest.worker.ts:884-889`
**Issue:** `rowIndex: rowCount + r` is cumulative across all files of a category and does not count
skipped rows, so it matches neither the row's position in its file nor its line in the source. Nothing
in the reviewed code reads it, but the name suggests a file-relative index to later consumers.
**Fix:** Either document it as "ordinal within category among kept rows" on `DatasetRow`, or make it
file-relative (`r`) since `sourceFile` is stored alongside.

### IN-04: `navigator.storage.persist()` is fired unconditionally at module load with an unhandled promise

**File:** `src/lib/import/ingest-client.ts:41`
**Issue:** `void navigator.storage?.persist?.()` discards a promise that can reject, producing an
unhandled rejection. It also runs at page load before any data exists, which on Firefox raises a
permission prompt with no context for the user.
**Fix:** Call it after the first successful import (on `done`), and add `.catch(() => {})`.

### IN-05: `formatImportedOn` can render "Imported on Invalid Date"

**File:** `src/lib/ui-copy.ts:123-129`; `src/App.svelte:204`
**Issue:** `App.svelte` passes `result.importedAt ?? ''`, and `formatImportedOn` feeds the string to
`new Date()` with no validity check. A missing or malformed `importedAt` (typed optional on
`ClassifyResult`) yields the literal "Imported on Invalid Date".
**Fix:** Return `''` (or hide the line) when `Number.isNaN(date.getTime())`, and drop the `?? ''` in
favour of `result.importedAt ? formatImportedOn(result.importedAt) : null`.

### IN-06: Dead guard and stale comment in `submitFiles`; long positional parameter list on `writeDataset`

**File:** `src/lib/import/worker-client.svelte.ts:474-496, 556`; `src/lib/worker/db.ts:245-254`
**Issue:** Guard 2b says `#workerBroken` is set by "EVERY worker error event", but the `onerror`
handler only sets it in the pre-ready case (`:261-267`), so the comment misstates behaviour. Guard 5's
`#workerBroken ||` half is unreachable because 2b already returned. Separately, `writeDataset` now takes
eight positional parameters, several of them nullable aggregates of different shapes; a swapped
`playtime`/`logins` argument of `null` compiles.
**Fix:** Correct the comment, reduce guard 5 to `!this.workerReady`, and change `writeDataset` to take
one options object (`{ hash, accountRoot, categories, rows, identity, playtime, files, logins }`).

---

_Reviewed: 2026-10-10_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
