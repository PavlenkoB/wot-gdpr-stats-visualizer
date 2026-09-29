# Phase 3: Dashboard Shell & Account Identity - Context

**Gathered:** 2026-09-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace Phase 1/2's diagnostic results view with the real single-page dashboard shell. After an import, or on a return visit with cached data, the user lands on a page that shows whose account it is (identity header) and one section per source category. Every detected category is represented honestly: supported categories with data show an import summary plus a "coming soon" note (the dashboards themselves arrive in Phases 4-6), supported categories absent from the export show a greyed "not in this export" section, and known-deferred or never-seen categories each get the same "detected but not yet supported" banner. The page reflects processing / ready / duplicate / error / cleared states driven by worker messages. The account email (`LOGIN`) appears nowhere in the rendered page, tooltips, or document title.

No new dashboards, charts, or per-title breakdowns are built here. Mobile/touch polish is Phase 7.

</domain>

<decisions>
## Implementation Decisions

### Page structure & navigation
- **D-01:** The dashboard is a single scrolling page with a sticky in-page anchor nav (no tabs, no router, no new dependency). Sticky at all widths; Phase 7 may adapt it at phone width. — **Reversibility:** costly — **Reversibility rationale:** Phases 4-6 each add content into these slots and Phase 7's responsive work builds on the nav; switching to tabs later means restructuring the page and adding bits-ui.
- **D-02:** One section per source category, in this fixed order: `Activity_history`, `Player_statistics`, `Payment_history`, `User_Info`, then the "Not yet supported" block. The Activity_history section holds both playtime charts (Phase 4) and login history (Phase 6) under sub-headings ("Playtime", "Login history") — one nav entry, not two. — **Reversibility:** costly — **Reversibility rationale:** section ids/order become anchors and layout slots that Phases 4-6 fill; regrouping later moves their content.
- **D-03:** The nav has five links: the four supported sections plus one link to the "Not yet supported" block. Links for sections with no data (missing, zero rows, or no export loaded) get a muted style. The status is also in the link's accessible name, not conveyed by colour alone.
- **D-04:** Nav links are native `#hash` anchors. Smooth scrolling applies only under `prefers-reduced-motion: no-preference`; headings use `scroll-margin-top` to clear the sticky nav. The URL hash may change but nothing is restored from it on load.
- **D-05:** The nav highlights the section currently in view (scroll-spy via `IntersectionObserver`, `aria-current` on the active link).
- **D-06:** Sections are always expanded — no collapsible sections in Phase 3.

### Section states & shared component
- **D-07:** A shared `DashboardSection` component takes `id`, `title`, a `status` and a content snippet, and renders heading, status text and greyed styling itself. Statuses cover: data present but dashboard not built (`pending`), supported category absent from the export (`no-export`), category present with zero parsed rows (`empty`), no export loaded (`not-loaded`), and `ready` (later phases supply the snippet). Phases 4-6 provide content for `ready`. — **Reversibility:** costly — **Reversibility rationale:** three later phases build on this component's props; changing the contract touches all of them.
- **D-08:** Section status is derived by one pure function from `ClassifyResult` (category present, row counts), unit-testable and used by both the nav and the sections so they cannot disagree. Later phases extend it as their dashboards land.
- **D-09:** `pending` shows an import summary (file count, row count, skipped rows, moved out of the retired badges) plus a short "dashboard coming in a later update" note. When a later phase ships its dashboard, the note is replaced by the real content and the counts remain as a small caption under the section so import diagnostics are never lost.
- **D-10:** A supported category absent from the export shows the section greyed with the text "not in this export". A category whose folder exists but parsed to zero rows is also greyed, with distinct wording: "this export contains no rows for X". Status is always visible text, never colour alone.
- **D-11:** Per-title absence inside Player_statistics (e.g. no Warplanes data) is NOT modelled in Phase 3 — Phase 5 owns the per-title breakdown and its empty states.

### Identity header
- **D-12:** The header shows the nickname (`NAME`) as the title with a caption marking values as "as of export". The nickname is mutable in-game (Wargaming charges 2,500 gold/doubloons, limited to once every 14 days), so it is labelled as a snapshot, not a permanent name. No export date is shown, because `importedAt` is the import time, not the export time.
- **D-13:** Region is shown as the raw `REGION` value labelled "Region (per export)", never mapped to friendly names. Wargaming does not transfer individual accounts between regions apart from occasional mass-transfer events, and has allowed cross-server account linking since Oct 2024, so the field may not match historical play, login IPs, or payment currency. Which values real exports contain is unverified.
- **D-14:** The numeric account ID (the account root folder name) stays visible as a small secondary line in the header.
- **D-15:** Account-created date (`CREATED_AT`) is shown date-only, as written in the export, with no time or timezone conversion (the field has no timezone).
- **D-16:** Missing fields show "Unknown". If `User_Info` is missing entirely, the header falls back to the account ID and the User_Info section shows its greyed no-export state.
- **D-17:** If `Account_Info.csv` has more than one row, use the row whose `ID` equals the detected account root, falling back to row 1.

