# Phase 3: Dashboard Shell & Account Identity - Research

**Researched:** 2026-09-29
**Domain:** Svelte 5 (runes) single-page dashboard shell over a Dexie/IndexedDB dataset owned by a Web Worker; privacy-preserving identity extraction; sticky anchor nav with IntersectionObserver scroll-spy
**Confidence:** HIGH (every open question was answered by reading the code and by running a probe against the repo's own dependency versions; residual LOW items are listed in the Assumptions Log)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Page structure & navigation**
- **D-01:** The dashboard is a single scrolling page with a sticky in-page anchor nav (no tabs, no router, no new dependency). Sticky at all widths; Phase 7 may adapt it at phone width. — **Reversibility:** costly — **Reversibility rationale:** Phases 4-6 each add content into these slots and Phase 7's responsive work builds on the nav; switching to tabs later means restructuring the page and adding bits-ui.
- **D-02:** One section per source category, in this fixed order: `Activity_history`, `Player_statistics`, `Payment_history`, `User_Info`, then the "Not yet supported" block. The Activity_history section holds both playtime charts (Phase 4) and login history (Phase 6) under sub-headings ("Playtime", "Login history") — one nav entry, not two. — **Reversibility:** costly — **Reversibility rationale:** section ids/order become anchors and layout slots that Phases 4-6 fill; regrouping later moves their content.
- **D-03:** The nav has five links: the four supported sections plus one link to the "Not yet supported" block. Links for sections with no data (missing, zero rows, or no export loaded) get a muted style. The status is also in the link's accessible name, not conveyed by colour alone.
- **D-04:** Nav links are native `#hash` anchors. Smooth scrolling applies only under `prefers-reduced-motion: no-preference`; headings use `scroll-margin-top` to clear the sticky nav. The URL hash may change but nothing is restored from it on load.
- **D-05:** The nav highlights the section currently in view (scroll-spy via `IntersectionObserver`, `aria-current` on the active link).
- **D-06:** Sections are always expanded — no collapsible sections in Phase 3.

**Section states & shared component**
- **D-07:** A shared `DashboardSection` component takes `id`, `title`, a `status` and a content snippet, and renders heading, status text and greyed styling itself. Statuses cover: data present but dashboard not built (`pending`), supported category absent from the export (`no-export`), category present with zero parsed rows (`empty`), no export loaded (`not-loaded`), and `ready` (later phases supply the snippet). Phases 4-6 provide content for `ready`. — **Reversibility:** costly — **Reversibility rationale:** three later phases build on this component's props; changing the contract touches all of them.
- **D-08:** Section status is derived by one pure function from `ClassifyResult` (category present, row counts), unit-testable and used by both the nav and the sections so they cannot disagree. Later phases extend it as their dashboards land.
- **D-09:** `pending` shows an import summary (file count, row count, skipped rows, moved out of the retired badges) plus a short "dashboard coming in a later update" note. When a later phase ships its dashboard, the note is replaced by the real content and the counts remain as a small caption under the section so import diagnostics are never lost.
- **D-10:** A supported category absent from the export shows the section greyed with the text "not in this export". A category whose folder exists but parsed to zero rows is also greyed, with distinct wording: "this export contains no rows for X". Status is always visible text, never colour alone.
- **D-11:** Per-title absence inside Player_statistics (e.g. no Warplanes data) is NOT modelled in Phase 3 — Phase 5 owns the per-title breakdown and its empty states.

**Identity header**
- **D-12:** The header shows the nickname (`NAME`) as the title with a caption marking values as "as of export". The nickname is mutable in-game (Wargaming charges 2,500 gold/doubloons, limited to once every 14 days), so it is labelled as a snapshot, not a permanent name. No export date is shown, because `importedAt` is the import time, not the export time.
- **D-13:** Region is shown as the raw `REGION` value labelled "Region (per export)", never mapped to friendly names. Wargaming does not transfer individual accounts between regions apart from occasional mass-transfer events, and has allowed cross-server account linking since Oct 2024, so the field may not match historical play, login IPs, or payment currency. Which values real exports contain is unverified.
- **D-14:** The numeric account ID (the account root folder name) stays visible as a small secondary line in the header.
- **D-15:** Account-created date (`CREATED_AT`) is shown date-only, as written in the export, with no time or timezone conversion (the field has no timezone).
- **D-16:** Missing fields show "Unknown". If `User_Info` is missing entirely, the header falls back to the account ID and the User_Info section shows its greyed no-export state.
- **D-17:** If `Account_Info.csv` has more than one row, use the row whose `ID` equals the detected account root, falling back to row 1.

**Privacy: LOGIN and sensitive fields**
- **D-18:** `LOGIN`, `BIRTH_DATE` and `BIRTH_DATE_SRC` are dropped at write time in the worker, so they never enter IndexedDB (this narrows Phase 2 D-01/D-02 for User_Info only; IP, city and country columns are still stored). — **Reversibility:** one-way — **Reversibility rationale:** once stripped, the columns cannot be recovered without re-importing the zip, because raw zip bytes are not retained.
- **D-19:** The Dexie schema version is bumped so existing Phase 2 caches (which contain the email) are discarded. Returning users see the empty state and re-import once. No in-place migration.
- **D-20:** The worker computes a 3-field identity (nickname, region, created date) at import and stores it in the dataset meta record, so `cache-status` carries it directly on a return visit without row queries. The main thread never sees the email.
- **D-21:** `document.title` is a static "WG Data Export Viewer" in every state. The nickname appears in the identity header only (no tooltips, nav, other aria-labels, or logs). A Playwright test imports the synthetic fixture and asserts its example.invalid email and birth date appear nowhere in document text, title, attributes, or IndexedDB rows.

**Unsupported categories**
- **D-22:** Each known-deferred (Chat_history, Clans) or unknown folder gets its own banner, identical in style and text ("detected but not yet supported"), showing folder name plus file and row counts and any skipped-row count. No visual difference between the three tiers (DATA-03). Banners live in the final "Not yet supported" block.
- **D-23:** Phase 1/2's colour-coded badge list and summary line ("5 supported · 2 known-deferred · 1 unknown") are retired. Counts live inside sections and banners, so nothing is shown twice. This supersedes Phase 1 D-01–D-03 and Phase 2 D-05's badge presentation (the count content itself is kept).

**Import chrome & app states**
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

### Deferred Ideas (OUT OF SCOPE)
- A hide-nickname / screenshot-sharing mask toggle — new capability; possible later phase or backlog.
- Per-title (WoT / Blitz / WoWS / WoWP) presence and empty states within Player_statistics — Phase 5.
- Collapsible sections and a phone-width nav treatment — Phase 7 if needed.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DATA-03 | Export categories are classified 3-way (supported / known-deferred / unknown); all three render the same "detected but not yet supported" banner rather than being hidden, silently dropped, or crashing (REQUIREMENTS.md:21) | Q4: `CategoryEntry.status` already carries the 3-way tier from the worker, so banners are `categories.filter(c => c.status !== 'supported')` with no per-tier styling; fixtures for unknown folder and zero-unsupported; e2e computed-style equality check across banners |
| DATA-04 | A category folder absent from a given user's export shows that dashboard section empty/greyed-out rather than removing it (REQUIREMENTS.md:22) | Q4: absent = no `CategoryEntry` (case-insensitive), distinct from present-with-zero-rows; pure `sectionStatus()` shared by nav and sections; fixtures omit-folder and header-only CSV |
| IDENTITY-01 | Dashboard opens with an identity header (nickname, region, account-created date from `User_Info`); the account's email (`LOGIN`) is deliberately omitted (REQUIREMENTS.md:26) | Q3: worker-side sanitize-then-extract (`identity.ts`), 3-field identity on `ClassifyResult`/`DatasetMeta`; Q1: Dexie v2 upgrade wipes v1 caches containing the email; leak test design in Q6 |
</phase_requirements>

## Project Constraints (from CLAUDE.md / AGENTS.md)

Read this session: `/Users/you/CLAUDE.md`, `./CLAUDE.md` -> `AGENTS.md`, `./.claude/CLAUDE.md`. No project skill defines rules (only `.claude/skills/run-data-export-viewer`, a screenshot/driver skill that references retired test ids, see Q6). Directives the plan must honour:

- **Privacy is the product:** zero network requests after load, CSP meta, no analytics. Phase 3 adds no network surface and no dependency. The Playwright zero-network spec and CSP spec must stay green.
- **Svelte 5 runes only**, Vite 8, pnpm (not npm), **no client-side router**, plain (non-SvelteKit) Vite+Svelte.
- **Dependency minimalism:** hand-rolled UI. Do NOT add jsdom/happy-dom, bits-ui, a scroll-spy library or a test-library to satisfy this phase (see Standard Stack).
- **Single long-lived Worker; the worker is sole owner of Dexie**; the main thread talks to it only by typed messages. `fflate` is worker-only (ESLint `no-restricted-imports`).
- **Lint guards apply to all of `src/`:** `svelte/no-at-html-tags` and `svelte/no-inline-styles` are errors, `no-restricted-globals`/`no-restricted-properties` ban `fetch`, `XMLHttpRequest`, `WebSocket`, `navigator.sendBeacon` etc. Untrusted zip strings (folder names, nickname, account root) must render via plain text interpolation.
- **Commits:** do not add a `Co-Authored-By:` trailer (root `/Users/you/CLAUDE.md` overrides the harness reminder).
- **Workflow:** file-changing work goes through a GSD command; max 3 parallel subagents, not on the same files.
- TypeScript pinned `~6.0.2`; ESLint + Prettier (`pnpm run lint` = `prettier --check . && eslint .`).

## Summary

Phase 3 is almost entirely a **main-thread restructure** (App shell, five new components, one pure status function, scroll-spy) plus **three small worker/data changes** (strip 3 columns and extract a 3-field identity at parse time, bump the Dexie schema with a wiping upgrade, carry `identity` on `ClassifyResult`/`DatasetMeta`). No new packages are needed or recommended. The two cheapest-to-get-wrong areas are (1) **privacy of the strip** (case-insensitive folder matching, PapaParse's `__parsed_extra` and header-whitespace behaviour) and (2) **the client state machine**: three latent Phase 2 defects, all reproduced this session, make the approved UI-SPEC state matrix unreachable unless fixed as part of this phase.

Key findings, each verified by running code against the repo's installed versions (Dexie 4.4.6, fake-indexeddb 6.2.5, PapaParse 5.7, Chromium 1243, Node 26.10):

1. **Dexie:** a bare `version(2)` bump **preserves** all data. The correct discard pattern is `version(2).stores(<same>).upgrade(tx => clear rows + meta)`. The upgrader does **not** run on a brand-new database, does not re-run on later opens, and works under fake-indexeddb. A different DB name would leave the emailed v1 rows in the user's browser forever, so it is the wrong choice.
2. **Failed replace is atomic in IndexedDB** (probe: DataCloneError mid-`bulkPut` and a throw before `meta.put` both left the old rows and meta byte-for-byte intact). The defect is on the client: `IngestClient` nulls `result` on replace-confirm (`worker-client.svelte.ts:270`, `:382`) and in `#fail` (`:522`), so the dashboard disappears while the data is still cached. Removing those three assignments is the minimal fix; no cache re-check is needed.
3. **Two more client defects to fix in the same change** (reproduced): a drop while `state === 'duplicate'` (or `'error'` with a cached result) **skips the replace confirmation** because the guard is `state === 'done'` only; and a worker `error` during `check-cache` is ignored (`state !== 'processing'`), leaving the spinner forever.
4. **Sections:** absent-vs-empty is distinguishable today (no `CategoryEntry` vs `rowCount === 0`); matching must be case-insensitive because `classifyFolder` is.
5. **Scroll-spy:** the UI-SPEC rule is implementable, with corrections: IntersectionObserver delivers only deltas (keep a Set), the bottom-of-page override needs a "page is actually scrollable" guard, and at Phase 3 content heights the middle sections often cannot reach the band, so the e2e test must mirror the rule instead of asserting one-link-per-section.

**Primary recommendation:** Build in three waves, tests first (`tdd_mode: true`): (W1) worker/data: `db.ts` v2 + `identity.ts` + message types + pure `dashboard-status.ts` + `ui-copy.ts` + fixtures with unit tests; (W2) `IngestClient` fixes + shell components + `App.svelte`; (W3) rewrite the affected e2e specs and add the dashboard, privacy-leak and scroll/nav specs.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Dropping `LOGIN`/`BIRTH_DATE`/`BIRTH_DATE_SRC` before write | Web Worker (parse loop) | — | D-18: must happen before `writeDataset`; main thread never sees the rows |
| Identity extraction (row selection by `ID`, 3 fields) | Web Worker | IndexedDB (`meta.identity`) | D-20: computed once at import, persisted on the meta record, replayed by `cache-status` |
| Wiping v1 caches (email at rest) | IndexedDB layer in worker (`db.ts` upgrade callback) | — | Only the worker opens Dexie; the upgrade runs inside the versionchange transaction |
| Atomic replace / failed-replace safety | IndexedDB transaction (`writeDataset`) | Main-thread `IngestClient` (must not discard `result`) | The store is already atomic; the client must stop throwing the displayed result away |
| Section status derivation | Main thread (pure function over `ClassifyResult`) | — | D-08: used by nav and sections; no DOM, unit-testable in Node |
| Unsupported-category banners | Main thread (render of `categories.filter(status !== 'supported')`) | Worker (already classifies 3-way) | DATA-03 needs no new worker work |
| Identity header formatting (date-only, "Unknown") | Main thread (`ui-copy.ts` pure formatters) | — | D-15/D-16; raw strings travel from the worker |
| Sticky nav + scroll-spy | Browser / Client (CSS `position: sticky` + IntersectionObserver) | — | Pure presentation; no state leaves the component |
| Page states (processing/duplicate/error/cleared/cache-check) | Main thread (`IngestClient` state -> notice slot) | Worker messages | D-26/D-27/D-28 |
| Static hosting, CSP meta | CDN / Static (GitHub Pages) | — | Unchanged; CSP `default-src 'self'` already covers everything this phase adds (no inline styles, no network) |

## Standard Stack

### Core

No additions. Phase 3 uses only what is installed. [VERIFIED: package.json:16-36 read this session]

| Library | Version (installed) | Purpose in this phase | Why |
|---------|--------------------|-----------------------|-----|
| svelte | 5.57.1 [VERIFIED: node_modules/svelte/package.json] | Runes components, `$effect` for scroll-spy, snippets for `DashboardSection` | Locked stack |
| dexie | 4.4.6 [VERIFIED: node_modules/dexie/package.json] | `version(2).stores().upgrade()` | Locked; upgrade semantics verified by probe below |
| papaparse | ^5.7.0 | Existing parser; behaviours relied on (BOM strip, `__parsed_extra`, un-trimmed headers) probed this session | Locked |
| fake-indexeddb | 6.2.5 [VERIFIED: node_modules] | Unit-testing the Dexie upgrade | Already the unit-test IDB polyfill (`tests/unit/setup.ts`) |
| vitest 5 (environment `node`), @playwright/test 1.63.0 [VERIFIED: node_modules] | Test layers | Locked |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Pure-function unit tests + Playwright for DOM behaviour | jsdom / happy-dom + `@testing-library/svelte` | Rejected: `vitest.config.ts` runs `environment: 'node'`, tests/unit/setup.ts shims `$state` because the Svelte compiler is deliberately not in the vitest pipeline (Vite 8/rolldown incompatibility documented in vitest.config.ts:15-42). Adding a DOM env is a new dependency plus a known-fragile toolchain path, against AGENTS.md dependency minimalism. Keep components thin; test logic as pure `.ts`; test DOM in Playwright. |
| Hand-written `IntersectionObserver` scroll-spy | a scroll-spy package | Rejected (dependency minimalism); ~40 lines |
| Svelte `$effect` for the observer | `{@attach}` (exists in 5.57.1: `node_modules/svelte/src/attachments/index.js` present) | Both work; use `$effect` (documented, familiar, cleanup semantics verified). |

**Installation:** none. `pnpm install --frozen-lockfile` only.

## Package Legitimacy Audit

No external packages are installed or recommended by this phase, so the seam check was not run.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| (none) | — | — | — | — | — | — |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Research Findings: answers to the planner's seven questions

### Q1. Dexie schema bump (D-19): what happens to data, and how to discard it

**What exists** [VERIFIED: src/lib/worker/db.ts:47-58]:
```ts
export class AppDb extends Dexie {
  rows!: Table<DatasetRow, number>;
  meta!: Table<DatasetMeta, string>;

  constructor() {
    super('wg-export-viewer');
    this.version(1).stores({
      rows: '++id, category, sourceFile',
      meta: 'id',
    });
  }
}
```

**Probe results** (`node probe1.cjs`, Dexie 4.4.6 + fake-indexeddb 6.2.5, DB seeded with a v1 row containing a `LOGIN` value and a v1 meta record):

| Case | Output |
|------|--------|
| A: `version(2).stores(<same>)`, no upgrader | `rows= 1 meta= 1 verno= 2` (data preserved) |
| B: `version(2).stores(<same>).upgrade(clear rows + meta)`, v1 not redeclared | `rows= 0 meta= 0 upgradeCalled= 1` |
| C: same declaration on a brand-new DB | `upgradeCalled= 0 verno= 2`; re-open at same version: `meta= 1 upgradeCalled= 0` |
| D: raw IndexedDB version after Dexie v2 | `20` (Dexie multiplies by 10) |

[CITED: dexie.org/docs/Tutorial/Design] "If database is not present, Dexie initializes the last version directly ... No upgrade() functions run in this case." and (Dexie >= 3.0) "You only need to keep versions that have an upgrader ...". So the bare bump keeps the email-bearing rows; only an upgrader discards them.

**Prescribed pattern (use exactly this):**
```ts
// src/lib/worker/db.ts   (imports: `import Dexie, { type Table, type Transaction } from 'dexie';`)
constructor() {
  super('wg-export-viewer');
  // D-19: v1 caches hold the raw LOGIN email. Same schema, new version, wipe on upgrade.
  // An upgrader runs only for existing v1 databases (never on a fresh install).
  this.version(2)
    .stores({ rows: '++id, category, sourceFile', meta: 'id' })
    .upgrade(async (tx: Transaction) => {
      await tx.table('rows').clear();
      await tx.table('meta').clear();
    });
}
```
Why not the alternatives:
- **Delete the database / `Dexie.delete()` before open:** extra code, `blocked` edge cases, and it must run before every open. The upgrader is the idiomatic, atomic, once-only mechanism.
- **A differently named DB:** leaves the old `wg-export-viewer` database (with emails) in the user's browser forever. This defeats the point of D-19.
- **Keep the `version(1)` declaration:** optional and harmless (probe B proved v2-only works because Dexie reads the installed schema). Keep only v2.

**Rules for later phases (record in a code comment):** when Phase 4+ adds indexes and declares `version(3)`, **keep the `version(2)...upgrade()` declaration** (Dexie needs versions that carry an upgrader for devices still at v1).

**fake-indexeddb test (works, no special handling):** the class `AppDb` is exported, so seed a legacy v1 DB with a bare `Dexie` instance, close it, then open `new AppDb()`:
```ts
import Dexie from 'dexie';
import { AppDb, db } from '../../src/lib/worker/db.ts';

test('v1 -> v2 upgrade discards rows and meta (D-19)', async () => {
  await db.delete();                                   // the module singleton; existing tests use delete()+open()
  const legacy = new Dexie('wg-export-viewer');
  legacy.version(1).stores({ rows: '++id, category, sourceFile', meta: 'id' });
  await legacy.open();
  await legacy.table('rows').add({ category: 'User_Info', sourceFile: 'Account_Info.csv', rowIndex: 0, data: { LOGIN: 'x@example.invalid' } });
  await legacy.table('meta').put({ id: 'active', hash: 'h', accountRoot: '1', importedAt: 'x', categories: [] });
  legacy.close();

  const upgraded = new AppDb();
  await upgraded.open();
  expect(await upgraded.rows.count()).toBe(0);
  expect(await upgraded.meta.count()).toBe(0);
  upgraded.close();
});
```
Also add a "fresh DB keeps data written at v2 across a re-open" test (guards against the upgrader ever clearing live data). [ASSUMED: exact test text is illustrative; the probe proves the semantics.]

**Old-tab caveat:** a second tab still holding the v1 connection is closed by Dexie's default `versionchange` handler; that stale tab's next call throws `DatabaseClosedError`. Acceptable for a single-user local tool; note it in the plan, no code needed. [ASSUMED: Dexie default versionchange behaviour, not exercised]

### Q2. Failed-replace atomicity and the client state that discards the displayed result

**Worker trace (ingest.worker.ts, read this session):**
1. `handleIngest` reads the file, hashes, calls `checkCache()` (read only), posts `duplicate` and returns on hash match. [VERIFIED: ingest.worker.ts:104-126]
2. Unzip, classify, per-category parse loop build `allRows` and `updatedCategories` **in memory** only. Nothing touches IndexedDB. [VERIFIED: ingest.worker.ts:128-186]
3. The only write is `writeDataset(...)` at ingest.worker.ts:189-194, whose body is one `db.transaction('rw', db.rows, db.meta, ...)` containing `rows.clear()`, chunked `bulkPut`, `meta.put` (db.ts:79-88). There is **no** `try/catch` inside the transaction and no non-Dexie `await`, so any throw aborts and rolls back.
4. Any failure lands in the single `catch` (ingest.worker.ts:202-210) which posts `{ type: 'error', jobId, detail }`.

**Probe** (`node probe2.cjs`, mirrors `writeDataset`; seeded with 5 "old" rows and meta hash `OLD`):
```
1 threw: DataCloneError - () => 1 could not be cloned.
1 after failed bulkPut: rows 5 tags [ 'old' ] meta.hash OLD
2 threw: Error - boom before meta.put
2 after failure before meta.put: rows 5 tags [ 'old' ] meta.hash OLD
3 success: rows 3 meta.hash NEW3
```
[CITED: developer.mozilla.org/en-US/docs/Web/API/IDBTransaction/abort] "rolls back all the changes to objects in the database associated with this transaction." So a mid-transaction failure (including a quota abort, which the platform surfaces as an aborted transaction) leaves the **old dataset fully intact** in IndexedDB. State exactly what a failed replace leaves: **old `rows` + old `meta` (old hash, importedAt, categories), unchanged.** UI-SPEC's "re-run the cache check after a failed replace" is therefore **not needed**. [ASSUMED: that browsers abort (not partially commit) on quota errors follows the IndexedDB spec, not exercised against real quota exhaustion; Safari/Firefox untested]

**Client trace (worker-client.svelte.ts) — where the old result is thrown away**, quoted verbatim:
- replace confirm, line 270: `      this.result = null;` (inside `confirmPending()` `kind === 'replace'` branch, lines 259-277)
- first-import/other submit, line 382: `    this.result = null;` (inside `submitFiles()`, lines 380-384)
- failure, line 522: `    this.result = null;` (inside `#fail`, lines 518-524)

Probe 5 (`node probe5.mjs`, real `IngestClient` with a fake worker): after replace-confirm `state= processing result= null`; after the worker error `state= error result= null`. Cache still holds the old dataset, UI shows nothing: exactly the UI-SPEC "unresolved" row.

**Minimal state change (recommended):** treat `result` as **"the last known cached dataset"**, not "the result of the current job".
1. Delete the three `this.result = null` lines above. `reset()` (line 190) and the `cleared` handler (line 496) keep nulling it. `done` / `duplicate` / `cache-status` already assign it.
2. `App.svelte` decides dashboard-vs-skeleton with `ingestClient.result !== null`, and decides notices from `ingestClient.state` (see the app-state derivation in Code Examples). Import-bar variant is `slim` iff `result !== null`.
3. No new field is required. Existing unit tests are unaffected (grep of tests/unit/ingest-client.test.ts: the only `result` null assertions are on never-set results or after `reset()`).

**Two more defects found while tracing (reproduced with probe 5, both change observable behaviour under the new matrix, fix them in the same task):**

- **Replace-confirm bypass.** `submitFiles()` guards on `if (this.state === 'done')` (worker-client.svelte.ts:341). Probe: after a `duplicate` notice, dropping a different zip gave `state= processing`, `pendingAction= null`, i.e. it went straight to the worker and would overwrite the cached dataset with **no confirmation**, contradicting Phase 2 D-13 (and the same after an `error` that now keeps a result). **Fix:** key the guard on "a result is displayed" (`this.result !== null && this.state !== 'processing'`), not on `state === 'done'`. Also **ignore drops while `state === 'confirm-pending'`** (currently they fall through, move the machine to `processing`/`error` and leave a stale `pendingAction`).
- **Cache-check error hangs the spinner.** The `error` branch starts with `if (this.state !== 'processing') return;` (line 475). Probe: `worker error during check-cache: state= checking-cache`. D-19's upgrader adds a new way for the first read to fail (blocked/failed upgrade), so the page would spin forever. **Fix:** in the `error` branch, when `state === 'checking-cache'` and the jobId matches, log with `console.error` and go to `idle` with `result = null` (skeleton + full dropzone). Do not show `GENERIC_FAILURE_MESSAGE` (its text says "This doesn't look like a Wargaming data export", wrong for a storage failure). [ASSUMED: `idle` is the right recovery; a design choice for the planner.]

Existing tests that encode the old guard: `ingest-client.test.ts` "done-state guard" (`state 'done'` -> confirm) still passes. Add new tests for the three fixes (see Validation Architecture).

**Caveat for the planner:** `IngestClient` is a `.svelte.ts` file loaded in vitest with a `$state` passthrough shim only (tests/unit/setup.ts:40). Do **not** add `$derived`/`$effect` runes inside it; use plain getters. Derived values belong in `.svelte` components.

### Q3. Where User_Info rows are produced; stripping and identity extraction

**Where:** the parse loop at ingest.worker.ts:149-186. For each `CategoryEntry` it calls `parseCsvFile(text, entry.name, resolved.sourceFile)` (line 169) and pushes `parsed.rows[r]!.data` verbatim into `allRows` (lines 170-177). That `push` is the single choke point: sanitise here, before `allRows.push`.

**`parseCsvFile`** [VERIFIED: csv-parse.ts:43-47]: `Papa.parse<Record<string, string | undefined>>(text, { header: true, skipEmptyLines: true, worker: false })`. Values pass through `fixMojibake` (Cyrillic nicknames are corrected before extraction); header keys do not.

**Probe 3 (PapaParse 5.7 on the header shapes a strip must survive):**
```
BOM header       [{"ID":"1","NAME":"Nick","LOGIN":"a@x.invalid"}]        (BOM stripped by Papa)
leading CRLF     same                                                     (fixture shape)
extra fields     [{"ID":"1","NAME":"Nick","__parsed_extra":["a@x.invalid","1990-01-01"]}]
lowercase hdr    [{"id":"1","name":"Nick","login":"a@x.invalid"}]
spaced hdr       [{"ID ":"1"," NAME ":"Nick"," LOGIN":"a@x.invalid"}]      (headers NOT trimmed)
header only      []                                                        (zero rows)
dup header       [{"ID":"1","NAME":"A","NAME_1":"B"}]                      (Papa renames duplicates)
```
Consequences (all are **privacy** defects if ignored):
1. Match dropped columns on a **normalised key**: `key.trim().toUpperCase()`, allowing Papa's `_N` duplicate suffix: `/^(LOGIN|BIRTH_DATE|BIRTH_DATE_SRC)(_\d+)?$/`.
2. **Also drop `__parsed_extra` from User_Info rows:** when a row has more fields than the header, extra cells (which can be the email) land in that array under a key that no column list would catch.
3. **Category matching must be case-insensitive.** `classifyFolder` lowercases [VERIFIED: categories.ts:39-41 `const lower = name.toLowerCase();`], so a folder named `user_info` classifies as `supported` and keeps the name `user_info`. A strip keyed on `entry.name === 'User_Info'` would silently leak. Use `entry.name.toLowerCase() === 'user_info'`, and treat all matching entries (case variants) uniformly.
4. Apply the strip to **every** row of the User_Info category (all files), not only `Account_Info.csv`.

**Recommended module `src/lib/worker/identity.ts`** (pure, no worker globals; unit-testable in Node). Names are proposals (discretion area).
```ts
import type { AccountIdentity } from '../types/worker-messages.ts';
type Row = Record<string, string | undefined>;

const DROPPED_COLUMN = /^(LOGIN|BIRTH_DATE|BIRTH_DATE_SRC)(_\d+)?$/;

export function isUserInfoCategory(name: string): boolean {
  return name.toLowerCase() === 'user_info';
}

/** D-18: returns a NEW row without LOGIN / BIRTH_DATE / BIRTH_DATE_SRC (and Papa's overflow bucket). */
export function sanitizeUserInfoRow(data: Row): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(data)) {
    if (k === '__parsed_extra') continue;
    if (DROPPED_COLUMN.test(k.trim().toUpperCase())) continue;
    out[k] = v;
  }
  return out;
}

function pick(row: Row, column: string): string | null {
  for (const [k, v] of Object.entries(row)) {
    if (k.trim().toUpperCase() === column && typeof v === 'string' && v.trim() !== '') return v.trim();
  }
  return null;
}

/** D-17: row whose ID equals the account root, else the first row. Reads SANITISED rows only. */
export function extractIdentity(rows: readonly Row[], accountRoot: string): AccountIdentity | null {
  if (rows.length === 0) return null;
  const match = accountRoot === '' ? undefined : rows.find((r) => pick(r, 'ID') === accountRoot);
  const row = match ?? rows[0]!;
  return { nickname: pick(row, 'NAME'), region: pick(row, 'REGION'), createdAt: pick(row, 'CREATED_AT') };
}
```
Column names above are the verified header [VERIFIED: tests/fixtures/export-fixtures.ts:120-121] `'ID;NAME;CREATED_AT;ACTIVATED_AT;IP;COUNTRY_CODE;REGION;CITY;LOGIN;USER_LANGUAGE;USER_STATED_COUNTRY;BIRTH_DATE;BIRTH_DATE_SRC'` (also PROJECT.md:60).

**Worker change (sketch):** inside the per-category loop, `const userInfo = isUserInfoCategory(entry.name);` collect `sanitized` rows (preferring rows whose `sourceFile` basename lower-cases to `account_info.csv`, else all User_Info rows); push `sanitizeUserInfoRow(data)` instead of `data`; after the loop compute `const identity = extractIdentity(candidateRows, outcome.result.accountRoot)` (stays `null` when no User_Info row was parsed) and pass it to `writeDataset` and into `finalResult`. Because `extractIdentity` only ever receives sanitised rows, `LOGIN` cannot reach the identity object by construction.

**Where the identity object lives:**
- New type in `worker-messages.ts`: `export interface AccountIdentity { nickname: string | null; region: string | null; createdAt: string | null }`.
- `ClassifyResult` gets `identity?: AccountIdentity | null` (optional, so the many existing test literals and the pre-parse `analyzeExport` result still type-check). [VERIFIED: ClassifyResult at worker-messages.ts:22-33 has `accountRoot`, `categories`, `counts`, `importedAt?`]
- `DatasetMeta` gets `identity?: AccountIdentity | null` [VERIFIED: DatasetMeta at db.ts:37-43 is `id`, `hash`, `accountRoot`, `importedAt`, `categories`].
- `writeDataset(hash, accountRoot, categories, rows, identity = null)`: add a 5th **optional** parameter so the existing 4-argument calls in tests/unit/db.test.ts keep compiling, and put `identity` in the `meta.put({...})`.
- `done`, `duplicate`, `cache-status` all send a `ClassifyResult`. The worker currently builds that literal in two places (ingest.worker.ts:81-91 and :115-124); extract one `resultFromMeta(meta)` helper that adds `identity: meta.identity ?? null` so the two replays cannot diverge, and add `identity` to `finalResult` (line 196).
- No message-type changes (`IngestResponse` is unchanged).

**Semantics recommendation (identity `null` vs all-null fields):** worker stores `identity: null` when **no** User_Info row was parsed (folder absent, or present with zero rows); it stores an object with `null` fields when a row existed but fields were missing. UI: `identity === null` -> the D-16 fallback header (title = account ID, no caption, no `dl`); object -> loaded header with `Unknown` in null slots. The large-export fixture (`User_Info` = 2500 `part-NNNNN.csv` files with `PART_ID;VALUE`) therefore yields a loaded header with three `Unknown`s, which is correct. [ASSUMED: the empty-User_Info edge is not specified by UI-SPEC; confirm with the planner.]

**Rootless edge:** `analyzeExport` returns `accountRoot === ''` for a re-zip with no ID folder (`buildRootlessExport`). The fallback header title and the "Account ID:" line would render empty. Decide copy (e.g. title `Unknown account`, omit the ID line) and add it to `ui-copy.ts` with a test. [ASSUMED: needs a copy decision.]

### Q4. Section status derivation

**What `ClassifyResult`/`CategoryEntry` carry** [VERIFIED: worker-messages.ts:1-20]: `export type CategoryStatus = 'supported' | 'known-deferred' | 'unknown';` and `CategoryEntry { name; status; fileCount; rowCount?: number; skippedRowCount?: number }`. `rowCount`/`skippedRowCount` are set by the worker after the parse loop (ingest.worker.ts:181-185) and are optional (absent = 0) on a pre-parse result.

**Absent vs zero-row are distinguishable today:**
- **Absent:** `analyzeExport` only creates entries for folders it saw (`for (const [name, fileCount] of counts)` in classify.ts:323-327), so a missing supported folder simply has **no** `CategoryEntry`.
- **Empty:** entry exists with `rowCount` 0/undefined. Covers: a header-only CSV (probe 3: header only -> `[]`), a directory-only folder (`fileCount` 0), a folder holding no `.csv` files, and a folder whose only rows were skipped (`rowCount 0`, `skippedRowCount > 0`).
- **Case:** `classifyFolder` is case-insensitive, so match by `entry.status === 'supported' && entry.name.toLowerCase() === folder.toLowerCase()`, and **sum** across multiple matching entries (e.g. `User_Info` and `user_info`).
- **Order trap:** do NOT derive section order from `SUPPORTED` [VERIFIED: categories.ts:11-16]:
  `export const SUPPORTED: readonly string[] = [ 'Activity_history', 'Player_statistics', 'User_Info', 'Payment_history', ];`
  D-02 order is `Activity_history, Player_statistics, Payment_history, User_Info`. Likewise `SAMPLE_BADGE_ORDER` (fixtures) is alphabetical-within-status and differs from D-02. Define an explicit `SECTIONS` constant.

**Recommended pure module `src/lib/dashboard-status.ts`** (plain `.ts`; type-only imports; used by nav, sections and banners):
```ts
import type { CategoryEntry, ClassifyResult } from './types/worker-messages.ts';

export const SECTIONS = [
  { id: 'activity-history', folder: 'Activity_history' },
  { id: 'player-statistics', folder: 'Player_statistics' },
  { id: 'payment-history', folder: 'Payment_history' },
  { id: 'user-info', folder: 'User_Info' },
] as const;
export type SectionId = (typeof SECTIONS)[number]['id'];
export type SectionStatus = 'not-loaded' | 'no-export' | 'empty' | 'pending' | 'ready';

/** Phases 4-6 add their id here when the dashboard ships; everything else stays `pending`. */
export const BUILT_DASHBOARDS: ReadonlySet<SectionId> = new Set();

export interface SectionCounts { fileCount: number; rowCount: number; skippedRowCount: number }

function entriesFor(folder: string, result: ClassifyResult): CategoryEntry[] {
  const f = folder.toLowerCase();
  return result.categories.filter((c) => c.status === 'supported' && c.name.toLowerCase() === f);
}
export function sectionCounts(folder: string, result: ClassifyResult | null): SectionCounts | null {
  if (result === null) return null;
  const es = entriesFor(folder, result);
  if (es.length === 0) return null;
  return es.reduce((a, c) => ({ fileCount: a.fileCount + c.fileCount, rowCount: a.rowCount + (c.rowCount ?? 0), skippedRowCount: a.skippedRowCount + (c.skippedRowCount ?? 0) }), { fileCount: 0, rowCount: 0, skippedRowCount: 0 });
}
export function sectionStatus(id: SectionId, result: ClassifyResult | null, built = BUILT_DASHBOARDS): SectionStatus {
  if (result === null) return 'not-loaded';
  const folder = SECTIONS.find((s) => s.id === id)!.folder;
  const counts = sectionCounts(folder, result);
  if (counts === null) return 'no-export';
  if (counts.rowCount === 0) return 'empty';
  return built.has(id) ? 'ready' : 'pending';
}
export type UnsupportedBlockStatus = 'not-loaded' | 'none' | 'has-items';
export function unsupportedEntries(result: ClassifyResult | null): CategoryEntry[] {
  return result === null ? [] : result.categories.filter((c) => c.status !== 'supported');
}
export function unsupportedBlockStatus(result: ClassifyResult | null): UnsupportedBlockStatus {
  if (result === null) return 'not-loaded';
  return unsupportedEntries(result).length === 0 ? 'none' : 'has-items';
}
```
`unsupportedEntries` keeps the worker order (known-deferred, then unknown, name ascending) because `analyzeExport` already sorts [VERIFIED: classify.ts:329-340]. DATA-03's "no difference between tiers" is satisfied by rendering from one list with no `status`-driven class.

**Unit tests for this module (tests/unit/dashboard-status.test.ts), table-driven:**

| Case | Input | Expected |
|------|-------|----------|
| no export | `result = null` | all four `not-loaded`; block `not-loaded` |
| absent | sample minus Payment_history | `payment-history` -> `no-export` |
| empty (header-only CSV) | `Payment_history` entry, `rowCount: 0` | `empty` |
| empty (directory only) | `fileCount: 0`, `rowCount` undefined | `empty` |
| pending | `rowCount > 0` | `pending`; `ready` only when `built` contains the id |
| case-insensitive | entry `user_info` | `user-info` -> `pending` (not `no-export`) |
| multi-entry sum | `User_Info` (2 rows) + `user_info` (3 rows) | counts 5 rows |
| non-supported names never match | `Chat_history` present | does not affect any section |
| unsupported list | sample | `Chat_history, Clans, Bans, Device_info` (worker order), none `supported` |
| zero unsupported | only supported folders | block `none` |
| skipped-only | `rowCount 0`, `skippedRowCount 3` | `empty` (and see Open Question 2) |

### Q5. Sticky nav and scroll-spy

**Verified in Chromium 1243 (Playwright) with a synthetic page mirroring the spec (probes 4 and 6):**

1. **Band rule works.** `rootMargin: '-72px 0px -60% 0px'` + "topmost intersecting section wins, else keep previous, initial = first" gave `initial: a`, `a -> a`, `b -> b` for tall sections.
2. **Percentage semantics.** The W3C text says percentages resolve "relative to the width of the undilated rectangle" [CITED: w3.org/TR/intersection-observer], but Chromium resolves top/bottom percentages against **height** (probe 4: 1000x500 viewport, bottom `-50%`: t1 at y=100 intersecting, t2 at y=300 not; 375x800, band 72..320 as the spec's 60% of height). The UI-SPEC string works in Chromium; behaviour in Firefox/Safari is unverified [ASSUMED]. If cross-browser drift matters (best-effort browsers per AGENTS.md), compute the bottom margin in px from `innerHeight` and rebuild the observer on resize instead. Recommendation: **use the UI-SPEC string**, log the assumption, defer px-rebuild until Safari/Firefox testing exists.
3. **IO delivers deltas.** [CITED: MDN Intersection Observer API] "one IntersectionObserverEntry object for each threshold-crossing event" and the callback fires on first `observe()`. So keep a `Set<string>` of currently-intersecting ids, update it from `entries`, then pick the first id **in DOM order** that is in the set. Using only the current callback's entries gives wrong answers when several sections intersect.
4. **Bottom override needs a guard.** Probe 6 (720x2600 viewport, tiny page, nothing scrollable): `scrollY + innerHeight >= scrollHeight - 1` is true at `scrollY = 0`. Without a guard the last link would be current on any non-scrollable page (tall/4K screens, skeleton state) and violate "initial = first". Guard: `scrollHeight > innerHeight && scrollY > 0`. Probe confirmed that with the guard the non-scrollable page stays on `a`.
5. **At Phase 3 content heights, middle sections often cannot become current.** Probe 6 (720x800; heights 600/500/300/200/120): scrolling each link into place gave `a, b, e, e, e`: sections `c` and `d` could not reach the band before the page bottomed out, so the override reported the last section. Phase 3 sections are short (import summary + one note), so this will happen in the real app on typical viewports. This is consistent with the UI-SPEC rule but means the UI-SPEC's backstop test ("scrolling to each section moves `aria-current` to the matching link") **cannot be asserted per section**. Write the e2e assertion to mirror the rule: after an instant scroll to section S, expect `aria-current` on S, **or** on the last link when `scrollY >= scrollHeight - innerHeight - 1`; and separately assert bottom -> last link and top -> first link. Use the sample export (its Not yet supported block has 4 banners and is tall) and a short viewport (e.g. 720x400) to get more sections to align. It also means clicking "User_Info" may highlight "Not yet supported": flag for UAT, not a bug.
6. **Smooth scroll makes tests nondeterministic.** Playwright's default context is `prefers-reduced-motion: no-preference`, so `html { scroll-behavior: smooth }` applies to `window.scrollTo`/`scrollIntoView`. In tests use `scrollTo({ top, behavior: 'instant' })` or `test.use({ reducedMotion: 'reduce' })` (option exists: `reducedMotion?: null|"reduce"|"no-preference"` in playwright-core types [VERIFIED: playwright-core types.d.ts:2812]). The IO fires continuously during a smooth scroll, so intermediate links flash current; no gating needed, the spec is right that the observer changes no motion.

**Implementation approach:**
- Pure, Node-testable function (recommended `src/lib/scroll-spy.ts`):
```ts
export function pickActiveSection(a: {
  order: readonly string[]; intersecting: ReadonlySet<string>; previous: string; atBottom: boolean;
}): string {
  if (a.atBottom) return a.order[a.order.length - 1]!;
  return a.order.find((id) => a.intersecting.has(id)) ?? a.previous;
}
export function isAtPageBottom(w: { scrollY: number; innerHeight: number }, docHeight: number): boolean {
  return docHeight > w.innerHeight && w.scrollY > 0 && w.scrollY + w.innerHeight >= docHeight - 1;
}
```
  Unit tests: table over (intersecting set, previous, atBottom) incl. empty set keeps previous, multi-intersect picks topmost, bottom wins, non-scrollable never bottom.
- Wiring in the nav component with `$effect` (verified semantics [CITED: svelte.dev/docs/svelte/$effect]: runs after mount; returns a teardown that runs before re-run and on destroy; only synchronously-read reactive values are dependencies):
```svelte
<script lang="ts">
  import { SECTION_ORDER } from '../dashboard-nav.ts';   // ['activity-history', ..., 'not-yet-supported']
  import { pickActiveSection, isAtPageBottom } from '../scroll-spy.ts';
  let activeId = $state<string>(SECTION_ORDER[0]!);

  $effect(() => {
    const els = SECTION_ORDER.map((id) => document.getElementById(id));
    if (els.some((e) => e === null)) return;
    const navOffset = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-offset'), 10) || 72;
    const intersecting = new Set<string>();
    let previous = SECTION_ORDER[0]!;
    const recompute = () => {
      previous = pickActiveSection({
        order: SECTION_ORDER, intersecting, previous,
        atBottom: isAtPageBottom(window, document.documentElement.scrollHeight),
      });
      activeId = previous;              // write only; never READ activeId in this effect
    };
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) (e.isIntersecting ? intersecting.add(e.target.id) : intersecting.delete(e.target.id));
      recompute();
    }, { rootMargin: `-${navOffset}px 0px -60% 0px` });
    els.forEach((el) => io.observe(el!));
    let raf = 0;
    const onScroll = () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; recompute(); }); };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => { io.disconnect(); cancelAnimationFrame(raf); window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); };
  });
</script>
```
  (`--nav-offset` is read from CSS so the 72px lives in one place [VERIFIED: 03-UI-SPEC.md:68 "`--nav-offset: 72px`"]; the string `-72px 0px -60% 0px` is the UI-SPEC's [VERIFIED: 03-UI-SPEC.md:241].)
- **Targets must persist.** The observer holds element references. If `DashboardSection`'s root `<section>` is re-created when `status` changes (e.g. status toggles an `{#if}` around the root, or a keyed `{#each}` remounts), the observer silently watches detached nodes. Keep one stable `<section id>` per section; branch only on its inner content. The same applies to the import region (UI-SPEC already says one DOM element for both variants).
- **Mount timing.** The nav, sections and the effect must live under the same `{#if state !== 'checking-cache'}` branch so the ids exist when the effect runs; the guard `if (els.some(e => e === null)) return` above protects against the checking-cache state.

**Sticky pitfalls (Svelte 5 + 375px):**
- `position: sticky` sticks to the nearest ancestor with a scrolling mechanism; `overflow: hidden|auto|scroll` on **any ancestor** kills it [CITED: MDN position]. Never "fix" page-level horizontal overflow with `overflow-x: hidden` on `body`/`main`; fix the cause (`min-width: 0`, `overflow-wrap: anywhere`).
- The sticky element must be a **direct child of the tall flex column** (the `main`-level container). Wrapping the nav in a shrink-to-fit `<div>` confines stickiness to that wrapper. The nav component's root element must itself be the `<nav>`.
- `overflow-x: auto` on the nav makes `overflow-y` compute to `auto` too [CITED: MDN overflow], which can show a phantom vertical scrollbar on sub-pixel heights. Add `overflow-y: hidden` (safe: the container's 8px padding exceeds the 5px focus ring).
- Give the five `<li>`/links `flex: none` (with `white-space: nowrap`) so they never shrink; the scrolling container is the `<nav>`, the `<ul>` is `display: flex`.
- Global `p { margin: 8px 0 }` and `h2 { margin: 16px 0 8px }` in app.css will fight the card `gap: 8px`; the UI-SPEC already requires `margin: 0` for h1/h2, set `margin: 0` on `p` inside the new components too.
- `scroll-behavior` and `--nav-offset` belong in `app.css` (global), not in a component `<style>` (Svelte scopes selectors; `html`/`:root` would need `:global`).
- Do not use `style=` attributes or `style:` directives for state (lint `svelte/no-inline-styles` is an error; CSP has no `'unsafe-inline'`); toggle classes.
- `aria-current="location"` is set on the `<a>`; the visually-hidden suffix span sits inside the link so its accessible name reads `Payment_history, not in this export` (no `aria-label`).

### Q6. Existing tests affected, fixtures to add, and the leak-test approach

**Unit tests**

| File | What changes |
|------|--------------|
| `tests/unit/ui-copy.test.ts` | Delete the `formatSummary` blocks (lines 80-128, 175-190) and the `formatAccountHeading` block (154-172) and their imports (lines 7-9); add tests for new formatters (`formatCreatedDate`, `formatAccountId`, status/suffix strings, skeleton copy). `formatFileCount`, stable copy, `STAGE_TEXT` tests stay. |
| `tests/unit/ingest-client.test.ts` | Existing tests still pass with the `result` change (verified by grep). Add: replace-confirm keeps `result`; worker `error` after replace keeps `result`; drop in `duplicate`/`error`-with-result goes to `confirm-pending`; drop during `confirm-pending` is ignored; worker `error` in `checking-cache` -> `idle`. |
| `tests/unit/db.test.ts` | Add v1->v2 upgrade test (Q1); `writeDataset(..., identity)` persists `meta.identity`; existing 4-arg calls still compile (5th param optional). |
| `tests/unit/ingest-worker.test.ts` | Extend test (a): result carries `identity` (nickname `Synthetic Player`, region `CA`, createdAt `2020-01-01 00:00:00`); read `db.rows` and assert no row has a key matching LOGIN/BIRTH_DATE/BIRTH_DATE_SRC and `JSON.stringify(allRows + meta)` contains neither the fixture email nor birth date; a second ingest (duplicate) and a fresh `check-cache` message return the same `identity`. |
| `tests/unit/classify.test.ts` | Uses `SAMPLE_BADGE_ORDER` (lines 6, 165-169, 451-465): **keep that constant unchanged.** |
| new | `tests/unit/dashboard-status.test.ts`, `tests/unit/identity.test.ts`, `tests/unit/scroll-spy.test.ts` |

**E2E tests that assert retired markup (must change)**

| File | Lines (approx.) | Retired thing asserted | Replace with |
|------|-----------------|------------------------|--------------|
| `import-flow.spec.ts` | 18, 128-174, 201-210 | `formatSummary`, `account-heading`, `summary-line`, `category-badge` (count 8, order, text) | `identity-header`/`identity-account-id`, `dashboard-section-*` + `section-summary`, `unsupported-banner`. D-02 order is not `SAMPLE_BADGE_ORDER`. |
| `import-flow.spec.ts` | 234-249 (test d) | `results` testid | `import-bar[data-variant=slim]` or `identity-header` |
| `import-flow.spec.ts` | 256-325 (test e) | `results`, `account-heading`, and it **relies on** `start-over` not needing confirmation | Rewrite: click `start-over`, then click `confirm-commit`; the subsequent notes.txt drop happens on the skeleton. With the drop-during-confirm fix, the old sequence would hang in `confirm-pending`. |
| `import-flow.spec.ts` | 331-399 (test f), 405-424 (test g), 430-452 (test h) | `account-heading`, `category-badge` ("2500 files"), `results`, body text `Account: ...`, `summary-line` | `section-summary` in `dashboard-section-activity-history` (contains `2500 files`), `identity-account-id` text `Account ID: 123456789`. Test (g) is superseded by the new leak spec (keep the `192.0.2.10` IP assertion: the IP is still stored but must still not be **rendered**). |
| `persistent-dataset.spec.ts` | 60-65, 89-150 | `results`, `category-badge` x8, `expectedBadgeText`, `imported-at`, `summary-line`, `account-heading`, `formatSummary` | Section/banner assertions; keep `imported-at`; assert `import-bar[data-variant=slim]` after reload with no file set |
| `persistent-dataset.spec.ts` | 195, 223-248 | `results` count 0; `category-badge` Bans + `badge-skipped-count` | skeleton `data-status="not-loaded"`; Bans `unsupported-banner` containing `1 row skipped`; needs a **skip-tag test id** (see below) |
| `persistent-dataset.spec.ts` | 333-334, 353-360 | `account-heading`, badge text | section summary |
| `persistent-dataset.spec.ts` | 421-476, 498-536, 562-583, 612-641 | `results`, `account-heading`, `summary-line`, `formatSummary` | identity/section assertions; `persistent-bar` count 0 must still hold on the full-variant skeleton (render `persistent-bar` only in the slim variant); `cleared-ack` stays |
| `import-failure.spec.ts` | 83, 188, 330 | `getByRole('heading', { level: 2 })` `toHaveCount(0)` | The skeleton now renders **six** `<h2>` (No export loaded + five sections). Assert `identity-nickname` count 0 / `import-bar[data-variant=full]` instead. |
| `import-failure.spec.ts` | 213, 259, 272 | `getByRole('heading', {level: 2}).toHaveText('Account: 123456789')` | `identity-nickname` = `Synthetic Player` (strict-mode would throw on six headings) |
| `zero-network.spec.ts` | 56 | same heading assertion | `identity-nickname` visible |
| `.claude/skills/run-data-export-viewer/driver.mjs` (lines 93-113) and `SKILL.md` | `processing-status`, `account-heading`, `start-over` flow | update the driver and the screenshot narrative; low risk, but the skill will silently break otherwise |

**UI-SPEC test-hook gaps to close in the plan** (UI-SPEC.md:316-318 lists the hooks): (1) `imported-at` is neither kept nor retired, but `persistent-dataset.spec.ts` (test a) asserts it before and after reload; **keep it** (D-25). (2) There is no hook for the skip tag, needed to assert "exactly one tag" (`badge-skipped-count` is retired); add `data-testid="skip-tag"`. (3) Add `data-variant="skeleton|loaded|fallback"` to `identity-header` so tests can tell the D-16 fallback apart. (4) The skeleton `<h2>` ("No export loaded") must **not** carry `identity-nickname`.

**Behaviour that existing specs still rely on (keep):** `main[data-worker-ready]`; `dropzone`, `file-input` (one dropzone, disabled while busy, `aria-busy="true"` while processing: test (a) in import-flow reads `aria-disabled`/`aria-busy` and `processing-status` text `STAGE_PATTERN` in one evaluate, so **set `aria-busy` from `disabled`**, since the spinner no longer lives inside the label); `failure-banner` with zero `<a>`/`<button>` children; `confirm-panel`/`confirm-cancel`/`confirm-commit`; `cleared-ack`; `cache-check-status`.

**Fixtures to add to `tests/fixtures/export-fixtures.ts`** (sampleEntries is module-private; export a small customisable builder):
- Export the constants used by tests instead of literals: `SAMPLE_NICKNAME = 'Synthetic Player'`, `SAMPLE_REGION = 'CA'`, `SAMPLE_CREATED_AT = '2020-01-01 00:00:00'` (displayed `2020-01-01`), `SAMPLE_LOGIN = 'synthetic.player@example.invalid'`, `SAMPLE_BIRTH_DATE = '1990-01-01'` (values from ACCOUNT_INFO_ROW, export-fixtures.ts:123-137).
- `buildCustomExport({ root?, omitFolders?, overrides? })` returning zip bytes from `sampleEntries` minus folders plus overridden files. Named wrappers:
  - `buildMissingUserInfoExport()` (omit `User_Info`): header falls back to account ID; section `no-export`.
  - `buildMissingPaymentHistoryExport()` (omit `Payment_history`): DATA-04.
  - `buildZeroRowPaymentExport()` (`Payment_history/Orders.csv` = header only): `empty`, distinct copy.
  - `buildOnlySupportedExport()` (omit Chat_history, Clans, Bans, Device_info): "none detected" state.
  - `buildMultiRowAccountInfoExport()`: rows `[decoy ID 999 with a different NAME, row with ID === root]` and a variant where no ID matches (expects row 1). Distinct nickname/region per row so the pick is observable.
  - `buildAccountInfoVariantExport()`: lowercase headers, padded headers (`' NAME '`), missing `REGION` column, extra fields beyond the header (put a canary in the overflow cell), duplicate `LOGIN` column.
  - `buildLowercaseUserInfoFolderExport()` (`user_info/` folder): asserts the strip and the section match are case-insensitive.
  - `buildLongTextExport()`: 70-character unbroken nickname and an unknown folder with a 60+ character name (overflow checks at 375/720).
  - Existing reusable ones: `buildRenamedRootExport` (unknown folder `Future_category_2026`), `buildRootlessExport` (`accountRoot === ''` edge), `buildMalformedRowsExport` (skip tag on Bans), `buildLargeExport` (2500 files/category), `buildScaleExport`.

**Leak test (Playwright, `tests/e2e/identity-privacy.spec.ts`).** Import `buildSampleExport()`, wait for `identity-nickname`, then assert **all** of the following on the same page:
```ts
const html = await page.evaluate(() => document.documentElement.outerHTML);   // includes <title>, every attribute, hidden nodes
expect(html).not.toContain('example.invalid');           // SAMPLE_LOGIN's domain
expect(html).not.toContain('1990-01-01');                // SAMPLE_BIRTH_DATE
expect(await page.title()).toBe('WG Data Export Viewer');
expect(await page.locator('body').innerText()).not.toContain('example.invalid');
expect(await page.locator('body').ariaSnapshot()).not.toContain('example.invalid');   // accessible names (ariaSnapshot exists in Playwright 1.63)
// nickname appears exactly once in the DOM (header text only; no title=/aria-label/nav)
expect((html.match(/Synthetic Player/g) ?? []).length).toBe(1);
// IndexedDB: raw IDB read from the page (same origin; no Dexie needed)
const dump = await page.evaluate(() => new Promise<string>((resolve, reject) => {
  const open = indexedDB.open('wg-export-viewer');
  open.onerror = () => reject(open.error);
  open.onsuccess = () => {
    const idb = open.result;
    const out: unknown[] = [];
    const tx = idb.transaction(['rows', 'meta'], 'readonly');
    for (const name of ['rows', 'meta']) {
      tx.objectStore(name).getAll().onsuccess = (e) => out.push((e.target as IDBRequest).result);
    }
    tx.oncomplete = () => { idb.close(); resolve(JSON.stringify(out)); };
  };
}));
expect(dump).not.toContain('example.invalid');
expect(dump).not.toContain('1990-01-01');
expect(dump).not.toMatch(/"(LOGIN|BIRTH_DATE|BIRTH_DATE_SRC)"/);
expect(dump).toContain('"IP"');   // control: IP column IS still stored (D-18 keeps IP/city/country)
```
Also collect `page.on('console')` messages across the whole import and assert none contains the email or the nickname (D-21 "logs"). Repeat the DOM/IDB assertions after `page.reload()` (return-visit path) and for `buildAccountInfoVariantExport()` and `buildLowercaseUserInfoFolderExport()` (the two shapes where a naive strip leaks). Note: the fixtures use `example.invalid` and a distinctive birth date, so a substring assertion cannot false-positive on `CREATED_AT` (`2020-01-01`).

### Q7. Validation Architecture: see the dedicated section below.

## Architecture Patterns

### System Architecture Diagram

```
                      DROP / CLICK zip                          RETURN VISIT (page load)
                            |                                            |
                  Dropzone (compact|full)                       IngestClient ctor spawns Worker
                            |                                            | 'ready' -> post check-cache
                 IngestClient.submitFiles                                |
   (precheck; replace-confirm if a result is displayed)                  |
                            |  postMessage(ingest | check-cache | clear-data)
 =========================== | =========== Worker boundary ==========================================
                            v                                            v
                 ingest.worker.ts                              handleCheckCache -> checkCache()
   hash -> checkCache() --same hash--> 'duplicate' {result+identity}     |
        | new hash                                                       v
   unzip -> classify -> per-category parse loop                    'cache-status' {ClassifyResult+identity | null}
        |   User_Info rows: sanitizeUserInfoRow()  (drop LOGIN/BIRTH_DATE/BIRTH_DATE_SRC/__parsed_extra)
        |   identity = extractIdentity(sanitised rows, accountRoot)
        v
   writeDataset(hash, root, categories, rows, identity)   [ONE Dexie tx: clear -> bulkPut chunks -> meta.put]
        |  ok -> 'done' {ClassifyResult+identity}        fail -> tx rolls back (old dataset intact) -> 'error'
 =========================== | ===========================================================================
                            v
              IngestClient  (result = last known dataset; state = current job)
                            |
              App.svelte  (derive: hasResult, notice, variant)
      +---------------------+-----------------------------------------------+
      |                     |                                               |
 Import bar/region     Identity header                          DashboardNav (sticky) <- scroll-spy (IntersectionObserver)
 (notice slot, slim|   (result.identity -> loaded |               ^ sectionStatus()/unsupportedBlockStatus()
  full, ConfirmPanel)   fallback | skeleton)                        |
                                                  DashboardSection x4 + Unsupported block (banners)
                                                       <- same pure functions, same ClassifyResult
```

### Recommended Project Structure
```
src/
├── App.svelte                          # composition, state -> props, focus management, window drag guard (keep)
├── app.css                             # :root --nav-offset, html scroll-behavior (no-preference), h1/h2/p roles
└── lib/
    ├── dashboard-status.ts             # SECTIONS, sectionStatus, sectionCounts, unsupported*  (pure)
    ├── scroll-spy.ts                   # pickActiveSection, isAtPageBottom  (pure)
    ├── ui-copy.ts                      # + new strings/formatters; retire formatSummary/formatAccountHeading
    ├── types/worker-messages.ts        # + AccountIdentity; ClassifyResult.identity?
    ├── worker-client.svelte.ts         # result persistence, guards, cache-check error -> idle
    ├── components/
    │   ├── ImportBar.svelte            # one <section data-testid="import-bar" data-variant>, notice slot, meta row, ConfirmPanel
    │   ├── IdentityHeader.svelte       # skeleton | fallback | loaded
    │   ├── DashboardNav.svelte         # sticky nav + observer $effect (root element IS the <nav>)
    │   ├── DashboardSection.svelte     # id, title, status, counts, content snippet; stable root <section>
    │   ├── UnsupportedBlock.svelte     # intro + banners (or greyed status)
    │   ├── ImportSummary.svelte        # "{files}, {rows}" + skip tag (shared by section, caption, banner)
    │   ├── Dropzone.svelte             # + compact variant; busy no longer swaps the prompt
    │   ├── ConfirmPanel.svelte         # + focus dismiss button on mount
    │   ├── FailureBanner.svelte        # reused
    │   ├── ResultsView.svelte          # DELETE (D-23)
    │   └── CategoryBadge.svelte        # DELETE (D-23)
    └── worker/
        ├── db.ts                       # version(2)+upgrade, DatasetMeta.identity, writeDataset(identity)
        ├── identity.ts                 # isUserInfoCategory, sanitizeUserInfoRow, extractIdentity  (pure)
        └── ingest.worker.ts            # sanitize + identity in the parse loop; resultFromMeta helper
```

### Pattern 1: Displayed dataset vs current job
`IngestClient.result` = last known dataset (never nulled by a job starting or failing); `state` = what the current job is doing. App derives everything from the pair.

### Pattern 2: One pure status function, three consumers
Nav muting + accessible-name suffix, `DashboardSection` status, and the unsupported block all call `dashboard-status.ts` with the same `ClassifyResult`. No component recomputes status.

### Pattern 3: Sanitise-then-extract in the worker
The only object that leaves the worker about the account is `AccountIdentity`, built from rows that have already been through `sanitizeUserInfoRow`.

### Pattern 4: Notice slot derived from state (only one notice at a time)
```svelte
<!-- App.svelte, script -->
<script lang="ts">
  const hasResult = $derived(ingestClient.result !== null);
  type Notice = 'processing' | 'error' | 'duplicate' | 'cleared' | null;
  const notice = $derived.by<Notice>(() => {
    switch (ingestClient.state) {
      case 'processing': return 'processing';
      case 'error': return ingestClient.errorMessage ? 'error' : null;
      case 'duplicate': return 'duplicate';
      case 'idle': return ingestClient.justCleared ? 'cleared' : null;
      default: return null;                 // checking-cache renders a different page body; done / confirm-pending: empty
    }
  });
</script>
```
`state === 'checking-cache'` renders **only** the h1 and the cache-check block (D-28); everything else lives in the `{:else}` branch so ids exist when the scroll-spy effect runs. The notice-slot `<div role="status" aria-live="polite" aria-atomic="true">` is always in the DOM; only its child is conditional. Drop `role="status"` from the cleared paragraph and the processing block (UI-SPEC: no nested live regions); keep `role="alert"` on `FailureBanner`.

### Pattern 5: Focus management (UI-SPEC requirement)
- `ConfirmPanel`: `import { onMount } from 'svelte'` + `bind:this={cancelBtn}`; `onMount(() => cancelBtn.focus())` (do not use the `autofocus` attribute: Svelte a11y lint warns).
- Dismiss: `oncancel={async () => { ingestClient.cancelPending(); await tick(); triggerEl?.focus(); }}`; record `triggerEl` from the click event's `currentTarget` for Start over / Clear, and use the Dropzone element for replace-on-drop.
- After a confirmed clear the trigger is gone: `Dropzone` exposes `export function focus()`, App calls it after `await tick()` when `justCleared` flips true. `Dropzone`'s label persists across full/slim because the import region is one element, so the call target exists.
- Test with `await expect(page.getByTestId('confirm-cancel')).toBeFocused()` and `toBeFocused()` on the trigger after dismiss.

### Anti-Patterns to Avoid
- **Deriving section order from `SUPPORTED`/`SAMPLE_BADGE_ORDER`** (wrong order; see Q4).
- **Recomputing status in components** (nav and sections can disagree).
- **Conditional root elements in `DashboardSection`** (breaks the observer targets).
- **Reading `activeId` inside the scroll-spy `$effect`** (turns a one-shot mount effect into a loop).
- **`$derived`/`$effect` inside `worker-client.svelte.ts`** (unit-test shim only covers `$state`).
- **Showing the nickname in `title`/`aria-label`/`aria-labelledby`** (D-21). The identity header uses a static `aria-label="Account identity"`.
- **Parsing `CREATED_AT` with `Date`** (D-15): take the text before the first space or `T`, treat an empty result as `Unknown`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| DB wipe of old caches | Manual "is old?" detection, delete-and-recreate, or a renamed DB | Dexie `version(n).upgrade(tx => clear)` | Atomic, runs once per device, never on fresh installs (probed) |
| Failed-replace safety | A backup/restore of the old dataset, or a post-failure cache re-check | The existing single IndexedDB transaction in `writeDataset` | Already atomic (probed); only the client display was wrong |
| Scroll-spy | A `scroll` listener that measures every section's `getBoundingClientRect()` each frame | `IntersectionObserver` (+ tiny scroll listener only for the bottom rule) | Avoids layout thrash; observer is off-main-thread computed |
| CSV header/BOM handling | Regex splitting of CSV | Existing `parseCsvFile` (PapaParse) | BOM, quoting, CRLF handled; only key normalisation is added |
| Confirm dialog | `window.confirm` | Existing `ConfirmPanel` | Phase 2 D-14 forbids native dialogs (e2e test asserts none fire) |
| Date-only display | `Date`/`Intl` conversion of `CREATED_AT` | `raw.trim().split(/[ T]/)[0]` in a `ui-copy` formatter | D-15: no timezone exists in the field; `Date` would shift days |
| Region names | A code->name table | Raw `REGION` value | D-13 |

**Key insight:** every hard part of this phase (atomicity, upgrade-once, parse robustness, scroll observation) already has a primitive the repo owns; the work is wiring plus the privacy edge cases around header/casing.

## Runtime State Inventory

This phase includes a schema migration (D-19) and retires components/test ids, so the five categories are answered explicitly.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | IndexedDB `wg-export-viewer` v1 on every device that imported under Phase 2: `rows` table (User_Info rows include `LOGIN`, `BIRTH_DATE`, `BIRTH_DATE_SRC`) and the `meta` record `active` (no `identity`). | **Data migration** via the Dexie v2 upgrader (clears both tables). Plus **code edit**: new imports strip the columns and write `identity`. Both are required; the upgrader alone does not stop new leaks and the strip alone does not remove old data. |
| Live service config | None. No backend, no external service (AGENTS.md privacy constraint). | None — verified by architecture (zero network). |
| OS-registered state | None. Static site; no scheduled tasks, service workers or registered processes. | None. |
| Secrets/env vars | None. No secrets in the repo or CI (`permissions: contents: read`, .github/workflows/ci.yml:17-18). | None. |
| Build artifacts | `dist/` is rebuilt by `vite build` in the Playwright `webServer` (playwright.config.ts:55) every run; `.claude/skills/run-data-export-viewer/driver.mjs` embeds retired test ids. | Update the driver script and `SKILL.md`; no stale-artifact cleanup needed. |

## Common Pitfalls

### Pitfall 1: Case-variant `user_info` folder leaks LOGIN
**What goes wrong:** the strip is keyed on the literal `User_Info` while `classifyFolder` accepts any casing; the folder's rows (with email) are stored and the section shows `no-export`.
**How to avoid:** `isUserInfoCategory(name)` lowercases; `sectionStatus` lowercases; both tested with `buildLowercaseUserInfoFolderExport`.
**Warning signs:** section status `no-export` while rows exist in IDB.

### Pitfall 2: PapaParse structure hides sensitive cells
**What goes wrong:** padded headers (`' LOGIN'`), duplicate headers (`LOGIN_1`), and extra cells (`__parsed_extra`) bypass a naive `delete row.LOGIN`.
**How to avoid:** normalised-key regex + drop `__parsed_extra` (Q3); leak spec runs the variant fixture. Residual risk: a renamed column (e.g. `EMAIL`) is undetectable (Open Question 3).

### Pitfall 3: The displayed dashboard vanishes on replace/failure
**What goes wrong:** `IngestClient` nulls `result` at three sites (Q2), contradicting D-27 and the state matrix while IDB still holds the data.
**How to avoid:** remove the three assignments; add unit tests; e2e: failed replace keeps the dashboard (force a failure with a truncated zip after confirm).

### Pitfall 4: Replace confirmation is skipped from `duplicate`/`error`
**What goes wrong:** guard is `state === 'done'`; with the slim bar always showing the dropzone this is reachable in two more states.
**How to avoid:** guard on `result !== null && state !== 'processing'`; ignore drops in `confirm-pending`. Rewrite the legacy test (e) in import-flow.spec.ts accordingly.

### Pitfall 5: Spinner forever after a failed first read
**What goes wrong:** `error` during `checking-cache` is dropped (Q2).
**How to avoid:** handle it -> `idle` + `console.error`; unit test with FakeWorker emitting `{ type: 'error', jobId: 1 }` while `checking-cache`.

### Pitfall 6: Empty account root renders an empty heading
**What goes wrong:** rootless exports give `accountRoot === ''` (classify.ts, `buildRootlessExport`), so the fallback title and "Account ID:" line are empty.
**How to avoid:** copy for the empty-root case, tested; add a fixture-driven e2e check.

### Pitfall 7: Scroll-spy assumptions
**What goes wrong:** using only the callback's entries; bottom override on a non-scrollable page; observing nodes that get re-created; asserting one-link-per-section when the page is too short to align middle sections.
**How to avoid:** Q5 items 3-5; pure `pickActiveSection` with tests; stable `<section>` roots; mirror-the-rule e2e assertion.

### Pitfall 8: Legacy e2e queries break silently or loudly
**What goes wrong:** `getByRole('heading', {level: 2})` now matches six headings in the skeleton (count assertions fail, `toHaveText` violates strict mode); test (e) relied on `start-over` not confirming; `results`/`account-heading`/`category-badge` are gone.
**How to avoid:** the table in Q6; grep for retired ids before finishing (`grep -rn "account-heading\|summary-line\|category-badge\|getByTestId('results')" tests .claude`).

### Pitfall 9: `aria-busy` moves off the spinner
**What goes wrong:** Dropzone used `aria-busy={showProcessing ? ...}` (Dropzone.svelte:98); once the spinner leaves the label, `showProcessing` is never true and the import-flow test (a) `ariaBusy === 'true'` fails.
**How to avoid:** `aria-busy={disabled ? 'true' : undefined}`; keep `data-testid="processing-status"`/`spinner` in the notice.

### Pitfall 10: Notice slot as a live region
**What goes wrong:** rendering the slot conditionally means the region is created with its content and is not announced; nested `role="status"` double-announces.
**How to avoid:** slot always in DOM; drop inner `role="status"` from the cleared and processing children.

### Pitfall 11: Sticky nav silently not sticking
**What goes wrong:** a wrapper div or an `overflow` on an ancestor. **How to avoid:** Q5 sticky list; Playwright check that after scrolling the nav's `boundingBox().y` is ~0.

### Pitfall 12: Future Dexie versions
**What goes wrong:** Phase 4+ declares `version(3)` and drops the `version(2).upgrade()` block; devices still at v1 skip the wipe. **How to avoid:** comment in `db.ts` (Q1).

### Pitfall 13: Missing global-CSS reset for new blocks
`p`/`ul`/`h2` default margins (app.css:24-43) break the 8px/24px rhythm; set `margin: 0` (and `padding: 0` on the banner/nav lists) in components.

## Code Examples

### Dexie v2 (see Q1), identity module (Q3), status module (Q4), scroll-spy (Q5), notice derivation (Pattern 4)

### Minimal `IngestClient` diff (Q2), shown as intent

```ts
// confirmPending(): kind === 'replace'   (was: this.result = null;)   -> remove line
// submitFiles():                                                        -> remove the this.result = null line
// #fail():                                                              -> remove the this.result = null line
// submitFiles() replace guard:
if (this.state === 'confirm-pending') { console.error('[ingest] confirm pending, submission ignored'); return false; }
if (this.result !== null) {              // was: this.state === 'done'
  const file = files[0]!;                // NOTE: existing code assumes a file exists; precheck first if you want zero-file drops to error
  this.#pendingReturnState = this.state;
  this.pendingAction = { kind: 'replace', file };
  this.state = 'confirm-pending';
  return false;
}
// #handle 'error': before the `state !== 'processing'` early return:
if (this.state === 'checking-cache' && msg.jobId === this.#jobId) {
  console.error('[ingest] cache check failed:', msg.detail);
  this.state = 'idle'; this.result = null; return;
}
```
Two caveats: (1) the current `submitFiles` runs `precheckFiles` *after* the `done` guard, so a wrong-extension drop on a displayed dataset currently opens the replace confirm; with the widened guard, run `precheckFiles` first so a bad file shows the failure notice rather than a replace prompt for something unusable. (2) `IngestClient` state assignments stay as-is otherwise; `MIN_PROCESSING_MS` settle logic is untouched.

### Created-date and account-id formatters (`ui-copy.ts`)
```ts
export function formatCreatedDate(raw: string | null): string {
  if (raw === null) return UNKNOWN_VALUE;
  const date = raw.trim().split(/[ T]/)[0] ?? '';   // D-15: text before the first space or T; no Date parsing
  return date === '' ? UNKNOWN_VALUE : date;
}
export function formatAccountId(root: string): string { return `Account ID: ${root}`; }
```
[ASSUMED: identifiers are proposals; strings come from UI-SPEC copy table.]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Dexie `< 3` required every historical `version()` to be declared | Dexie >= 3 (repo is 4.4.6): only versions with upgraders must remain | Dexie 3.0 | Declare only v2 now; keep it when adding v3 |
| Scroll listeners measuring `getBoundingClientRect` | `IntersectionObserver` with a rootMargin band | widely adopted | UI-SPEC's approach; still needs a tiny scroll listener for the bottom edge case |
| Component tests via jsdom | Pure-function unit tests + Playwright for DOM | this repo's vitest setup | No new dev dependency |

**Deprecated/outdated (in this repo):** `ResultsView`, `CategoryBadge`, `formatSummary`, `formatAccountHeading` (retired by D-23/UI-SPEC).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Firefox/Safari resolve `rootMargin` top/bottom percentages against height like Chromium (spec text says width) | Q5 | Scroll-spy band differs on those browsers; fix = compute px from `innerHeight` |
| A2 | Real exports keep the column names in PROJECT.md:60 and put identity in `User_Info/Account_Info.csv`; real `REGION`/`NAME` values are as expected | Q3 | Identity shows `Unknown`; strip may miss a renamed column |
| A3 | The email/birth date appear only in `User_Info` (D-18 scope); other categories (e.g. Customer_support_tickets, Payment_history) may contain the email | Q3, Security | Email still stored in IndexedDB (never rendered); user decision D-18 limits scope to User_Info |
| A4 | Dexie's default `versionchange` handling closes a stale old-version tab (not exercised) | Q1 | A second open tab errors until reloaded |
| A5 | Browsers abort (not partially commit) on quota errors during `writeDataset` (spec-conformant behaviour; probe used fake-indexeddb throws, not real quota exhaustion; Safari/Firefox untested) | Q2 | A quota failure could behave differently; still worst-case surfaces as the existing error path |
| A6 | Failed cache check should land on `idle` (skeleton + dropzone) with a console error, not a banner | Q2 | UX choice; planner may prefer a distinct notice |
| A7 | `identity: null` when no User_Info row was parsed (absent or zero rows) triggers the D-16 fallback header; object with null fields triggers `Unknown` slots | Q3 | Header copy differs for the empty-User_Info edge; UI-SPEC is silent |
| A8 | Rootless export (`accountRoot === ''`) needs new fallback copy | Q3 | Empty `<h2>` and "Account ID: " line if not handled |
| A9 | Identifier names (`identity.ts`, `dashboard-status.ts`, `scroll-spy.ts`, `AccountIdentity`, test ids `skip-tag`, `data-variant`) are proposals | throughout | None; discretion area |
| A10 | Dropping `__parsed_extra` from User_Info rows loses no data anyone needs | Q3 | Extra cells beyond the header would be lost (they are unlabeled anyway) |

## Open Questions

1. **Empty `User_Info` folder and the header.**
   - What we know: absent -> D-16 fallback; UI-SPEC does not say what a present-but-zero-row folder shows in the header.
   - Recommendation: treat zero rows like absent for the header (fallback title) and show the `empty` state in the section (A7). Planner to confirm.
2. **Should the `empty` section show the skipped-row tag when every row was skipped?** UI-SPEC's `empty` body is only the status line; a folder whose rows were all skipped would hide the diagnostic. Recommendation: keep the UI-SPEC contract, and add the skip tag under the status line only if `skippedRowCount > 0` (small deviation, flag for UI checker), or accept the loss.
3. **Renamed sensitive column** (e.g. `EMAIL` instead of `LOGIN`): the deny-list (D-18) cannot catch it. An allow-list for User_Info would, but contradicts Phase 2 D-01/D-02 "store everything else". Recommendation: keep D-18 as decided; note as accepted residual risk.
4. **`imported-at` and skip-tag hooks** are missing from the UI-SPEC hook list; recommended fixes in Q6 need UI-checker acknowledgement.
5. **Scroll-spy per-section e2e expectation** (Q5.5): confirm with the UI-SPEC owner that the "backstop test" wording ("moves to the matching link") is satisfied by the mirror-the-rule assertion at Phase 3 content heights.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | build, vitest, probes | ✓ | v26.10.0 (`node --version`); CI uses 24 | — |
| pnpm | scripts | ✓ | 12.6.0 (`pnpm --version`, matches `packageManager`) | — |
| Chromium for Playwright | e2e, scroll/leak specs | ✓ | chromium-1243 in `~/Library/Caches/ms-playwright`; launched successfully in probes | `pnpm exec playwright install chromium` |
| fake-indexeddb | Dexie upgrade unit test | ✓ | 6.2.5 (loaded by `tests/unit/setup.ts`) | — |
| jsdom / happy-dom | (not needed) | ✗ | — | Not used by design (pure functions + Playwright) |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none required.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 5 (`environment: 'node'`, `setupFiles: tests/unit/setup.ts`, `include: tests/unit/**/*.test.ts`) and Playwright 1.63.0 (Chromium, `testDir: tests/e2e`, builds and previews the production bundle on port 4173) |
| Config file | `vitest.config.ts`, `playwright.config.ts` |
| Quick run command | `pnpm exec vitest run tests/unit/<file>.test.ts` (and `pnpm exec playwright test tests/e2e/<file>.spec.ts` for one e2e spec) |
| Full suite command | `pnpm run lint && pnpm run check && pnpm run test:unit && pnpm run test:e2e` (scripts from package.json; CI runs the same sequence [VERIFIED: .github/workflows/ci.yml:70-98]) |

`package.json` scripts, verbatim [VERIFIED: package.json:6-15]: `"check": "svelte-check --tsconfig ./tsconfig.app.json && tsc -p tsconfig.node.json && svelte-check --tsconfig ./tsconfig.test.json"`, `"lint": "prettier --check . && eslint ."`, `"test:unit": "vitest run"`, `"test:e2e": "playwright test"`.

### Phase Requirements -> Test Map (success criteria verified automatically)

| Req / Success criterion | Behavior | Test Type | Automated Command | File Exists? |
|-------------------------|----------|-----------|-------------------|-------------|
| IDENTITY-01 / SC1a | Nickname, region, created date (date only) shown in header; `Unknown` for missing; D-17 row choice | unit (`identity.test.ts`, worker pipeline) + e2e | `pnpm exec vitest run tests/unit/identity.test.ts tests/unit/ingest-worker.test.ts` ; `pnpm exec playwright test tests/e2e/dashboard.spec.ts -g identity` | ❌ Wave 0 |
| IDENTITY-01 / SC1b | Email/birth date nowhere in DOM text, attributes, title, a11y tree, console, IndexedDB (fresh import AND reload; variant shapes) | e2e leak spec + unit worker assertions | `pnpm exec playwright test tests/e2e/identity-privacy.spec.ts` ; `pnpm exec vitest run tests/unit/ingest-worker.test.ts tests/unit/db.test.ts` | ❌ Wave 0 |
| D-19 | v1 cache wiped, fresh DB untouched | unit (fake-indexeddb) | `pnpm exec vitest run tests/unit/db.test.ts` | ✅ file exists, tests to add |
| DATA-03 / SC2 | Every non-supported folder (known-deferred and unknown) renders the identical banner (same text pattern, same computed styles, correct counts/skip tag); zero-unsupported state | e2e (+ unit for list) | `pnpm exec playwright test tests/e2e/dashboard.spec.ts -g banner` ; `pnpm exec vitest run tests/unit/dashboard-status.test.ts` | ❌ Wave 0 |
| DATA-04 / SC3 | Missing supported folder -> greyed `no-export` section and muted nav link whose accessible name carries the status; zero-row -> distinct `empty` wording | unit + e2e (`getByRole('link', { name: 'Payment_history, not in this export' })`) | as above | ❌ Wave 0 |
| SC4a | Processing/duplicate/error/cleared notices render in the single notice slot; dashboard stays visible during replace and after failed replace | unit (`ingest-client.test.ts`) + e2e | `pnpm exec vitest run tests/unit/ingest-client.test.ts` ; `pnpm exec playwright test tests/e2e/dashboard.spec.ts -g states` | ✅ / ❌ |
| SC4b | Return visit opens straight to the dashboard (slim bar, no file set) | e2e (reload) | `pnpm exec playwright test tests/e2e/persistent-dataset.spec.ts` | ✅ (rewrite) |
| D-05 / D-01 | Nav is sticky; scroll-spy sets `aria-current="location"` per the band rule; bottom -> last; non-scrollable -> first | unit (`scroll-spy.test.ts` pure) + e2e (`scroll-nav.spec.ts`, instant scroll or `reducedMotion: 'reduce'`) | `pnpm exec vitest run tests/unit/scroll-spy.test.ts` ; `pnpm exec playwright test tests/e2e/scroll-nav.spec.ts` | ❌ Wave 0 |
| UI-SPEC backstops | 375px: `document.documentElement.scrollWidth <= 375`, last nav link focusable/visible, long nickname/folder name wrap at 375 and 720 | e2e (`page.setViewportSize`) | `pnpm exec playwright test tests/e2e/scroll-nav.spec.ts -g 375` | ❌ Wave 0 |
| Focus management | Confirm focuses dismiss; dismiss returns to trigger; clear focuses full dropzone | e2e (`toBeFocused`) | `pnpm exec playwright test tests/e2e/dashboard.spec.ts -g focus` | ❌ Wave 0 |
| Standing guards | Zero-network + CSP still green; lint guard tests | e2e + unit | `pnpm exec playwright test tests/e2e/zero-network.spec.ts` ; `pnpm exec vitest run tests/unit/lint-guards.test.ts` | ✅ |
| Copy | New strings and formatters (`formatCreatedDate`, `formatAccountId`, suffixes, skeleton, unknown) | unit | `pnpm exec vitest run tests/unit/ui-copy.test.ts` | ✅ (edit) |

### Sampling Rate
- **Per task commit:** the single relevant `vitest run tests/unit/<file>` (seconds); `pnpm run check` for any `.svelte`/type change.
- **Per wave merge:** `pnpm run lint && pnpm run check && pnpm run test:unit` (note `lint-guards.test.ts` starts ESLint, slowest unit file).
- **Phase gate:** full suite including `pnpm run test:e2e` green before `/gsd-verify-work`. Local e2e uses CPU-count workers; CI uses 1 worker with a 10 min ceiling (playwright.config.ts:23, ci.yml:98) so keep new specs small (sample-size fixtures; avoid `buildScaleExport` except where already used).

### Wave 0 Gaps
- [ ] `tests/unit/dashboard-status.test.ts` (DATA-03, DATA-04)
- [ ] `tests/unit/identity.test.ts` (IDENTITY-01; strip variants: BOM, padded/duplicate/lowercase headers, `__parsed_extra`)
- [ ] `tests/unit/scroll-spy.test.ts`
- [ ] Extend `db.test.ts` (v2 upgrade + identity persistence), `ingest-worker.test.ts` (identity + no-leak), `ingest-client.test.ts` (Q2 fixes), `ui-copy.test.ts` (new copy, delete retired)
- [ ] `tests/fixtures/export-fixtures.ts` additions (Q6) and exported constants
- [ ] `tests/e2e/dashboard.spec.ts`, `identity-privacy.spec.ts`, `scroll-nav.spec.ts`; rewrite of the affected assertions in `import-flow`, `persistent-dataset`, `import-failure`, `zero-network`
- [ ] Update `.claude/skills/run-data-export-viewer/driver.mjs` and `SKILL.md`
- Framework install: none (all present)

## Security Domain

`security_enforcement` is enabled (`.planning/config.json`: `"security_enforcement": true`, `"security_asvs_level": 1`, `"security_block_on": "high"`).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No accounts, no auth (browser-only tool) |
| V3 Session Management | no | No sessions |
| V4 Access Control | no | Single-user local data |
| V5 Input Validation | yes | Zip entry names, folder names, nickname, region, account root are untrusted: render only via Svelte text interpolation; `svelte/no-at-html-tags` is an ESLint error; `overflow-wrap: anywhere`; header keys normalised before matching; regex used on keys has no nested quantifiers |
| V6 Cryptography | no | SHA-256 dedup hash only (existing `hash.ts`); nothing new |
| V8 Data Protection | yes | Drop `LOGIN`/`BIRTH_DATE`/`BIRTH_DATE_SRC` (+ `__parsed_extra`) before write (D-18); wipe v1 caches (D-19); static `document.title`, no nickname in attributes/logs (D-21); leak spec over DOM, a11y tree, console, IndexedDB |
| V14 Configuration | yes | CSP meta (`default-src 'self'; connect-src 'none'; ...` [VERIFIED: vite.config.ts:17-23]) unchanged; no inline styles (lint), no new network APIs (lint) |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| PII (email, birth date) persisted at rest in IndexedDB | Information disclosure | Worker-side column drop + Dexie v2 wipe; asserted by IndexedDB dump in the leak spec |
| Case/whitespace/duplicate-header bypass of the column drop | Information disclosure | Normalised-key matching, `__parsed_extra` removal, variant fixtures |
| PII leaked to `document.title`, tooltips, aria-labels, console | Information disclosure | Static title; identity header static `aria-label`; no logging of identity; test scans outerHTML + `ariaSnapshot` + console |
| XSS via crafted folder name / nickname / account root | Tampering | Text interpolation only; no `{@html}`; lint guard |
| Off-page drop navigates the browser to the file (exfil/replace) | Information disclosure | Existing window-level `dragover`/`drop` guard in App.svelte must be kept |
| Unconfirmed destructive replace via a widened drop path | Tampering | Q2 guard fix (`result !== null`) + tests |
| Mass-assignment/prototype quirk from a `__proto__` header | Tampering | Build new objects with `Object.entries` loops (no property-path assignment from untrusted keys); existing `fixed[k] = ...` pattern in csv-parse.ts already builds a fresh object |

## Sources

### Primary (HIGH confidence)
- Repo files read this session: `src/lib/worker/db.ts`, `ingest.worker.ts`, `csv-parse.ts`, `classify.ts`, `categories.ts`; `src/lib/worker-client.svelte.ts`, `types/worker-messages.ts`, `ui-copy.ts`, `ingest-client.ts`; `src/App.svelte`, `app.css`, components (`Dropzone`, `ConfirmPanel`, `FailureBanner`, `ResultsView`, `CategoryBadge`); `vite.config.ts`, `vitest.config.ts`, `playwright.config.ts`, `eslint.config.js`, `package.json`, `.github/workflows/ci.yml`; all `tests/**`; `03-CONTEXT.md`, `03-UI-SPEC.md`, `REQUIREMENTS.md`, `STATE.md`, `.planning/config.json`.
- Probes run this session against installed versions (scratchpad): `probe1.cjs` (Dexie upgrade semantics), `probe2.cjs` (transaction atomicity), `probe3.cjs` (PapaParse header/BOM/extra-field behaviour), `probe4.cjs` and `probe6.cjs` (IntersectionObserver band rule, percentage semantics, bottom override, non-scrollable page, in headless Chromium 1243), `probe5.mjs` (real `IngestClient` defects).
- https://dexie.org/docs/Tutorial/Design (versioning, upgraders, no upgrade on new install)
- https://svelte.dev/docs/svelte/$effect (timing, teardown, dependency tracking)
- https://developer.mozilla.org/en-US/docs/Web/API/IDBTransaction/abort (rollback semantics)
- https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API (delta delivery, initial callback, threshold)
- https://developer.mozilla.org/en-US/docs/Web/CSS/position and /overflow (sticky ancestors, overflow computed values)

### Secondary (MEDIUM confidence)
- https://www.w3.org/TR/intersection-observer/ (spec text on rootMargin percentages and edge-adjacent `isIntersecting`; contradicted by observed Chromium behaviour for percentage axis, hence A1)
- https://dexie.org/docs/Version/Version.upgrade() (page did not state new-install behaviour; that came from the Design page and the probe)

### Tertiary (LOW confidence)
- None used as a basis for a recommendation. The Graphify knowledge graph and the research-plan/cache seams were not used (no external library questions beyond Dexie/Svelte/MDN, which were fetched directly).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH, no changes; installed versions read from node_modules.
- Architecture: HIGH, every trace is from code read this session and corroborated by probes.
- Pitfalls: HIGH for items 1-6, 8-9 (reproduced or read), MEDIUM for cross-browser scroll-spy behaviour (Chromium only, A1) and real quota behaviour (A5).

**Research date:** 2026-09-29
**Valid until:** 2026-10-29 (stable stack; re-check only if Dexie, Svelte or Playwright majors change)
