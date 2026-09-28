# Phase 1: Ingest Foundation & Zero-Network Guard - Context

**Gathered:** 2026-09-27
**Status:** Ready for planning

<domain>
## Phase Boundary

A user can drop (or click-to-browse and pick) an export `.zip` onto the app and see it unzipped and its category folders classified — supported / known-deferred / unknown — entirely inside one long-lived Web Worker. Nothing is parsed or persisted yet (no CSV parsing, no IndexedDB — that's Phase 2); this phase only proves the file made it through the worker and its folder structure was read correctly. A standing CI check already proves the app makes no network requests after initial page load, including the worker script fetch, backed by a CSP meta tag as defense-in-depth.

The UI built in this phase is intentionally a diagnostic/proof surface, not the final product — Phase 3 replaces it with the real dashboard shell and the "detected but not yet supported" banner system for DATA-03/DATA-04.

</domain>

<decisions>
## Implementation Decisions

### Classification display
- **D-01:** Category folders render as a flat list of color-coded status badges — one pill per folder (green = supported, amber = known-deferred, grey = unknown) — not grouped into three separate sections.
- **D-02:** Each badge shows the folder name plus its file count (e.g. "Activity_history — 3 files"), proving the folder was actually opened and read, not just name-matched.
- **D-03:** A summary line appears above the badge list (e.g. "5 supported · 2 known-deferred · 1 unknown"), and badges are ordered grouped by status (all supported first, then known-deferred, then unknown) even though rendered as one flat list rather than sectioned.

### Failure state
- **D-04:** A single generic failure message per IMPORT-05, worded to explain what's expected without diagnosing the specific cause, e.g. "This doesn't look like a Wargaming data export. Drop the .zip file you received from Wargaming's GDPR export request."
- **D-05:** The underlying/specific error (not a zip, missing root folder, corrupt archive, exception, etc.) is logged to `console.error` for debugging while the on-screen message stays generic.
- **D-06:** The failure message renders as an inline banner above the dropzone. The dropzone itself stays visible and is immediately re-armed; the banner persists until the next drop attempt or success — no auto-dismiss timer.
- **D-07:** A worker error thrown mid-processing (not just a pre-check rejection) routes through the same single error path to the same generic failure banner — one error path, not two different messages for "rejected before" vs. "crashed during."

### Processing feedback
- **D-08:** While the worker runs, the dropzone area shows a spinner plus short status text (e.g. "Unzipping...", "Classifying folders...").
- **D-09:** The worker message contract reports distinct stage transitions (unzipping → classifying → done), not just a single busy/done flag, so status text can update per stage. — **Reversibility:** costly — **Reversibility rationale:** Phase 2's parsing-progress UI is expected to extend this same stage-message shape; redesigning the contract after Phase 2 builds on it means touching both the worker and every consumer of worker messages.
- **D-10:** A minimum ~300–500ms artificial floor keeps the spinner visible even when classification finishes near-instantly (the ~2.2MB reference sample will be very fast).

### Account root display
- **D-11:** The detected account root folder's raw ID is shown as-is (e.g. "Account: 123456789") — it's a numeric account/game ID, not the email/`LOGIN` field (which stays hidden per the project's existing privacy decision), and showing it proves auto-detection matched the real folder name rather than a hardcoded assumption.
- **D-12:** The account ID renders as a small heading directly above the summary line and badge list.
- **D-13:** After a successful classify, the dropzone is replaced by the results view. Dropping a different zip requires an explicit "start over" action to bring the dropzone back first — it does not stay live for an immediate re-drop.
- **D-14:** "Start over" is a single click with no confirmation dialog (nothing is persisted yet in Phase 1 — no IndexedDB caching until Phase 2, so there's nothing destructive to confirm) and clears the results view immediately, showing the empty dropzone.

### Dropzone interaction
- **D-15:** The dropzone supports click-to-open-native-file-picker (`accept=".zip"`) as a fallback to dragging, not drag-and-drop only.
- **D-16:** Dropping more than one file at once is rejected outright through the same generic failure banner (D-04/D-06) — the user must drop exactly one file.
- **D-17:** An obviously-wrong file (e.g. wrong extension) is rejected via a quick client-side check on the main thread before any worker message is sent, rather than always round-tripping through the worker to decide.

### Claude's Discretion
- Exact spinner/badge visual styling (colors beyond the semantic green/amber/grey mapping, spacing, typography) — no specific design system referenced yet.
- Precise wording variations beyond the D-04 example message, as long as it stays generic per IMPORT-05 and hints at what's expected.
- Worker message contract's exact field/type shapes for stage reporting (D-09) — the *behavior* (distinct stages) is locked, the schema is an implementation detail for planning/research.
- Where exactly the eager worker spawn happens (app init vs. first interaction) to keep the worker script fetch inside "initial page load" for the zero-network CI check (PLATFORM-02, Phase 1 success criterion 4) — a technical requirement already implied by the success criteria, not a fresh open question.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external specs, ADRs, or standalone docs were referenced during this discussion. The governing documents are the project's own planning files, already known to all downstream agents by convention:

### Project planning docs
- `.planning/PROJECT.md` — Core Value, constraints, and Key Decisions table (privacy, tech stack, worker lifecycle, dependency choices)
- `.planning/REQUIREMENTS.md` — IMPORT-02, IMPORT-05, PLATFORM-02 (this phase's mapped requirements)
- `.planning/ROADMAP.md` — Phase 1 goal and success criteria (the four numbered criteria this phase must satisfy)
- `AGENTS.md` (repo root) — locked tech-stack versions, Web Worker lifecycle rules (`Papa.parse({ worker: false })`, `fflate`'s `unzipSync`, no nested workers), CSP-via-meta-tag approach, scaffolding command (`sv create` minimal template)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
None — the repo is fully greenfield. Only `README.md`, `LICENSE`, `.gitignore`, and the `.planning/` docs exist; no `package.json`, `src/`, or scaffolded app yet.

### Established Patterns
None yet — this phase's toolchain setup (per AGENTS.md: `sv create` minimal template, Svelte 5 runes, Vite, pnpm, TypeScript ^6) establishes the first patterns for the project.

### Integration Points
- The badge/pill component built for classification display (D-01–D-03) is expected to be reused or evolved into Phase 3's "detected but not yet supported" banner system (DATA-03) — build it with that reuse in mind, but don't over-engineer for requirements not yet locked.
- The worker's stage-reporting message shape (D-09) is expected to be extended by Phase 2's per-category parsing progress — see reversibility rationale above.

</code_context>

<specifics>
## Specific Ideas

- Failure message example the user approved: "This doesn't look like a Wargaming data export. Drop the .zip file you received from Wargaming's GDPR export request."
- Account root display example: "Account: 123456789" as a small heading.
- Summary line example format: "5 supported · 2 known-deferred · 1 unknown".

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within Phase 1 scope. (Multi-file drop handling, click-to-browse, and pre-validation were raised and resolved as in-scope UX details, not deferred to a later phase.)

</deferred>

---

*Phase: 1-Ingest Foundation & Zero-Network Guard*
*Context gathered: 2026-09-27*
