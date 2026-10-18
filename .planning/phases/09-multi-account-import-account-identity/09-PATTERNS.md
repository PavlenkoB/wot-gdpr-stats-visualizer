# Phase 9: Multi-account Import & Account Identity - Pattern Map

**Mapped:** 2026-10-16
**Files analyzed:** 22 (12 modified source, 4 modified test specs, 6 new or extended test/fixture files)
**Analogs found:** 22 / 22 (3 new files have only a partial analog; see No Analog Found)

Sources: 09-CONTEXT.md (D-01..D-19 are locked), 09-RESEARCH.md (line references), 09-UI-SPEC.md. Line numbers below come from the research (`[GREP]`/`[VERIFIED]`) and from direct reads this session of `classify.ts` 496-548, 602-641, `identity.ts` 360-381 and `IdentityHeader.svelte` 1-116. Any line range not read this session is marked `(research ref)`: the planner must Read it before quoting it into an action.

Decisions to respect when using this map:
- **Open Question 1 (email in unknown categories) is resolved by CONTEXT D-18:** rows of unknown and known-deferred categories are parsed for counts only and are NOT written to IndexedDB. Do not widen the strip instead.
- **Open Question 2 (account record for logins):** use the research recommendation, no account record when N >= 2 (UI-SPEC Surface 4).
- **Open Question 3 (Overview and account row):** UI-SPEC Surface 3 is authoritative ("N accounts" headline, earliest-created summary).
- **Open Question 4 (years for v1.0 caches):** lazy rebuild behind a summary version constant, `importedAt`-guarded (research ref `db.ts` 671-681).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/lib/worker/classify.ts` (modify: N-root resolver, `analyzeExport`, `resolveCsvFileCategory`) | utility (pure classifier) | transform | itself: `resolveAccountRootAndCategories` (349-402), `analyzeExport` (496-548) | exact |
| `src/lib/worker/categories.ts` (read-only, reused) | config/utility | transform | itself: `classifyFolder` (22-61) | exact |
| `src/lib/worker/ingest.worker.ts` (modify: per-root parse loop, inflate filter, identity per root, summary, `resultFromMeta`, login rebuild) | service (worker) | batch / file-I/O | itself: parse loop 709-1025, `resultFromMeta` 696-707 | exact |
| `src/lib/worker/identity.ts` (modify: per-root pool) | utility | transform | itself: `extractIdentity` (368-381), `extractAccountRecord` (441-460) | exact |
| `src/lib/worker/db.ts` (modify: `account` on rows, `accounts[]` on meta, `writeDataset` trailing arg, per-account readers) | model / store | CRUD | itself: `writeDataset` (245-274), `readSessionRowData` (335-375), `readLoginRowData` (458-530) | exact |
| `src/lib/features/playtime/playtime-aggregate.ts` (read-only, reused) | utility | transform | itself: `sessionFileGame` (`sessionFileNameGame`), `parseSessionTimestamp` (150-180) | exact |
| `src/lib/worker/data-queries.ts` (read-only, reused) | utility | request-response | itself: `isPresent` (125-136) | exact |
| `src/lib/worker/worker-messages` types: `src/lib/core/types/worker-messages.ts` (modify: `AccountIdentity`, account summary on `ClassifyResult`) | model (types) | transform | itself: `AccountIdentity`, `ClassifyResult` | exact |
| `src/lib/ui-copy.ts` (modify: new constants and formatters) | config | transform | itself: `GAME_NAMES` (2741-2746), `formatAccountId`, `IDENTITY_CAPTION` | exact |
| `src/lib/shell/IdentityHeader.svelte` (modify: multi variant) | component | request-response | itself (single variant, lines 1-116 read) | exact |
| `src/lib/shell/overview-model.ts` (modify: N>1 card) | utility (view model) | transform | itself: lines 98-116 (research ref) | exact |
| `src/lib/shell/selection-state.ts` (modify: N>1 row headline) | utility (view model) | transform | itself: lines 180-185 (research ref) | exact |
| `src/lib/shell/DashboardSection.svelte` (modify: optional caption) | component | request-response | itself: provenance block 95-107 (research ref) | exact |
| `src/lib/shell/Dashboard.svelte` (modify: `sectionProps` account count) | component | request-response | itself: `sectionProps` 275-316 (research ref) | exact |
| `src/lib/components/**` keyed each: `VehicleTable.svelte` (line 327), `BattleTypeSummary.svelte` (line 162) (modify: key by index) | component | transform | itself (keyed each, one-line change) | exact |
| `tests/fixtures/multi-account-fixtures.ts` (NEW) | test fixture | batch | `tests/fixtures/export-fixtures.ts` `buildMultiRootZip` (510 research ref), `pinned-zip.ts` `zipSync` (50) | role-match |
| `tests/unit/import/classify.test.ts` (modify: flip rows 1, add cases) | test | transform | itself (inventory in research, lines 273-800) | exact |
| `tests/unit/import/ingest-worker.test.ts` (modify: per-root identity, no-leak, rebuild equality) | test | batch | itself (lines 451-530, 591-810, 1004-2120 research ref) | exact |
| `tests/unit/import/db.test.ts` (modify: `account`/`accounts` round-trip, keep `verno` 2) | test | CRUD | itself (lines 268-330, 839, 859 research ref) | exact |
| `tests/unit/import/replay-reclassify.test.ts` (modify: two-root duplicate) | test | event-driven | itself (275-325 research ref) | exact |
| `tests/unit/import/data-query-worker.test.ts` (modify: multi-account snapshot per merging channel) | test | request-response | itself (research ref) | exact |
| `tests/unit/import/multi-account-keys.test.ts` (NEW, keyed-each regression) | test | transform | `tests/unit/import/classify.test.ts` (plain unit style) | role-match |
| `tests/unit/ui-copy.test.ts` (modify: new formatters) | test | transform | itself (research ref) | exact |
| `tests/e2e/import/import-failure.spec.ts` (modify: flip (d), add stray-folder zip) | test (e2e) | request-response | itself (158-186 research ref) | exact |
| `tests/e2e/import/import-flow.spec.ts` (modify: two-root summary) | test (e2e) | request-response | itself (research ref) | exact |
| `tests/e2e/import/persistent-dataset.spec.ts` (modify: two- and three-root reload, replace, clear) | test (e2e) | CRUD | itself (research ref) | exact |
| `tests/e2e/shell/identity-privacy.spec.ts` (modify: multi-account twin) | test (e2e) | request-response | itself (284-312, 359-360 research ref) | exact |
| `tests/e2e/guards/zero-network.spec.ts` (modify: one multi-account flow) | test (e2e) | request-response | itself (research ref) | exact |

Note on the new e2e and unit file names: the research and CONTEXT name the existing specs to twin; only `multi-account-fixtures.ts` and `multi-account-keys.test.ts` are new files. The planner keeps listed e2e additions to about five (see Shared Patterns: E2E budget).

---

## Pattern Assignments

### `src/lib/worker/classify.ts` (utility, transform) - N-root resolver

**Analog:** itself. Keep every existing v1.0 failure reason and the fallback chain; add the N-root step in front.

**Current single-root entry point** (`analyzeExport`, lines 496-548, read this session):
```typescript
export function analyzeExport(paths: string[]): AnalyzeOutcome {
  const prepared = prepare(paths);
  if (prepared.length === 0) return { ok: false, reason: 'empty-archive' };

  const resolved = resolveAccountRootAndCategories(prepared);
  // 01-11: an ambiguous root is named directly, before the legacy chain
  // below, so the reason is truthful for every shape that can raise it
  if (resolved !== null && resolved.kind === 'ambiguous') {
    return { ok: false, reason: 'ambiguous-root' };
  }
  if (resolved !== null) {
    if (!prepared.some((p) => p.toLowerCase().endsWith('.csv'))) {
      return { ok: false, reason: 'no-csv-data' };
    }
    const { root, counts } = resolved;
    // ... builds entries via classifyFolder, sortCategoryEntries ...
    return { ok: true, result: { accountRoot: root, categories: sortCategoryEntries(entries), counts: statusCounts } };
  }
  // Pre-existing reason-classification fallback (preserves every pinned reason)
  const root = detectRoot(prepared);
  if (root === null) return { ok: false, reason: 'no-single-root' };
  const counts = categoryFoldersUnder(root, prepared);
  if (counts.size === 0) return { ok: false, reason: 'no-category-folders' };
  return { ok: false, reason: 'no-recognized-category' };
}
```

**Plan guidance:**
- Insert the N-root resolver between `prepare()` and `resolveAccountRootAndCategories`. Its rules are research "Architecture Patterns" steps 1-8 and CONTEXT D-01..D-05. Keep the zero-root path falling through to the unchanged v1.0 chain (cases 2-5, 8, 14, 17 of the inventory).
- `ok` result becomes a list of roots. `accountRoot` stays as the first root in D-16 order (or `''`), so v1.0 consumers still compile. Add `accounts` beside it.
- Do NOT reuse `unknownFolderHoldsRecognized` (lines 232-252) as the multi-root rule (research Pitfall 4).
- Loose top-level files are ignored inside the resolver, not in `prepare()` (Pitfall 5, D-05).

**Per-file root attribution (`resolveCsvFileCategory`, lines 602-641, read this session):**
```typescript
export function resolveCsvFileCategory(
  rawName: string,
  root: string,
  recognizedCategories: ReadonlySet<string>,
): { category: string; sourceFile: string } | null {
  const normalized = normalizeEntryPath(rawName);
  if (isOsMetadataEntry(normalized)) return null;
  if (normalized.endsWith('/')) return null; // directory entry, not a CSV file
  let rest: string;
  if (root === '') {
    // locate the first segment that IS a recognized category; everything above is transparent prefix
    const segments = normalized.split('/');
    const lastSegment = segments.length - 1;
    let start = -1;
    for (let i = 0; i < lastSegment; i++) {
      if (recognizedCategories.has(segments[i]!)) { start = i; break; }
    }
    if (start === -1) return null;
    // ...
  }
  // ...
}
```

**Plan guidance (D-06):** change the signature to take the root set and return `{ root, category, sourceFile }`. Owner = first segment (after dropping the transparent wrapper) that is a root. The `lastIndexOf('/' + root + '/')` fallback (pinned by classify.test.ts 397-416) may run only when the root set has exactly one member. The inflate filter (`ingest.worker.ts` 745-749) and the parse loop must call this same function with the same set.

**Error handling / reason names:** keep `ambiguous-root`, `no-single-root`, `no-category-folders`, `no-recognized-category`, `no-csv-data`, `empty-archive` verbatim. The user sees one generic banner (CONTEXT, classifier inventory).

**Testing:** `tests/unit/import/classify.test.ts` is the analog. Flip inventory row 1 (two roots, lines 273-275, 543-546, 686-689, 849-852). Rewrite the doc comment on `buildMultiRootZip` that says "Triggers no-single-root".

---

### `src/lib/worker/identity.ts` (utility, transform) - per-root identity pool

**Analog:** itself, `extractIdentity` (lines 368-381, read this session).

```typescript
export function extractIdentity(
  rows: readonly UserInfoRow[],
  accountRoot: string,
): AccountIdentity | null {
  if (rows.length === 0) return null;
  const match =
    accountRoot === '' ? undefined : rows.find((row) => pick(row, 'ID') === accountRoot);
  const row = match ?? rows[0]!;   // <- cross-root borrow (Pitfall 1)
  return { nickname: pick(row, 'NAME'), region: pick(row, 'REGION'), createdAt: pick(row, 'CREATED_AT') };
}
```

**Plan guidance:** call `extractIdentity(poolForRoot, root)` once per root, with the pool filtered to that root. Empty per-root pool returns `null` (the ID-only row, UI-SPEC "partial" state). The `rows[0]` fallback must never see another root's rows. The `pick`/strip logic stays here (research "Don't Hand-Roll"). `extractAccountRecord` (441-460) follows the same per-root rule, and per Open Question 2 it is not rendered when N >= 2.

---

### `src/lib/worker/ingest.worker.ts` (service, batch) - parse loop, identity, summary, rebuild

**Analog:** itself. Research line refs: inflate filter 745-749; parse loop 793-945; identity 949-952; account record 960-963; write 989-1004; replay `resultFromMeta` 696-707; login rebuild `readLoginsSnapshot` 455-486; sanitisation choke point 908-914 (root-agnostic, do not change); `rowIndex` 918.

**Plan guidance:**
- Keep the per-category loop, so `ParsingProgress` and the regex progress text (`persistent-dataset.spec.ts` 444) stay unchanged.
- Stamp `account: root` on every row pushed into `allRows`.
- Partition `accountInfoRows` / `otherUserInfoRows` into a `Map<root, {...}>`. Build identity and account record per root.
- One `SessionSource` / `LoginSource` per (root, file). Playtime and logins aggregate over all sources together (D-09).
- Unknown and known-deferred categories: parse for counts only, do not push to `allRows` (D-18). This is a skip in the parse loop, reversible.
- Per-account summary (games from `sessionFileGame` over files with at least one row, first and last year from `parseSessionTimestamp` + `civilFromDays`, ordering key per D-16) is computed here once and stored on meta.
- `presenceFiles` per root; cap `MAX_PRESENCE_FILES` (db.ts 161) applied per account.
- Root-count cap: research recommends a small bound (about a few dozen, A8). Add one unit test that exceeding it fails closed.
- Error logging: log the error object only, never a cell (ingest.worker.ts 1017-1018; T-04-03 discipline).

**Replay normaliser:** one function turns any stored meta into an `accounts` list. Legacy meta (no `accounts` field) becomes a one-entry list from `accountRoot`, `identity`, `files`. `resultFromMeta` (696-707) and every reader use it.

**Login rebuild:** pool scoped per root, grouping gains the account level (Pitfall 3). Use the `importedAt`-guarded write pattern from `writeLoginsIfCurrent` (db.ts 671-681) for the years rebuild (Open Question 4).

---

### `src/lib/worker/db.ts` (model/store, CRUD) - stored shape, no Dexie bump

**Analog:** itself. The precedent for non-indexed meta fields is `playtime` (Phase 4), `files` (05-07), `logins` (06-01).

**Schema to keep (research ref 199-207):** `version(2)` upgrader unchanged; rows store stays `'++id, category, sourceFile'`. No `stores()` change, no new index (Pitfall 8, D-07).

**Write path to extend (`writeDataset`, 245-274, research ref):** keep one transaction (clear, chunked `bulkPut`, `meta.put`). Add a trailing optional argument `accounts: AccountMeta[] | null = null`, the same convention the existing optional arguments use, so 4- and 5-argument callers still compile.

**Readers (research table "Reader scoping"):**
- `readSessionRowData` (335-375): group by (account, category, file); legacy rows use `account ?? legacyRoot`.
- `readLoginRowData` (458-530): account level in the grouping; User_Info pool filtered by `row.account`.
- `readRowsByFile` (586-622): unchanged (merged by design); add a multi-account snapshot test.
- `clearData` (701-706, research ref): already empties every row, so ACCOUNT-08 needs only a test.

**Testing:** `tests/unit/import/db.test.ts` keeps `verno` at 2 (lines 839, 859). Add the `account` / `accounts` round-trip. `replay-reclassify.test.ts` 326 must keep passing.

---

### `src/lib/core/types/worker-messages.ts` (model, types)

**Analog:** itself. Add `accounts` to `ClassifyResult` (a list of `AccountSummary` with root, identity, games, firstYear, lastYear, ordering key, and no email or birth date). `AccountIdentity` stays `{ nickname, region, createdAt }`, which is already PII-free. The main thread receives only these derived objects (Architecture: "Worker-only Dexie access").

---

### `src/lib/ui-copy.ts` (config) - new strings

**Analog:** itself, `IDENTITY_CAPTION`, `formatAccountId` ("Account ID: {root}"), `UNKNOWN_VALUE`, and `GAME_NAMES` (lines 2741-2746, research ref).

**Plan guidance (UI-SPEC Copywriting Contract):** add `formatAccountCount(n)`, `IDENTITY_MULTI_LIST_LABEL`, `IDENTITY_GAMES_LABEL` ("Games"), `IDENTITY_ACTIVITY_LABEL` ("Activity"), `IDENTITY_NO_ACTIVITY`, `formatActivityYears(first, last)` (en dash, one year shown alone), `formatCombinedCaption(n)`, `ACCOUNT_ROW_MULTI_SUMMARY`, `formatEarliestCreated(date | null)`, `formatGameLongName(token)`. Long names are a separate table from `GAME_NAMES` (short labels stay for existing panes). Fixed game order WOT, WOTB, WOWS, WOTC, HEAT, WOWP, then unknown tokens code-unit ascending. Add unit tests in `tests/unit/ui-copy.test.ts`.

---

### `src/lib/shell/IdentityHeader.svelte` (component, request-response) - multi variant

**Analog:** itself. Read this session (lines 1-116).

**Pattern to keep (single variant, unchanged DOM):**
```svelte
<section aria-label={IDENTITY_ARIA_LABEL} data-testid="identity-header" data-variant={variant}>
  {#if variant === 'skeleton'}
    <h2 class="skeleton-title" data-testid="identity-title">{IDENTITY_SKELETON_TITLE}</h2>
  {:else if variant === 'fallback'}
    <h2 class="fallback-title" data-testid="identity-title">
      {formatIdentityFallbackTitle(result?.accountRoot ?? '')}
    </h2>
  {:else}
    <h2 class="nickname" data-testid="identity-nickname">
      {valueOrUnknown(identity?.nickname ?? null)}
    </h2>
    <p class="caption">{IDENTITY_CAPTION}</p>
    <dl class="identity-details">
      <dt>{IDENTITY_REGION_LABEL}</dt>
      <dd data-testid="identity-region">{valueOrUnknown(identity?.region ?? null)}</dd>
      <dt>{IDENTITY_CREATED_LABEL}</dt>
      <dd data-testid="identity-created">{formatCreatedDate(identity?.createdAt ?? null)}</dd>
    </dl>
    {#if showAccountId}
      <p class="account-id" data-testid="identity-account-id">{formatAccountId(result?.accountRoot ?? '')}</p>
    {/if}
  {/if}
</section>
```

**Plan guidance (UI-SPEC Surface 1):**
- Add `data-variant="multi"` when accounts >= 2. Render `h2.multi-title` ("{N} accounts", `identity-multi-title`), the existing `IDENTITY_CAPTION`, then `ol role="list"` (`identity-multi-list`), one `li` per account (`identity-multi-row`), each with `h3` (`identity-multi-name`), an ID `p` (`identity-multi-id`, omitted on the ID-only row with `data-user-info="absent"`), and a `dl` with Games and Activity (`identity-multi-games`, `identity-multi-years`).
- Escape rule: Svelte text interpolation only. No `title`, `aria-label`, or tooltip carrying the nickname (v1.0 D-21, restated per row, UI-SPEC Accessibility).
- The single-account branch and its test ids stay byte-identical (Pitfall 6). Existing `identity-privacy.spec.ts` assertions must pass without edits.
- The phone rule goes only in the existing `@media (max-width: 480px)` block in `src/app.css` (`.shell [data-testid='identity-header'] .multi-title { font-size: 18px; }`). No component media query (guard `phase8-ui-review-guards.test.ts`).

---

### `src/lib/shell/overview-model.ts` and `selection-state.ts` (utility, view model)

**Analog:** itself. Overview reads `result?.identity?.createdAt` (98-116); the account row headline reads `result?.identity?.region` (180-185). Both are research refs.

**Plan guidance (UI-SPEC Surface 3):** when accounts >= 2, headline is `formatAccountCount(N)`, summary is `formatEarliestCreated(minCreatedAt)` (minimum over parseable dates, null when none parse), and the account-row summary is `ACCOUNT_ROW_MULTI_SUMMARY`. Single-account output is unchanged. The nickname is never read into these objects.

---

### `src/lib/shell/DashboardSection.svelte` and `Dashboard.svelte` (component) - caption

**Analog:** the provenance block in `DashboardSection.svelte` (95-107, research ref) that already holds the status line and `ImportSummary`.

**Plan guidance (UI-SPEC Surface 2, D-11):** add an optional `accountCount` to `sectionProps` in `Dashboard.svelte` (275-316). In `DashboardSection`, render `<p class="..." data-testid="combined-caption">{formatCombinedCaption(n)}</p>` as the first line of the provenance block only when `accountCount >= 2`. No element at all for N = 1. Apply to Playtime, Login history, Vehicles, Finance, Payments, Device info (Open Question 8: Payments included). Not on Overview, Account, or Not-yet-supported.

---

### Keyed each sites (component) - `VehicleTable.svelte` line 327, `BattleTypeSummary.svelte` line 162

**Analog:** itself. These are one-line changes (research Pitfall 2; the planner should write the failing test first):

```svelte
<!-- before (VehicleTable.svelte 327, research ref) -->
{#each drawn as { row, index } (row.id)}
<!-- after -->
{#each drawn as { row, index } (index)}
```
```svelte
<!-- before (BattleTypeSummary.svelte 162) -->
{#each summary as row (row.code)}
<!-- after -->
{#each summary as row, index (index)}
```

Do not deduplicate `buildSummary` (`vehicle-aggregate.ts` 760-762). Summing is Phase 10's. `PlayerStats.svelte` 631 is safe (codes are unique via a Set, 723-735). Not traced: `SpendSummary.svelte` `(figure.hook)` and the `LoginTable`/`CountryList` keys. Confirm them before the caption work (research open item).

---

### `tests/fixtures/multi-account-fixtures.ts` (test fixture, NEW)

**Analog:** `tests/fixtures/export-fixtures.ts`, builder `buildMultiRootZip` (around line 510, research ref) and `tests/fixtures/pinned-zip.ts` `zipSync` (line 50, research ref). Plan to read those ranges before writing. Shape to copy: a builder takes a list of entry paths and content, returns a `Uint8Array` from `zipSync`.

**Plan guidance:** export one-, two- and three-root builders; a stray-folder builder (D-02, `123/User_Info/...` + `Misc/x.csv`); a top-level-category-beside-roots builder (D-04); a `personal_data_export`-wrapped two-root builder (D-03); a real-shape builder with loose `Readme_en.pdf` and `Readme_ru.pdf` (D-05); a root-without-User_Info builder; and a real-shape copy of the three-account layout. **Every root gets its own canary email, birth date, and overflow cell** (research Pitfall 7). Do not reuse `SAMPLE_LOGIN` (export-fixtures.ts 149) or `SAMPLE_BIRTH_DATE` across roots. All values synthetic; the real `2026-10-14.zip` is never committed.

---

### Unit tests (`classify.test.ts`, `ingest-worker.test.ts`, `db.test.ts`, `replay-reclassify.test.ts`, `data-query-worker.test.ts`)

**Analog:** each file, same style. Use the inventory in 09-RESEARCH.md (rows 1-20) for flips and new cases. Ingest tests run against fake IndexedDB, so the bulk of the multi-account matrix lives here (CONTEXT, research "Phase 9 e2e budget").

Required additions: per-root identity (root without User_Info gets ID-only identity and never another root's nickname); per-root no-leak with per-root canaries; N-root replay; multi-account rebuild equality (research Pitfall 3, `ingest-worker.test.ts` around 2012-2030 as the single-root analog for "deleted aggregate is rebuilt identically"); duplicate-zip hash dedupe; D-18 no unknown-category rows in IndexedDB.

---

### `tests/unit/import/multi-account-keys.test.ts` (test, NEW)

**Analog:** `tests/unit/import/classify.test.ts` (plain Vitest style). Assert the key values directly for the keyed-each regression: `VehicleTable` and `BattleTypeSummary` produce unique index keys on a two-account snapshot (research Wave 0 gap; Assumption A1, so assert the values, not only the render).

---

### E2E specs (modify, do not add many)

**Analogs:** the existing specs themselves.
- `tests/e2e/import/import-failure.spec.ts` (d), lines 158-186 (research ref): flip the two-root case to import; put the stray-folder zip in its place so SC4 stays covered.
- `tests/e2e/import/import-flow.spec.ts` (a): one two-root summary test.
- `tests/e2e/import/persistent-dataset.spec.ts` (a), (d), (e), (f): one two-root and one three-root flow covering reload, replace, clear. The progress regex `^Parsing \S+ \(\d+\/\d+\)\.\.\.$` (line 444) must stay.
- `tests/e2e/shell/identity-privacy.spec.ts` (a), (b), (c): one multi-account twin. Use the per-row test ids; do not change the single-account `identity-nickname` assertions.
- `tests/e2e/guards/zero-network.spec.ts`: add one multi-account import flow to the request assertion.

Budget: `ci-budget.test.ts` (355-372, research ref) pins the listed count at 258 and the three limits together. Phase 8 measured 252. Keep new listed e2e tests to about five, or raise G, W and J together by the guard's own rule (G + 2 min, W + 8 min).

---

## Shared Patterns

### Fail-closed classification
**Source:** `src/lib/worker/classify.ts` `analyzeExport` (496-548) and the reason union (31-39).
**Apply to:** the N-root resolver and every new failure rule (D-02, D-04, duplicate root names).
Any unrecognised shape throws into the single catch and shows the one generic failure banner. Keep every pinned reason name.

### PII strip (single choke point, root-agnostic)
**Source:** `src/lib/worker/ingest.worker.ts` sanitisation choke point (908-914) and `identity.ts` `pick` / deny-list `LOGIN`, `BIRTH_DATE`, `BIRTH_DATE_SRC` (101, research ref).
**Apply to:** every `User_Info` family file under every root (D-19). Do not write a second per-root strip (research "Don't Hand-Roll"). Unknown and known-deferred categories are not stored at all (D-18).

### Non-indexed meta fields, no Dexie bump
**Source:** `src/lib/worker/db.ts` `version(2)` (199-207, research ref); precedents `playtime`, `files`, `logins`.
**Apply to:** `account` on rows, `accounts[]` on meta, the per-account summary. `db.test.ts` `verno` stays 2.

### Lazy rebuild guarded by `importedAt`
**Source:** `db.ts` `writeLoginsIfCurrent` (671-681, research ref).
**Apply to:** the years rebuild for v1.0 caches (Open Question 4).

### Keyed each only with unique keys
**Source:** UI-SPEC Checks; research Pitfall 2.
**Apply to:** `VehicleTable.svelte`, `BattleTypeSummary.svelte`, and any new list. Use index keys where values repeat across accounts.

### Identifier and text safety in the UI
**Source:** `IdentityHeader.svelte` 25-29 (escaping rule, text interpolation only).
**Apply to:** every new row, caption, and `ui-copy` formatter. No `{@html}`, no `title`, no `aria-label` with a nickname.

### Zero-network guarantee
**Source:** `tests/e2e/guards/zero-network.spec.ts`; CSP `connect-src 'self'` unchanged.
**Apply to:** the multi-account import flow. No new network call, no config change.

### Single-account parity
**Source:** UI-SPEC Existing Baseline; CONTEXT D-11 and D-13.
**Apply to:** every change. One account must render, cache, and behave exactly as v1.0, with no caption and no new test ids on the single-account DOM.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| Root-count cap (inside `classify.ts` or a constant beside it) | utility | transform | No existing bound on root count; research A8 and Security Domain. Planner picks a small value and tests it. |
| Per-account summary and ordering key (D-14..D-16) | utility | transform | No existing per-account aggregate in the codebase. Build from `sessionFileGame`, `parseSessionTimestamp`, `civilFromDays`; ordering can follow `sortCategoryEntries` for comparator style. |
| Multi-account identity list (`identity-multi-*` markup) | component | request-response | No existing stacked-list identity in the codebase. The single-account header is the style analog only. |

---

## Metadata

**Analog search scope:** `src/lib/worker/`, `src/lib/shell/`, `src/lib/ui-copy.ts`, `src/lib/features/playtime/`, `tests/fixtures/`, `tests/unit/import/`, `tests/e2e/`.
**Files read this session:** `09-CONTEXT.md`, `09-RESEARCH.md` (full), `09-UI-SPEC.md`, `classify.ts` (496-560, 602-641), `identity.ts` (360-385), `IdentityHeader.svelte` (1-120).
**Files cited from research line references, not re-read:** `db.ts`, `ingest.worker.ts`, `data-queries.ts`, `ui-copy.ts`, `overview-model.ts`, `selection-state.ts`, `DashboardSection.svelte`, `Dashboard.svelte`, `VehicleTable.svelte`, `BattleTypeSummary.svelte`, all test files and fixtures. The planner must Read each range before quoting it into a plan action.
**Tracked-source gate:** `git ls-files` confirmed tracked for `classify.ts`, `ingest.worker.ts`, `db.ts`, `identity.ts`, `IdentityHeader.svelte`, `overview-model.ts`, `selection-state.ts`, `DashboardSection.svelte`, `ui-copy.ts`, `data-queries.ts`, `export-fixtures.ts`, `sample-account.ts`, `pinned-zip.ts`, `classify.test.ts`, and the e2e specs named above. No gitignored mirror paths are used.
**Pattern extraction date:** 2026-10-16
