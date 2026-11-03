# Phase 9: Multi-account Import & Account Identity - Context

**Gathered:** 2026-10-16
**Status:** Ready for planning

<domain>
## Phase Boundary

A user can drop a real export that holds several account-ID folders and see it imported, cached and identified account by account, instead of the generic failure banner. Requirements: ACCOUNT-01, ACCOUNT-02, ACCOUNT-03, ACCOUNT-05, ACCOUNT-08.

In scope: classifying N account roots fail-closed, parsing each root on its own, storing every row with its account, one cached dataset with the v1.0 replace/dedupe/clear lifecycle, the identity header listing every account, fixtures with 1, 2 and 3 roots.

Out of scope (Phase 10): merged-dashboard correctness, the game filter, overlap/double-count checks, a source-account column on rows, finance totals per currency across accounts. Phase 9 only guarantees nothing breaks and every row is attributable.

**Real sample inspected (the user's own `2026-10-14.zip`, 117 entries):** three account folders directly at the zip top level with NO `personal_data_export/` wrapper, plus loose `Readme_en.pdf` and `Readme_ru.pdf` beside them. Today `analyzeExport` rejects it as `no-single-root`. Shapes: an EU account with every category (incl. HEAT, WOTB, WOT, Bans, Subscriptions, Personal_Coupons, a 3.6 MB `Virtual_Currencies_Operations.csv`); an old RU account with NO `User_Info` and NO `Financial_Data` (WOT, WOTB, WOTC, WOWS sessions; WOWP and WOWS statistics); an NA Blitz account (WOTB data, a one-row `WOT_Game_Sessions.csv`).

</domain>

<decisions>
## Implementation Decisions

### Account-root detection (classify.ts)
- **D-01:** A top-level folder is an account root when it directly holds at least one recognised category. The name is NOT checked (no digits-only rule). `accountRoot` generalises to a list of roots. — **Reversibility:** costly — **Reversibility rationale:** the root rule is the fail-closed gate that keeps a `User_Info` folder under an unknown parent from skipping the LOGIN/BIRTH_DATE strip; every classifier test and fixture encodes it.
- **D-02:** A stray unknown FOLDER beside account roots (`123/...`, `456/...`, `Misc/x.csv`) fails the whole import with the one generic failure banner, as v1.0 did for one root. Roadmap SC4 stands unchanged.
- **D-03:** Multiple roots under Wargaming's own `personal_data_export/` wrapper are accepted; the wrapper stays transparent. The existing allow-list rule is unchanged: any other wrapper holding recognised categories stays rejected (`ambiguous-root`).
- **D-04:** A recognised category at the top level beside account roots (`Activity_history/x.csv` + `123/User_Info/...`) is rejected with the generic banner. Rootless categories cannot be attributed to an account and are exactly the shape that could dodge the strip.
- **D-05:** Loose FILES at the zip top level (the real `Readme_en.pdf`, `Readme_ru.pdf`) are ignored entirely: never read, never counted toward the stray-folder rule, never stored. Only folders count. This is required for the real sample to import, and it is a change from today where a lone top-level file still counted toward `detectRoot`'s single-segment test. — **Reversibility:** reversible — **Reversibility rationale:** a classifier rule with unit tests; tightening to a `Readme_*.pdf` allow-list later is a one-line change.
- **D-06:** `resolveCsvFileCategory` must agree with `analyzeExport` for N roots (the existing invariant: the inflate filter and the per-category row counts must never diverge). It returns the owning account root with the category and source file.

### Stored shape and provenance
- **D-07:** Every stored `DatasetRow` carries a non-indexed `account` field (the account root). NO Dexie version bump: v1.0 caches survive, and readers keep querying by the existing `category` index and filter in memory. A row with no `account` reads as the dataset's legacy single account. This follows the 06-01 precedent and the pinned `version(2)`-only test in `tests/unit/import/db.test.ts`. — **Reversibility:** costly — **Reversibility rationale:** the field is read by every reader and by Phase 10's source-account column; moving to an indexed key later needs a Dexie bump and a lossless upgrader.
- **D-08:** `DatasetMeta` gains `accounts[]`, one entry per account (root, its categories, its identity, its file-presence facts). The existing top-level `accountRoot`, `identity`, `categories` and `files` stay as legacy fields so a v1.0 cache still reads as a one-account dataset. Still ONE cached dataset and ONE zip hash.
- **D-09:** `playtime` and `logins` stay single aggregates over all accounts, computed at import by feeding every account's sessions/logins to the existing aggregators (playtime already merges overlapping sessions). Their `v`-keyed lazy rebuild is unchanged. Per-account slicing is Phase 10's if it needs it.
- **D-10:** Lifecycle is as v1.0 with N accounts: hash-dedupe reports "already loaded" for an identical zip; a different zip replaces every account and leaves no old rows; "Clear my cached data" and "Start over" remove every account. `writeDataset` stays one transaction.

### Interim pane behaviour (Phase 9 → 10)
- **D-11:** On a multi-account dataset the existing panes (Playtime, Vehicles, Finance, Logins, Device info) read ALL accounts' rows. Each shows a one-line "N accounts combined" caption so no pane presents one account as the whole. Dedupe, game filter and per-row source account are Phase 10. A single-account dataset shows no caption and behaves exactly as v1.0. — **Reversibility:** reversible — **Reversibility rationale:** a caption and a reader scope; Phase 10 replaces it.
- **D-12:** Because readers now see rows with the same `sourceFile`/`rowIndex` from different accounts, any reader that keys, sorts or de-duplicates on those alone must be checked. Research should list each one (e.g. vehicle rows keyed by vehicle id appearing in two accounts) and note what Phase 9 leaves for Phase 10.

### Identity header for N accounts
- **D-13:** The header is a stacked list of compact account rows, all visible with no interaction: nickname (or the ID when there is no `User_Info`), games covered, first-to-last activity years. One account renders exactly as v1.0 (nickname title, location code, created date, ID line). Fits the 480px phone block and the 44px touch floor.
- **D-14:** Games covered per account are the game tokens of that account's `*_Game_Sessions.csv` files that hold at least one row (the way playtime already names games via `sessionFileGame`). Friendly names: WOT = World of Tanks, WOTB = WoT Blitz, WOWS = World of Warships, WOTC = WoT Console, HEAT = World of Tanks HEAT; an unknown token is shown raw. Games with no pane yet (HEAT, WOTC) are still listed. `Game_Active_Sessions.csv` has no game token and is not a game source.
- **D-15:** First-to-last activity years per account come from the min and max session start across that account's game session files. An account with no usable sessions shows "no activity recorded".
- **D-16:** Accounts are ordered by first activity year ascending, so the list reads as a migration timeline; ties and no-activity accounts come last, ordered by account ID.
- **D-17:** An account with no `User_Info` still appears, identified by its ID. Missing identity fields keep the v1.0 "Unknown" wording (v1.0 D-16). The numeric ID stays visible on every row. No email or birth date reaches storage or any page, whichever root its `User_Info` sits under (v1.0 D-18 applies per root).

### Privacy for unsupported categories (added after research, 2026-10-16)
- **D-18:** Rows of unknown and known-deferred categories (Game_Forums, Chat_History, Bans, Clans, Surveys and the like) are parsed only to produce file and row counts for the "not yet supported" banners, and are NOT written to IndexedDB. The real sample's `Game_Forums/WOT_Forum_User_Info.csv` carries `EMAIL`, `IP_ADDRESS` and `BDAY_*` columns, and `Chat_History` holds message text; neither may reach storage. This makes roadmap SC4 literally true for the real sample. Phase 11/12 promote categories to supported one at a time, each with its own header-level strip (PRIV-01). — **Reversibility:** reversible — **Reversibility rationale:** a skip in the parse loop; promoting a category later means storing its rows again behind its own strip.
- **D-19:** The LOGIN/BIRTH_DATE strip still applies to every `User_Info` family file, per root, whichever folder spelling it sits under.

### Decisions recorded at plan-check (2026-10-16)
- **D-20:** The 128-character root-name bound (`root-name-too-long`) and the 32-root cap (`too-many-roots`) are accepted as sanctioned narrowings. Real account folders are numeric IDs; the bound exists because D-07 stamps the root on every row. A v1.0 single root folder longer than 128 characters now fails with the generic banner.
- **D-21:** D-18 also applies to returning users: on load of a cache that holds rows of unknown or known-deferred categories, the worker deletes those rows (an index delete by category, idempotent, no Dexie version bump, category row counts on meta untouched). No reader reads them, and a re-import restores them if a later phase promotes the category. This makes roadmap SC4 true for caches written before Phase 9.
- **D-22:** The lazy first-to-last-years rebuild for v1.0 caches is dropped. A v1.0 cache is always one account, and the UI-SPEC renders one account exactly as v1.0 with no Games or Activity rows, so nothing would read it. `accountsOfMeta` returns a one-entry list with empty games and null years for a legacy meta.
- **D-23:** Measured e2e baseline is 256 listed tests in 27 files (`playwright test --list`), not 252/254; the ceiling is 258, so Phase 9 may add at most two listed e2e tests unless the three CI limits move together.

### Defaults taken from the research open questions (planner may refine, not reverse)
- Identity pool is scoped per root, so an account with no `User_Info` never inherits another account's nickname (identity.ts falls back to `rows[0]` otherwise). The same per-root scoping applies in the login rebuild.
- Readers that group by (category, file) gain an account level so the import-time aggregate and the lazy rebuild agree.
- Account/overview cards with several accounts use the headline "N accounts"; the nickname appears once per account row, and the single-account DOM and test ids stay exactly as v1.0 (multi-account rows get their own ids).
- Keyed `{#each}` blocks that key on a value repeated across accounts (`VehicleTable` by `row.id`, `BattleTypeSummary` by `row.code`) key by index.
- (Superseded by D-22: no years rebuild for v1.0 caches.)
- A root-count cap bounds the work per import; planner picks the value.
- The arbitrary-wrapper shape keeps its pinned `no-recognized-category` reason where tests already assert it; user-visible result is the same single generic banner.
- Multi-account matrix coverage goes in unit tests against fake IndexedDB; the e2e suite is at 256 of 258 (D-23), so add at most two browser specs.

### Claude's Discretion
- Exact visual styling of the stacked account rows, within the Day 10 master-detail shell and the sketch findings skill.
- Exact wording of the "N accounts combined" caption and "no activity recorded".
- Fixture design for 1, 2 and 3 account roots (a synthetic copy of the real shape, not the real data), and where the per-account parse loop lives in `ingest.worker.ts`.
- How `AccountIdentity`/`ClassifyResult` carry the account list across the worker message contract.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements and roadmap
- `.planning/ROADMAP.md` §Phase 9 and §Planning Notes: goal, five success criteria, Dexie-schema and fail-closed notes
- `.planning/REQUIREMENTS.md`: ACCOUNT-01, -02, -03, -05, -08
- `.planning/PROJECT.md`: core value, Key Decisions (no-version-bump precedent, zero-network)

### Prior decisions that bind this phase
- `.planning/milestones/v1.0-phases/03-dashboard-shell-account-identity/03-CONTEXT.md`: D-12..D-21 identity header, privacy strip (D-18), Dexie bump pattern (D-19), notice slot and Import bar (D-25..D-27)
- `.planning/milestones/v1.0-phases/02-defensive-parsing-persistent-dataset/02-CONTEXT.md`: replace-on-upload, hash-dedupe, clear and start-over behaviour
- `.planning/milestones/v1.0-phases/01-ingest-foundation-zero-network-guard/01-CONTEXT.md`: fail-closed classification, single generic failure banner
- `.planning/milestones/v1.0-phases/08-master-detail-ui-redesign/08-CONTEXT.md`: master-detail shell the header lives in
- `.claude/skills/sketch-findings-wot-gdpr-stats-visualizer/SKILL.md`: UI conventions

### Code
- `src/lib/worker/classify.ts`: `analyzeExport`, `detectRoot`, `resolveAccountRootAndCategories`, `resolveCsvFileCategory`, `ambiguous-root`
- `src/lib/worker/db.ts`: `DatasetRow`, `DatasetMeta`, `writeDataset`, `clearData`, pinned `version(2)` upgrader
- `src/lib/worker/ingest.worker.ts`: per-category parse loop, `extractIdentity`, `resultFromMeta`
- `src/lib/worker/identity.ts`: `extractIdentity`, `extractAccountRecord`, User_Info strip
- `src/lib/shell/IdentityHeader.svelte`, `src/lib/shell/overview-model.ts`, `src/lib/shell/selection-state.ts`
- `src/lib/features/playtime/playtime-aggregate.ts`: `sessionFileGame`
- `tests/unit/import/db.test.ts`: pins the Dexie version; `tests/fixtures/export-fixtures.ts`, `tests/fixtures/sample-account.ts`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `classifyFolder` / `SUPPORTED` / `KNOWN_DEFERRED` (`categories.ts`): case-insensitive; the real sample's `Activity_History`, `Chat_History`, `Financial_Data` spellings already match.
- `foldersAt`, `unknownFolderHoldsRecognized`, `isTransparentWrapper`: the building blocks to run per candidate root.
- `sessionFileGame` / `isSessionFileName` (`playtime-aggregate.ts`, `db.ts`): the game-token source for D-14.
- `extractIdentity` / `extractAccountRecord`: run once per root instead of once per dataset.

### Established Patterns
- Non-indexed meta fields, no Dexie bump, lazy rebuild from stored rows (06-01).
- Fail-closed: any unrecognised shape throws into the single catch and shows the one generic banner.
- Worker-only Dexie access; the main thread gets only derived, PII-free objects (`AccountIdentity`).

### Integration Points
- `ClassifyResult.accountRoot` is a single string used by `IdentityHeader`, `overview-model`, `selection-state` and `db.readLoginRowData`; each needs the account list.
- The 117-entry real sample is the acceptance shape; a synthetic zip of the same shape must pass the same flows.

</code_context>

<specifics>
## Specific Ideas

- The real sample's `Subscriptions`, `External_Services_History` and `Language_And_Country_History` files are byte-identical in size across two of the accounts, so they look like per-Wargaming-ID data repeated per account. This is not a Phase 9 problem (those categories are unsupported until Phase 12) but it will matter then.
- The real sample is the user's own data and must not be committed; fixtures are synthetic copies of its shape.

</specifics>

<deferred>
## Deferred Ideas

- Merged correctness, game filter, overlap counting, source-account column: Phase 10.
- Cross-account duplicate account-level files (Subscriptions, External_Services_History, Language_And_Country_History repeated per account): Phase 12 must decide whether to show once or per account.
- HEAT and WOTC panes, WOWP/WOWS statistics: Phase 11.

None of the above is new scope for this phase.

</deferred>

---

*Phase: 9-Multi-account Import & Account Identity*
*Context gathered: 2026-10-16*