### Privacy: LOGIN and sensitive fields
- **D-18:** `LOGIN`, `BIRTH_DATE` and `BIRTH_DATE_SRC` are dropped at write time in the worker, so they never enter IndexedDB (this narrows Phase 2 D-01/D-02 for User_Info only; IP, city and country columns are still stored). — **Reversibility:** one-way — **Reversibility rationale:** once stripped, the columns cannot be recovered without re-importing the zip, because raw zip bytes are not retained.
- **D-19:** The Dexie schema version is bumped so existing Phase 2 caches (which contain the email) are discarded. Returning users see the empty state and re-import once. No in-place migration.
- **D-20:** The worker computes a 3-field identity (nickname, region, created date) at import and stores it in the dataset meta record, so `cache-status` carries it directly on a return visit without row queries. The main thread never sees the email.
- **D-21:** `document.title` is a static "WG Data Export Viewer" in every state. The nickname appears in the identity header only (no tooltips, nav, other aria-labels, or logs). A Playwright test imports the synthetic fixture and asserts its example.invalid email and birth date appear nowhere in document text, title, attributes, or IndexedDB rows.

### Unsupported categories
- **D-22:** Each known-deferred (Chat_history, Clans) or unknown folder gets its own banner, identical in style and text ("detected but not yet supported"), showing folder name plus file and row counts and any skipped-row count. No visual difference between the three tiers (DATA-03). Banners live in the final "Not yet supported" block.
- **D-23:** Phase 1/2's colour-coded badge list and summary line ("5 supported · 2 known-deferred · 1 unknown") are retired. Counts live inside sections and banners, so nothing is shown twice. This supersedes Phase 1 D-01–D-03 and Phase 2 D-05's badge presentation (the count content itself is kept).

### Import chrome & app states
- **D-24:** On first visit (no cached data) the page shows the full dashboard skeleton: identity header prompt, nav, and every section greyed, with a full-size dropzone at the top. Skeleton copy is distinct from the after-import wording: "Drop an export to see this section", and the header shows a neutral prompt in place of a nickname.
- **D-25:** After an import the dropzone shrinks into a slim "Import" bar above the nav. The bar holds the "Imported on [date]" text (Phase 2 D-10), a replace-drop area, "Start over" and "Clear my cached data" — both buttons kept per Phase 2 D-17 and sharing the one confirm panel per D-22 of Phase 2.
- **D-26:** All transient notices (processing progress, error banner, "already loaded" duplicate notice, "Cached data cleared" acknowledgment) render in ONE live-region notice slot inside the Import bar, reusing FailureBanner and the existing copy.
- **D-27:** While a replacement import is processing, or a notice is shown, the current dashboard stays visible until a replace is confirmed and finished (Phase 2 "old data stays until confirm" behaviour).
- **D-28:** During the on-load cache check, only the Phase 2 spinner shows (no skeleton), avoiding a flash of the empty skeleton for returning users (Phase 2 D-08).
- **D-29:** Phase 3 adds no new animations. The existing spinner already respects `prefers-reduced-motion`, and smooth-scroll follows the same rule.

