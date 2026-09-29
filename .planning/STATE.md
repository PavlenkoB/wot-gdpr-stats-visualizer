---
gsd_state_version: "1.0"
current_phase: 4
current_phase_name: Activity Time Dashboards
status: planning
stopped_at: Phase 03 complete, ready to plan Phase 4
last_updated: "2026-09-29T16:17:11.916Z"
last_activity: 2026-09-29
last_activity_desc: Phase 03 complete, transitioned to Phase 4
state_head: 8ce46b60e00c33aa8e7e62f6e3f5d260fd500808
progress:
  total_phases: 7
  completed_phases: 1
  total_plans: 17
  completed_plans: 17
  percent: 14
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-09-27)

**Core value:** Your data never leaves your machine. Zero network requests after page load, enforced by CI and a CSP.
**Current focus:** Phase 03 — Dashboard Shell & Account Identity

## Current Position

Phase: 4 — Activity Time Dashboards
Plan: Not started
Status: Ready to plan
Last activity: 2026-09-29 — Phase 03 complete, transitioned to Phase 4

Progress: [████░░░░░░] 43% (3 of 7 phases complete; Phase 3 verified, secured and reviewed)

## Performance Metrics

**Velocity:**

- Total plans completed: 17
- Average duration: -
- Total execution time: 0.0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 6 | - | - |
| 02 | 4 | - | - |
| 03 | 7 | - | - |

**Recent Trend:**

- Last 5 plans: -
- Trend: -

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 01 P06 | 17 min | 1 tasks | 4 files |
| Phase 03 P01 | 35min | - tasks | - files |
| Phase 03 P03 | 12min | 2 tasks | 2 files |

## Accumulated Context

### Decisions

