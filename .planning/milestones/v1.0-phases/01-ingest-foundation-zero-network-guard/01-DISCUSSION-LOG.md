# Phase 1: Ingest Foundation & Zero-Network Guard - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-27
**Phase:** 1-Ingest Foundation & Zero-Network Guard
**Areas discussed:** Classification display, Failure state, Processing feedback, Account root display, Click-to-browse fallback, Multiple-file drop handling, Client-side pre-validation

---

## Classification display

| Option | Description | Selected |
|--------|-------------|----------|
| Color-coded badges | Flat list of folder names, each with a colored status pill (green=supported, amber=known-deferred, grey=unknown). Reusable for Phase 3's real banners. | ✓ |
| Three grouped sections | Folders grouped under three headings. Clearer separation but more layout work for UI that gets replaced. | |
| Plain bracketed text list | e.g. "[supported] Activity_history" — no styling, purely diagnostic. | |

**User's choice:** Color-coded badges.
**Notes:** Also decided: show file count per badge (proves the folder was actually read, not just name-matched); show a summary line above the list; order badges grouped by status even though the list itself is flat, not sectioned.

---

## Failure state

| Option | Description | Selected |
|--------|-------------|----------|
| Generic + retry hint | e.g. "This doesn't look like a Wargaming data export. Drop the .zip file you received from Wargaming's GDPR export request." | ✓ |
| Bare generic message | e.g. "Couldn't read that file." — minimal, no explanation. | |
| You decide | Claude picks reasonable copy. | |

**User's choice:** Generic + retry hint.
**Notes:** Underlying error logged to `console.error` only (not shown in UI). Message renders as an inline banner above the dropzone, persists until next drop attempt (no auto-dismiss). A mid-processing worker crash routes through the same generic banner as a pre-check rejection — one error path, not two.

---

## Processing feedback

| Option | Description | Selected |
|--------|-------------|----------|
| Spinner + status text | Spinner plus short status text (e.g. "Unzipping...", "Classifying folders..."). | ✓ |
| Spinner only, no text | Just a spinner, no status text. | |
| Disabled dropzone only, no spinner | Relies on disabled state alone. | |

**User's choice:** Spinner + status text.
**Notes:** Worker message contract reports distinct stage transitions (unzipping → classifying → done) rather than a single busy/done flag, so status text can update — flagged as `costly` reversibility since Phase 2's parsing progress is expected to extend this shape. Minimum ~300-500ms artificial floor added so the spinner registers even on near-instant small files.

---

## Account root display

| Option | Description | Selected |
|--------|-------------|----------|
| Show the raw ID | Display the detected root folder name/ID as-is, e.g. "Account root: 123456789". | ✓ |
| Generic confirmation only | Just "Account folder detected" without printing the raw ID. | |

**User's choice:** Show the raw ID.
**Notes:** Rendered as a small heading above the summary line and badges (e.g. "Account: 123456789"), not inline with the summary. Separately decided: after a successful classify, the dropzone is replaced by the results view — an explicit "start over" button (single click, no confirmation dialog, since nothing is persisted yet in Phase 1) is required to bring the dropzone back for a new drop.

---

## Click-to-browse fallback

| Option | Description | Selected |
|--------|-------------|----------|
| Click also opens file picker | Clicking the dropzone opens the native OS file picker (`accept=".zip"`) as a fallback to dragging. | ✓ |
| Drag-and-drop only | No click handler. | |

**User's choice:** Click also opens file picker.

---

## Multiple-file drop handling

| Option | Description | Selected |
|--------|-------------|----------|
| Only the first file is used | Silently ignore extra files, process the first. | |
| Reject with the generic failure state | Treat a multi-file drop as invalid, show the same generic failure banner. | ✓ |

**User's choice:** Reject with the generic failure state.

---

## Client-side pre-validation

| Option | Description | Selected |
|--------|-------------|----------|
| Quick client-side extension check first | Check file extension/MIME on the main thread before invoking the worker. | ✓ |
| Everything goes to the worker | No pre-check; worker alone decides valid vs. invalid. | |

**User's choice:** Quick client-side extension check first.

---

## Claude's Discretion

- Exact spinner/badge visual styling (colors beyond the semantic green/amber/grey mapping, spacing, typography).
- Precise wording variations beyond the approved failure-message example, as long as it stays generic per IMPORT-05.
- Worker message contract's exact field/type shapes for stage reporting — the behavior (distinct stages) is locked, the schema is an implementation detail.
- Where exactly the eager worker spawn happens (app init vs. first interaction) to keep the worker script fetch inside "initial page load" for the zero-network CI check — already implied by Phase 1 success criterion 4, not a fresh open question.

## Deferred Ideas

None — discussion stayed within Phase 1 scope.