### Claude's Discretion
- Exact visual styling of the sticky nav, muted states, section captions, and the Import bar, within the existing palette, spacing scale and four typography roles from `02-UI-SPEC.md`.
- Exact wording of the "not in this export", "no rows for X", "coming in a later update" and skeleton prompts, so long as the distinctions in D-10 and D-24 are kept.
- Component and file naming (e.g. where the status function lives), and the worker-messages contract shape for carrying the identity object.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project planning docs
- `.planning/PROJECT.md` — Core Value, constraints, Key Decisions; notes the verified `User_Info/Account_Info.csv` column layout (`ID;NAME;CREATED_AT;ACTIVATED_AT;IP;COUNTRY_CODE;REGION;CITY;LOGIN;USER_LANGUAGE;USER_STATED_COUNTRY;BIRTH_DATE;BIRTH_DATE_SRC`)
- `.planning/REQUIREMENTS.md` — DATA-03, DATA-04, IDENTITY-01 (this phase's mapped requirements)
- `.planning/ROADMAP.md` §"Phase 3: Dashboard Shell & Account Identity" — goal and the four numbered success criteria
- `AGENTS.md` (repo root) — locked stack (Svelte 5 runes, no router, hand-rolled UI, bits-ui reserved but not installed), single long-lived worker rules

### Prior phase decisions
- `.planning/phases/02-defensive-parsing-persistent-dataset/02-CONTEXT.md` — D-07/D-08 (auto-load from cache, spinner), D-10 (imported-on date), D-13–D-22 (replace confirm, two destructive buttons, shared confirm panel and copy), D-01/D-02 (store-all-rows, narrowed for User_Info by D-18 above)
- `.planning/phases/02-defensive-parsing-persistent-dataset/02-UI-SPEC.md` — spacing scale, four typography roles, palette to reuse
- `.planning/phases/01-ingest-foundation-zero-network-guard/01-CONTEXT.md` — D-01–D-03 (badge presentation, retired here), D-04–D-07 (generic failure banner and single error path)

### External references (identity semantics)
- https://wargaming.net/support/en/products/wot/article/10193/ — Change Username: paid, once per 14 days, old name locked 30 days (basis for D-12)
- https://wargaming.net/support/en/products/wot/article/10198/ — Transfer Account to Another Region or Platform: no individual transfers (basis for D-13)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/App.svelte` — top-level state branching (`checking-cache` / `confirm-pending` / `done` / `duplicate` / `error` / `idle`), the persistent clear-data bar, window drag/drop guard, and `statusTextFor`; to be restructured around the new shell, keeping the guard and status logic.
- `src/lib/worker-client.svelte.ts` (`IngestClient`) — state machine with `pendingAction`, `justCleared`, `#fail` single error path; drives the notice slot and confirm flow unchanged.
- `src/lib/components/ConfirmPanel.svelte`, `FailureBanner.svelte`, `Dropzone.svelte` — reused in the Import bar; `ResultsView.svelte` and `CategoryBadge.svelte` are retired.
- `src/lib/worker/db.ts` — Dexie schema `version(1)` (`rows`, `meta`) with `writeDataset`/`checkCache`/`clearData`; needs a version bump (D-19) and an identity field on `DatasetMeta` (D-20).
- `src/lib/worker/categories.ts` — `SUPPORTED` / `KNOWN_DEFERRED` / `classifyFolder`, the source for section ids and the unsupported block.
- `src/lib/types/worker-messages.ts` — `ClassifyResult` / `CategoryEntry` (`rowCount`, `skippedRowCount`); extend with the identity object.
- `src/lib/ui-copy.ts` — central copy module; new section, banner and skeleton copy belongs here with unit tests (`tests/unit/ui-copy.test.ts`).
- `tests/fixtures/export-fixtures.ts` — synthetic export builders including `User_Info/Account_Info.csv` (fake `LOGIN` on example.invalid); reuse for the leak test and add fixtures for missing User_Info and multi-row Account_Info.

### Established Patterns
- Hand-rolled Svelte 5 components, no component library; text-only UI; palette, spacing and typography from `02-UI-SPEC.md`.
- Worker is sole owner of Dexie; the main thread talks to it only via typed messages.
- Copy strings live in `ui-copy.ts`; e2e tests use `data-testid`.
- Standing zero-network Playwright guard and CSP must stay green.

### Integration Points
- The worker's parse loop is where User_Info columns are stripped (D-18) and the identity extracted (D-20).
- Existing e2e/unit tests that assert badges, summary line, `account-heading`, or `start-over` placement will need updating for the new shell.

</code_context>

<specifics>
## Specific Ideas

- Nav entries: Activity_history, Player_statistics, Payment_history, User_Info, Not yet supported.
- Header caption idea: "as of export"; region label "Region (per export)"; missing values "Unknown".
- Banner text: "detected but not yet supported"; missing section: "not in this export"; zero rows: "this export contains no rows for X"; skeleton: "Drop an export to see this section".

</specifics>

<deferred>
## Deferred Ideas

- A hide-nickname / screenshot-sharing mask toggle — new capability; possible later phase or backlog.
- Per-title (WoT / Blitz / WoWS / WoWP) presence and empty states within Player_statistics — Phase 5.
- Collapsible sections and a phone-width nav treatment — Phase 7 if needed.

</deferred>

---

*Phase: 3-Dashboard Shell & Account Identity*
*Context gathered: 2026-09-29*