Decisions are logged in the PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: Horizontal-layers structure (standard mode, not MVP). The shared ingest foundation (Phases 1-3) comes before the feature dashboards (4-6), followed by mobile and deploy (7).
- [Roadmap]: The zero-network Playwright check and CSP are introduced in Phase 1 as a standing check, not added in the final phase.
- [Roadmap]: A single long-lived Worker with a main-thread busy-guard. There is no CANCEL message in v1.
- [Phase 03]: D-18/D-19/D-20 (03-01): the account email and birth data never reach IndexedDB. Three rules make that hold, and all three are about trusting the shape of untrusted input rather than the names in it — a deny-list must normalise before it matches (trim + upper-case, plus Papa's `_N` duplicate rename) and must drop the `__parsed_extra` overflow bucket, which is an array no column list can see into; the Dexie `version(2)` upgrade discards the emailed Phase 2 caches (same database name, so the old store is actually reached, both `clear()` calls awaited) rather than migrating them; and the three-field identity is computed once in the worker from sanitised rows only, persisted on the meta record, and replayed by `done`/`duplicate`/`cache-status` through a single `resultFromMeta` helper. `identity: null` means no User_Info row was parsed (the D-16 fallback); an object with `null` fields means a row parsed but that column was missing.
- [Phase 03]: The long-unknown-folder fixture uses an unterminated `<b>bold_markup`, not the `<b>bold</b>` the plan specified: a zip entry name can never contain `/` (that is the path separator), so the classifier was truncating the name mid-tag. Later e2e specs must reference the `LONG_UNKNOWN_FOLDER` constant rather than a literal.
- [Phase 03]: D-02/D-03/D-05/D-08 (03-02): one pure, DOM-free module set now derives every section, block and nav state from a `ClassifyResult`, so the nav and the cards cannot disagree. `sectionCounts` answers `null` for a folder that is absent and zeroed counts for one that is present with nothing parsed — collapsing those two would let "Not in this export" stand in for "there, but empty", which is a statement about the user's own data (DATA-04). Case handling is deliberately asymmetric: supported folders MERGE across case and sum (`User_Info` + `user_info` is one section), while unsupported folders SPLIT (`Bans` and `bans` stay two items), because merging the latter would hide a folder that is genuinely in the archive. Section order is declared in `SECTIONS`, never derived from `categories.SUPPORTED` (a different order, and it exists for the worker). The scroll decision is a pure function outside the DOM, so the subtle part is testable under the repo's jsdom-free Vitest setup; its bottom-of-page override carries two guards, since a page too short to scroll already satisfies the arithmetic at `scrollY` 0 and would otherwise report the last link on load.
- [Phase 03]: The rootless-account copy that 03-01 left unassigned is settled in 03-02's `ui-copy.ts`: `IDENTITY_UNKNOWN_ACCOUNT_TITLE` / `formatIdentityFallbackTitle`. A re-zip with no single root folder gives `accountRoot === ''`, so the D-16 fallback title would be an empty `<h2>` — a blank card with no explanation; the empty root now shows "Unknown account".

- [Phase 03]: Waves 1-2 post-merge gate: `pnpm run build`, `pnpm run check` and `pnpm run test:unit` (325 tests) are all green after 03-04; `pnpm exec playwright test` is 31 passed / 20 failed. All 20 failures are in the three legacy specs (`import-flow`, `import-failure`, `persistent-dataset`) and all assert RETIRED markup — `results`, `account-heading`, `summary-line`, `category-badge`, or a level-2-heading count that resolved to one heading when the dashboard now renders six. That is the D-23 markup migration, which 03-07 owns; its success criteria are "every e2e spec passes against the dashboard" and "lint, type-check, unit and e2e suites are green", so the phase cannot close until it is. Two of the 20 (import-flow (e) and (h)) fail for a different, related reason: they drop a file on the file input right after clicking `start-over`, which is only correct under the retired Phase 2 flow where Start Over cleared directly; since Phase 2 D-15/D-16 it opens the shared confirm panel, and 03-03's drop-during-confirm rule then discards the drop. 03-07-PLAN.md:147 pre-declares exactly this and rewrites both to click `confirm-commit` and wait for `cleared-ack` before re-importing. Verified green at pre-wave-1 `b63f325`, so neither is a product regression. NOTED FOR FOLLOW-UP: `ConfirmPanel` declares `aria-modal="true"` but renders inline with no backdrop or z-index, so the dropzone stays reachable while the panel is open and a drop is discarded with only a `console.error` and no user feedback. No product change was made here, because 03-CONTEXT:93 says the confirm flow is driven "unchanged" in Phase 3 and 03-07 "adds no product behaviour" — flagged for an explicit decision rather than a silent fix. The three new specs (`dashboard`, `identity-privacy`, `zero-network`) are fully green.
- [Phase 03]: `--nav-offset` is 03-04's, not 03-05's. 03-04-PLAN.md:203 assigns it explicitly and 03-05-PLAN.md:108 lists it as a carry-forward *from* 03-04 while 03-05's own action block never adds it; without it `scroll-margin-top: var(--nav-offset)` is unresolved. The 03-04 executor added it and flagged the deviation, which was correct.
- [Phase 03]: D-13/D-26/D-27/D-28 (03-03): `IngestClient.result` now means "the last known cached dataset", not "the outcome of the job in flight". Three assignments that nulled it on replace-confirm, on submit and in `#fail` are gone, so the dashboard stays on screen through a replacement and after a failed one. No cache re-check is needed: the worker's `writeDataset` is a single atomic Dexie transaction (RESEARCH Q2 probed it), so the client was the only thing discarding a copy of data still in IndexedDB. The replace guard follows from that re-typing — keyed on `result !== null` ("a dataset is displayed") rather than `state === 'done'`, because a dataset is now visible in `duplicate` and `error` too, and a drop in either used to reach the worker with no confirmation, which is the one thing D-13 exists to prevent. Two rules fell out of the reordering: the pre-check runs BEFORE the guard (otherwise a `notes.txt` drop opens a confirm for a file that can never be ingested), and a drop during `confirm-pending` touches no state at all. A cache-check failure recovers to `idle` with a `console.error` cause and NO banner, because the generic copy claims the file is not a Wargaming export — D-19's v2 upgrade made that first read able to fail, and the old guard left the page spinning forever. Cancelling a confirm that began from `duplicate`/`error` returns to `done` with the notice cleared: those are notices drawn over a dataset, and restoring one would undo the dismissal the user just asked for (D-06).
- [Phase 03]: `--nav-offset` ownership (03-04): the token is declared in `src/app.css` by 03-04, not 03-05. The 03-04 plan's Task 1 action block assigns it here, and `03-05-PLAN.md:108` lists `:root { --nav-offset: 72px }` as a carry-forward FROM 03-04 while 03-05's own action block never adds it — so leaving it out would leave `DashboardSection`'s `scroll-margin-top: var(--nav-offset)` unresolved and 03-05's nav with nothing to read. The session brief for 03-04 said 03-05 owns it; the plan and the downstream dependency agreed, so the plan won. One line to revert if the parent decides otherwise.
- [Phase 03]: D-22/DATA-03 (03-04): the unsupported block renders every non-supported folder from ONE list with one template, one sentence and one style, and its stylesheet contains no `data-status` selector at all — the attribute is emitted for tests only, and the e2e spec proves it with a nine-property `getComputedStyle` comparison across banners that carry different `data-status` values. The block is also not a special case in the layout: it renders through the same D-07 shell as the four supported categories so it owns the fifth anchor id and the same status vocabulary, which is what lets the 03-05 nav treat it as a fifth link. Its greyed state overrides the shared default wording, which would otherwise have read "This export contains no rows for Not yet supported".
- [Phase 03]: Nav status suffixes are hidden in flow, not with the 1px clip pattern (03-05) — Chromium inserts a separator before an OUT-OF-FLOW descendant when it computes an accessible name from content, so the clip pattern Dropzone.svelte uses announced 'Payment_history , not in this export' while the Copywriting Contract fixes the comma against the folder name (D-03). Verified in one page against absolute, inline-block, in-flow inline and font-size:0 spans. The suffix is now display:inline with font-size:0 and line-height:0: still zero advance width, so the nav row's layout is unchanged at every viewport, and the name concatenates exactly. UI-SPEC and the plan both prescribe the clip pattern, so this is a flagged deviation, and the task's own remediation clause listed 'whitespace inside the accessible name' as a defect to fix in the component.
- [Phase 03]: The scroll-spy names the first section at scrollY 0 itself (03-05) — UI-SPEC's 'empty band keeps the previous pick' rule and pickActiveSection are both correct inside the page and wrong at the very top: the identity header plus the nav are taller than the observer band, so at scrollY 0 no section intersects it and the previous pick is kept, which left the LAST link marked while the reader was looking at the header after scrolling back up. 03-05-PLAN.md requires 'top gives the first link' in both the Task 1 behaviour block and the Task 2 band-mirror test, so recompute short-circuits at scrollY <= 0 before delegating. pickActiveSection itself is untouched, so 03-02's pure-function contract and its unit tests are unaffected.
- [Phase 03]: The nav's current-link styling is selected by the aria-current attribute, not a class (03-05) — A parallel 'current' class would be a second piece of state that the observer and the stylesheet could disagree about. The attribute IS the state the spy maintains, so selecting on it makes the highlight and the underline structurally inseparable. The muted class is kept because the plan prescribes it; Svelte does not prune the attribute selector (verified in the built CSS), which a future refactor moving aria-current behind a helper should re-check.
- [Phase 03]: D-24/D-25/D-26 (03-06): the import region is ONE `<section data-testid="import-bar">` in both modes. `data-variant` is `full` or `slim` and flips; the element and its dropzone are never re-created, so "how many dropzones are in the DOM" is now a one-line invariant (one, always). The notice slot inside it is the page's only `aria-live` element and is rendered unconditionally with only its child conditional — a region created together with its content is not announced (RESEARCH Pitfall 10). The processing spinner and its stage text moved OUT of the dropzone into that slot, which is the mechanical reason `aria-busy` had to change from a `showProcessing` flag to `disabled`: with the prompt no longer swapping, `showProcessing` is permanently false and the flag would have been permanently absent (RESEARCH Pitfall 9, confirmed). The section deliberately has no flex `gap`; children carry their own 12px bottom margin so an empty slot measures exactly zero and a notice is not spaced twice.
- [Phase 03]: The duplicate notice is reachable only AFTER the user confirms a replace with identical bytes (03-06) — the replace confirmation (Phase 2 D-13) precedes the worker's hash check, so a same-bytes drop opens the panel first. This is the planner's flagged assumption, now covered by an e2e test, and it is a fact 03-07's legacy specs need: a test that drops identical bytes and expects the notice without a confirm will hang. Note the fixture trap behind it: fflate stamps each archive with a second-resolution mtime, so two `buildSampleExport()` calls a second apart are different files with different hashes and the worker correctly treats the second as a replacement. That test now passes ONE byte array to both imports, and the reason is in the JSDoc on its helper so it is not tidied back into two calls.
- [Phase 03]: Confirm-panel focus is the trigger's, not the bar's (03-06) — the panel takes focus on its dismiss button in `onMount` (code, not the element's own mount-time focus attribute, which the svelte a11y lint flags), and dismissal returns it to the element that opened the panel. `App.svelte` records the click's `currentTarget`, drops that reference when the dataset is replaced by a file drop instead, and falls through to the dropzone when the recorded trigger is no longer connected. A confirmed clear is the case that forces the fall-through: the trigger disappears with the dataset, so an `$effect` on `justCleared` lands focus on the full-size dropzone. Without per-trigger recording, a keyboard user would be stranded on `<body>` every time they declined a destructive action.
- [Phase 03]: Every Phase 2 e2e hook has exactly one Phase 3 successor (03-07) — `results` is `import-bar[data-variant=slim|full]`, `account-heading` is `identity-account-id` with `formatAccountId(root)`, `summary-line` is the per-section `section-summary`, `category-badge` splits into the four `dashboard-section-*` cards (D-02 order) and the four `unsupported-banner` cards (`SAMPLE_BADGE_ORDER.slice(4)` order), and `badge-skipped-count` is `skip-tag`. A badge count of 8 therefore becomes 4 sections + 4 banners, and 5 banners once the renamed export's extra folder is included — that split, not a lost assertion, is why the badge assertions look halved. The retired formatters existed only to serve the old hooks, so `formatSummary` and `formatAccountHeading` were deleted in the same plan, gated by `pnpm run check` rather than a text search: once the specs stopped importing them, deleting the functions turns any leftover importer into a type error.
- [Phase 03]: "No identity was ever loaded" needs TWO assertions, not one (03-07) — the skeleton renders six `<h2>` (the header title plus one per section), so a level-2 heading count is no longer a signal that nothing loaded, and a heading TEXT assertion would be ambiguous across six matches. The live equivalent pairs `identity-nickname` count 0 with `import-bar[data-variant="full"]`: either alone is satisfiable by a regression in the other, and together they are the same guarantee the old count carried.
- [Phase 03]: The co-rendered dropzone changes what "no re-upload" can mean (03-07) — persistent-dataset (a) previously proved the return visit was not a re-upload by arguing the dropzone was ABSENT once results showed. That assertion is now the opposite of the D-13 contract: the co-render is what makes replace-on-drop reachable, and 03-07's import-flow (a) asserts `dropzone` count 1 in the loaded state on purpose. The return-visit proof is now the co-rendered input's empty `FileList` (`toHaveJSProperty('files.length', 0)` — `inputValue()` throws on a file input), which is what the old argument was reaching for. Worth remembering for any future "the app did not re-read the file" assertion.
- [Phase 03]: A stale TEST NAME is the same stale contract as a stale comment (03-07) — three import-failure titles still said "shows the heading" / "no Account heading appears" after their bodies were re-pointed. The plan only authorised updating comments; titles were treated the same way, because a name asserting a retired hook puts a false claim in the suite's readable output and in every report it appears in. Letters, order and counts are unchanged.
- [Phase 03]: The e2e suite's wall-clock is a function of how many tests are red (03-07) — 20 failing specs at 30 s each made the suite take ~4 minutes; with all 83 green it runs in ~38 s. A slow `pnpm run test:e2e` is a failure signal, not a flake.
- [Phase 03]: Post-phase review carry-overs W-02, S-1 and W-03 are closed; the phase stays complete. **W-02**: the dropzone's `aria-label` was applied in both variants, and since an `aria-label` REPLACES the element's content as its accessible name, the compact variant never announced D-25's replace-on-drop prompt — the one place the wording carries the whole affordance. The label now applies to the full variant only (the compact one falls back to its visible text), and the string is centralised as `DROPZONE_ARIA_LABEL` beside the other landmark labels. **S-1**: `valueOrUnknown()` had no DOM coverage at all — the header-only fixture takes the `fallback` variant and never renders the three-field card, so a regression rendering an empty `<dd>` passed the whole project; `buildPartialAccountInfoExport` plus two e2e cases close it, and the RED was demonstrated by injecting that exact regression. **W-03**: the nav hover's `#ffffff` on `#f7f7fa` measures 1.069:1 and the Phase 2 `#f1f3f4` it was justified against 1.041:1, so the rationale rejected a value and shipped an equivalent one; the hover is now `#dadce0` at 1.284:1. W-03 therefore **amended `03-UI-SPEC.md`** — both the Color table's "Nav hover surface" row and the nav link-state "Hover" row, which carried the same value, plus the factually wrong rationale. The colour table is the approved contract, so `tests/unit/contrast.test.ts` now reads the component and the spec off disk and pins both directions: the code must ship the value the spec declares, and the pair must clear 1.20:1, the floor the rationale itself is argued from. `ConfirmPanel`'s `aria-modal` without a backdrop (W-01) is deliberately untouched — it is an open product decision, not a carry-over fix.

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 03] The Wave-1 note about 20 legacy e2e failures (`import-failure` 6, `import-flow` 7, `persistent-dataset` 7) is RESOLVED by 03-07: all three specs were re-pointed at the dashboard, and the full suite is 83 passed / 0 failed. Every retired hook (`results`, `account-heading`, `summary-line`, `category-badge`, `badge-skipped-count`, the level-2 heading queries) now prints nothing under `grep -rn --exclude=dashboard.spec.ts` across `tests src .claude/skills`. `dashboard.spec.ts` is excluded because its retired-hooks test names those strings on purpose and asserts count 0.
- [Phase 1/6] PLATFORM-02 vs. lazy fetches: the worker script, the country geo table, and the city-level opt-in are all fetches. Phase 1 must decide exactly where the "after load" boundary sits, e.g. spawn the worker eagerly at init rather than on first drop. Phase 6 must reconcile the ACTIVITY-07 opt-in (user-triggered, same-origin) with the zero-network assertion and the CSP `connect-src`.
- [Phase 6/7] The ~60-70MB city dataset is close to GitHub Pages' 100MB per-file limit and would bloat the repo. Plan to generate it in CI at build time rather than commit it.
- [Phase 1/3] User_Info (identity header only) and Payment_history (spend summary only) are only partly consumed in v1. The classifier and banner design must decide how their remaining files are shown.
- [All] Only a 2021 sample (~4.2k rows) has been inspected. Scale and format drift are unverified, so synthetic large fixtures are required in Phases 2, 4, 5, and 6.

## Deferred Items

Items acknowledged and deferred at milestone close, most recent first:

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| *(none)* | | | | |

## Session Continuity

Last session: 2026-09-29T19:30:00.000Z
Stopped at: Phase 03 complete, ready to plan Phase 4
Resume file: .planning/phases/03-dashboard-shell-account-identity/03-UI-SPEC.md
