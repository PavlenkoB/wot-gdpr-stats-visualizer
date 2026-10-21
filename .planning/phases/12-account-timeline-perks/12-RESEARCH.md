# Phase 12: Account Timeline & Perks - Research

**Researched:** 2026-10-20
**Domain:** Per-file column allowlists at the ingest choke point for nine new record families, folder promotion (six unknown folders), read-time cross-account merge, code/IP masking under the single global reveal, two new optional panes (no new dependencies)
**Confidence:** HIGH for the code paths, the storage hazards and the CI limits; MEDIUM for the architecture recommendations; **LOW / BLOCKED for every column allowlist except `HEAT_Surveys.csv`** (the real export's headers for the other eight families could not be read; even a names-only listing of the extracted export directory was denied by the permission classifier this session)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Emails are stripped at import and never stored. Email columns are excluded from every Phase 12 allowlist by construction, so the timeline shows that an entry existed (date, kind, service, value other than the address) but never the address. There is no reveal path and nothing to mask. PRIV-01 is satisfied outright and TIMELINE-01's "masked" is met in the strictest form. — **Reversibility:** costly — **Reversibility rationale:** the allowlist defines the stored row shape; storing emails later needs a cache rebuild and a new masking and reveal story.
- **D-02:** `Game_Forums/WOT_Forum_User_Info.csv` (header has `EMAIL`, `IP_ADDRESS`, `BDAY_*`) gets an allowlist that stores no columns this phase: the file is counted as present, nothing from it is stored, and no pane is added. Planner verifies the current behaviour first: Phase 11 D-15 says unknown folders are counted, not stored, while the Phase 9 research said they were stored raw. If D-15 already holds, the work is a test that plants a synthetic email in a forum fixture and asserts it reaches neither IndexedDB nor any pane, plus an in-place narrowing of caches that already hold the raw rows (the Phase 11 D-14 pattern). — **Reversibility:** reversible — **Reversibility rationale:** an empty allowlist entry and a test; a forums pane could add columns later with a rebuild.
- **D-03:** Every Phase 12 category (names, services, language/country, bans, authorized third parties, subscriptions, personal coupons, bonus codes, surveys) uses the Phase 11 mechanism: a per-file column allowlist enforced at the supported-folder row-storing choke point beside `reduceBlobRow`, one unit test per file header that plants a synthetic email and asserts it reaches neither IndexedDB nor any rendered pane (PRIV-01), and a header that matches none of its allowlist still imports successfully and shows an empty state with the file named in the pane's provenance line (Phase 11 D-09). Previously stored raw rows are narrowed in place by an idempotent step (Phase 11 D-14).
- **D-04:** Research reads the real export's column headers only, never cell values, using the values-free header-capture script pattern from Phase 11 (`11-RESEARCH.md`). Headers for these folders are not yet verified, so plans carry a Wave 0 `checkpoint:human-action` where the user runs the script and supplies names only; allowlist and fixture tasks depend on it. Fixtures stay synthetic; the real zip is never committed.
- **D-05:** Two new rows in the master-detail list: "Account timeline" and "Perks". Each row shows only when the export holds data for it, as for HEAT. Every row in both panes carries the account tag chip (Phase 10 D-10), hidden on a single-account dataset. — **Reversibility:** reversible — **Reversibility rationale:** list entries and components; no storage or schema.
- **D-06:** Account timeline is one merged, date-ordered list. Each entry has a kind badge (Name, Service, Language, Country, Ban, Third party), the value, the date and the account tag. A kind chip row may narrow the list (same chip-row pattern as the game filter); this is a pane-local control, not shared state. Name, service and language/country history entries all appear in this one chronology.
- **D-07:** Bans and Authorized_Third_Parties are dated entries in the same timeline, so one chronology also answers "what was enforced against it". IPs inside them are masked until the global reveal.
- **D-08:** Perks is stacked cards in a fixed order: Subscriptions, Personal coupons, Bonus codes, Surveys. Each card has its own empty state and shows the account tag per row. A card whose file is absent shows an empty state, never an error.
- **D-09:** The "Not yet supported" footer shrinks as these folders gain a pane (the Phase 11 behaviour); `Game_Forums` stays listed as not shown.
- **D-10:** Subscriptions, External_Services_History and Language_And_Country_History repeat per account (identical byte sizes in the real sample). Rows identical across accounts collapse into one entry that carries every contributing account's tag chip (one chip per account, as a login row does, Phase 10 D-18). Rows that differ in any stored column stay separate. — **Reversibility:** reversible — **Reversibility rationale:** a read-time grouping; storage stays per account.
- **D-11:** "Identical" means every allowlisted column is equal. No looser key, so deduping can never hide a real difference.
- **D-12:** Storage stays per account with the non-indexed `account` field and no Dexie bump (Phase 9 D-07, Phase 10 D-16); dedupe happens when the pane model is built. Planner may choose where (reader or model) provided the lazy `v`-keyed aggregate rule holds.
- **D-13:** Coupon codes, bonus codes and the user IP in bonus-code usage are masked by default and unmasked only by the existing single global reveal (`reveal-state.ts`) that already governs IPs in Logins and HEAT. No new control and no per-pane reveal. — **Reversibility:** reversible — **Reversibility rationale:** one shared reveal state; a separate control could be added later.
- **D-14:** Bans, authorized-third-party and any other IPs follow the same rule: masked until the global reveal, never revealed individually.
- **D-15:** Zero-network Playwright assertions are extended to both new panes (PRIV-02). A planted synthetic email never appears in clear text on any page. Any table over a few thousand rows is windowed or aggregated; no per-row SVG nodes (SCALE-01 binds).

### Claude's Discretion

- Masked form for codes and IPs (shape and how many characters show), within the existing IP masking pattern.
- Exact copy, badge colours, card visuals and kind-chip order within the Day 10 shell and sketch findings.
- What survey rows show once headers are known, provided the allowlist holds and no free text outside it is stored.
- Where dedupe lives (reader vs pane model).
- e2e budget: the three CI limits (258 spec ceiling history) must be raised or reconciled together if new specs push past them.

### Deferred Ideas (OUT OF SCOPE)

- A forums pane and storing any `Game_Forums` column.
- Filtering the new panes by game.
- A separate reveal control for codes.
- Showing a non-reversible email hint (e.g. domain) on timeline entries.
- Sort-by-account and an account picker (already rejected for v1.1).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TIMELINE-01 | Name history, external-services history and language/country history are shown as an account timeline; emails and IPs are masked | The three files sit in the already-SUPPORTED `User_Info` folder and are stored today behind only the LOGIN/BIRTH_DATE deny-list (Finding 1). Plug-in: extend `FAMILY_PATTERNS` by name, add three specs (category `user_info`), a pure timeline builder with a worker `account-timeline` channel, in-place narrowing for existing caches. Emails excluded by construction plus a value-level email guard (Finding 5). |
| TIMELINE-02 | Bans and Authorized_Third_Parties are shown; IPs stay masked | Both folders are UNKNOWN today (counted, never stored). Promote to SUPPORTED, category-scoped fail-closed family, specs after Wave 0; `address`-kind columns masked by `maskIp` under the shell's one reveal. |
| PERKS-01 | Subscriptions are shown | `Subscriptions` folder promotion + spec (file name `Subscriptions.csv` is cited from the Phase 9 sample); cross-account merge in the builder. |
| PERKS-02 | Personal coupons and bonus-code usage are shown; codes and user IP are masked by default | Folder promotions + specs; new spec/column kind `code` + `maskCode` formatter; reveal state is the existing `reveal-state.ts` cell. |
| PERKS-03 | Surveys are shown | `Surveys` folder promotion; `HEAT_Surveys.csv` header is VERIFIED from the Phase 11 capture; today it is a family file with no spec so it stores nothing. |
</phase_requirements>

## Summary

Five facts change the shape of this phase, and none of them is in CONTEXT. **First**, the three "history" files (`Account_Name_History.csv`, `External_Services_History.csv`, `Language_And_Country_History.csv`) are not in unknown folders: the Phase 9 sample lists them inside `User_Info`, which is a SUPPORTED category, so they are stored today with every column except `LOGIN`/`BIRTH_DATE*`. If External_Services_History or Language_And_Country_History carries an email column (the ROADMAP says the email question applies to "the name, service and language history files"), those emails are already at rest in every v1.1 cache. The allowlist is therefore a narrowing of live data, not a promotion. **Second**, the other six folders (`Authorized_Third_Parties`, `Bans`, `Bonus_Codes`, `Personal_Coupons`, `Subscriptions`, `Surveys`) are unknown today: parsed for counts, never stored. Promoting them to SUPPORTED without a *category-scoped* fail-closed rule would store any file in them whose name the allowlist family does not know raw, and promoting them also stops the D-21 purge from deleting v1.0-era raw rows of those folders. **Third**, D-02 is already satisfied by Phase 9 D-18: `Game_Forums` is unknown, counted and not stored, and legacy rows are purged on every cache check; the work is a regression guard, not a promotion. **Fourth**, the cross-account merge (D-10..D-12) has no stored aggregate to keep consistent: the new panes are served by row-built channel views, so the "lazy `v`-keyed aggregate rule" is satisfied by *not storing* an aggregate and merging inside a pure builder. **Fifth**, a header-only allowlist cannot stop an email that sits in an *allowlisted* column's value; a value-level email guard in the projection for the nine new specs closes that and makes the per-header canary test meaningful for allowlisted columns.

The real column headers of eight of the nine families are unknown (only `HEAT_Surveys.csv`: `PROFILE_ID|BATTLE_ID|QUESTION_ID|PLAYER_ANSWER|SKIPPED_BY_PLAYER|MESSAGE_TS` is verified, comma-delimited). The file names inside four of the six folders are unknown too. A new Wave 0 header capture is mandatory: the Phase 11 script only matches `HEAT_|WOTC_|WOWP_|WOWS_Crews|WOWS_Account_Storage` file names and would capture nothing useful here. Everything that does not depend on header names (folder promotion, category-scoped family rule, `code` column kind, `maskCode`, email guard, pane contract and shell wiring, e2e budget raise, pinned-test migration) can land before the checkpoint, because an unspecced family file stores nothing.

**Primary recommendation:** Land the header-independent, fail-closed infrastructure first (promotion + category-scoped family + value-level email guard + `code` kind + shell wiring + budget), run the Wave 0 names-only capture in parallel, then add the nine specs, one pure `account-timeline`/`perks` builder pair (merge, order, kind mapping), the two panes on the shared `NewDataCard`/`NewDataTable` (extended for several tags per row and the `code` kind), and prove it with the per-header matrix, the narrowing tests and one extended zero-network flow.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Column allowlist projection + value-level email guard | Worker (ingest choke point) | — | The raw parsed row must never leave the worker; same tier as the LOGIN strip and the Phase 11 projection |
| Folder promotion, category-scoped family rule | Worker (`categories.ts`, `new-data-allowlist.ts`) | — | Classification and storage decisions are worker-side and re-derived on replay |
| In-place narrowing of existing caches | Worker (`db.ts`, called from `handleCheckCache`) | — | Data operation on stored rows, no Dexie bump |
| Pane presence and counts for list rows | Worker (presence facts to `ClassifyResult.newDataPanes`) | Browser (renders) | The list issues no worker query; Phase 11 pattern |
| Timeline merge, ordering, kind mapping; Perks tables | Worker (pure builders over a Dexie snapshot) | — | Same split as HEAT: only cells cross `postMessage`; keeps 100k-row sorts off the main thread |
| Code and IP masking | Browser (render-time formatter) | Worker (declares column kind only) | Reveal is main-thread component state; the worker never masks, the clear value never reaches the DOM while masked |
| Single global reveal | Browser (`Dashboard.svelte` stamped cell, `reveal-state.ts`) | — | Already lifted in Phase 11; no new state |
| Kind filter chips | Browser (component-local) | — | Pane-local, resets per dataset (UI-SPEC) |
| Windowed tables | Browser (`windowRange`, `ROW_PX`) | — | Pure browser arithmetic; bounded DOM |
| Zero-network guarantee | CI (Playwright) | ESLint network ban, CSP meta | Unchanged mechanism, extended to two panes |

## Standard Stack

### Core

No new packages; every capability is an existing module of this repository. `[VERIFIED: 12-CONTEXT.md D-15, AGENTS.md dependency-minimalism constraint]`

| Module | Purpose | Why Standard Here |
|--------|---------|-------------------|
| `src/lib/worker/new-data-specs.ts` (`NEW_DATA_SPEC_FILES`, `SpecFile`, `SpecColumn`) | The allowlist: only place that names a stored column | The Phase 11 mechanism D-03 mandates `[VERIFIED: new-data-specs.ts:1-67, 97-113, 162]` |
| `src/lib/worker/new-data-allowlist.ts` (`FAMILY_PATTERNS`, `isNewDataFile`, `specFor`, `projectRow`, `fileMatchesSpec`, `MAX_NEW_DATA_CELL = 200`) | Name-based family test, category-checked spec lookup, projection | Output keys are spec constants; hostile headers cannot become stored keys `[VERIFIED: new-data-allowlist.ts:52-195]` |
| `src/lib/worker/db.ts` `narrowStoredNewDataRows` | Idempotent in-place narrowing run from `handleCheckCache` | Generic over `isNewDataFile`/`specFor`, so new families are narrowed for free once registered `[VERIFIED: db.ts:1211-1325; ingest.worker.ts:687-695]` |
| `src/lib/features/new-data/*` (`NewDataCard`, `NewDataTable`, `new-data-cell.ts`, `new-data-state.ts`, `new-data-aggregate.ts`) | Card states, windowed table, cell formatting, builders | UI-SPEC says extend, not fork `[VERIFIED: 12-UI-SPEC.md "New files the contract implies"]` |
| `src/lib/features/logins/login-model.ts` `accountChipsOf`, `displayIp` | Several tags per row (3 + `+N`), IP mask | Reused by Login history `[VERIFIED: LoginTable.svelte:196-212; new-data-cell.ts:16,55-56]` |
| `src/lib/features/playtime/playtime-aggregate.ts` `parseSessionTimestamp` | Tolerant wall-clock parse for timeline ordering | Accepts ISO shape and `DD.MM.YYYY HH:MM`, day-first, range-checked, never rolls over `[VERIFIED: playtime-aggregate.ts:126-181]` |
| `src/lib/shell/reveal-state.ts` + `Dashboard.svelte` `revealChoice` | The one global reveal | Already stamped to `importedAt`, never persisted `[VERIFIED: reveal-state.ts:1-60; Dashboard.svelte:170-176]` |

**Installation:** none. **Version verification:** not applicable.

## Package Legitimacy Audit

No external packages are installed or recommended, so the gate has no entries. Nothing was discovered via web search or training data (`security_enforcement` is on; no `npm`/`pip` command was run). **Packages removed due to SLOP:** none. **Packages flagged SUS:** none.

## Project Constraints (from CLAUDE.md / AGENTS.md)

- Svelte 5 runes only; Vite; pnpm; TypeScript `^6`. No SvelteKit, no router; selection is component state. `[CITED: AGENTS.md Constraints]`
- Core value: data never leaves the machine; zero network after load (one sanctioned opt-in city file). CI + ESLint network ban + CSP are the enforcement; extend, never weaken. `[CITED: AGENTS.md]`
- Dependency minimalism: hand-rolled tables/charts; no new library. `[CITED: AGENTS.md]`
- Scale: aggregate per bucket, never one SVG node per raw row; verify against a synthetic large export. `[CITED: AGENTS.md]`
- One phone block at 480px in `src/app.css`, components declare no media query; 44px touch floor. `[CITED: 12-UI-SPEC.md Layouts & Breakpoints]`
- Web Worker pipeline: one long-lived worker, `Papa.parse({ worker: false })`, fflate `unzipSync`. `[CITED: AGENTS.md]`
- Commits: no `Co-Authored-By` trailer (AGENTS.md rule; the orchestrator owns the commit of this file). `[CITED: AGENTS.md Agent Behavior Rules]`
- GSD workflow enforcement: edits go through a GSD command. `[CITED: AGENTS.md]`
- Sketch findings (Day 10 ink + teal, master-detail, provenance line, "About this ..." disclosure) are the visual contract. `[VERIFIED: .claude/skills/sketch-findings-wot-gdpr-stats-visualizer/SKILL.md]`

## Findings (what the planner must not miss)

### Finding 1: the three history files are in a SUPPORTED folder and are stored today

`[VERIFIED: 09-RESEARCH.md:366-369 table]` lists, for account 234567890, `User_Info` with `Account_Info.csv`, `Account_Name_History.csv`, `External_Services_History.csv`, `Language_And_Country_History.csv`; account 345678901 has `Account_Info.csv`, `External_Services_History.csv`, `Language_And_Country_History.csv`. `User_Info` is SUPPORTED:

```ts
// Source: src/lib/worker/categories.ts:22-29 [VERIFIED]
export const SUPPORTED: readonly string[] = [
  'Activity_history',
  'Player_statistics',
  'User_Info',
  'Payment_history',
  'Financial_data',
  'Device_info',
];
```

and the row choke point stores a non-family row of a `User_Info` folder through `sanitizeUserInfoRow`, which drops only `/^(LOGIN|BIRTH_DATE|BIRTH_DATE_SRC)(_\d+)?$/` and the overflow bucket `[VERIFIED: ingest.worker.ts:1222-1230; identity.ts:57, 326-330]`:

```ts
// Source: src/lib/worker/ingest.worker.ts:1222-1230 [VERIFIED]
const data = family
  ? spec === null
    ? {}
    : projectRow(raw, spec)
  : deviceInfo && hasBlobColumn(raw)
    ? reduceBlobRow(raw)
    : userInfo || hasSensitiveColumn(raw)
      ? sanitizeUserInfoRow(raw)
      : raw;
```

So any email-bearing column of these three files is at rest in IndexedDB right now. `[ASSUMED]` that such a column exists (headers unknown; ROADMAP Planning Notes say the email question applies to these files). The fix is the Phase 11 shape: put the three names in `FAMILY_PATTERNS` (anchored whole-name patterns, NOT a prefix pattern, because `Account_Info.csv` is in the same folder and must stay a non-family file for the identity pick) and give each a spec with category `user_info`. `narrowStoredNewDataRows` then rewrites or deletes existing rows with no new code `[VERIFIED: db.ts:1228 `isNewDataFile(key)` screen, 1243 `specFor(group[0]!.category, key)`]`.

### Finding 2: the other six folders are UNKNOWN today; promotion needs a category-scoped fail-closed rule

Storage is decided by folder status: `const storeRows = entry.status === 'supported';` and the loop is `for (let r = 0; storeRows && r < parsed.rows.length; r++)` `[VERIFIED: ingest.worker.ts:1046, 1184]`. Unknown folders are counted only (Phase 9 D-18). `[VERIFIED: 09-RESEARCH.md:378]` lists `Authorized_Third_Parties`, `Bans`, `Bonus_Codes`, `Game_Forums`, `Personal_Coupons`, `Subscriptions` and `Surveys` as unknown. Six of those seven (all except `Game_Forums`) must be appended to `SUPPORTED` (display spelling as the zip writes it; `classifyFolder` compares lower-case `[VERIFIED: categories.ts:52-61]`). Two hazards follow, both silent:

1. **Name-only family leaves holes.** `FAMILY_PATTERNS` is name-based:

   ```ts
   // Source: src/lib/worker/new-data-allowlist.ts:80-84 [VERIFIED]
   export const FAMILY_PATTERNS: readonly RegExp[] = [
     /^(?:heat|wotc)_/,
     /^wowp_/,
     /^wows_(?:crews|account_storage)\.csv$/,
   ];
   ```

   The file names inside `Bans`, `Authorized_Third_Parties`, `Personal_Coupons` and `Bonus_Codes` are unknown (Finding 8). After promotion, any file in those folders whose name is not a family name falls to the last branch of the expression above and is stored raw (including a second, unexpected file, or a future revision). **Recommendation (prescriptive):** add a *category-scoped* family test, `FAMILY_CATEGORIES = ['authorized_third_parties','bans','bonus_codes','personal_coupons','subscriptions','surveys']`, and make the ingest decision `const family = isNewDataFile(sourceFile) || isFamilyCategory(entry.name)`. A file of those categories with no spec stores nothing, exactly like `heat_device_info.csv`. Because `specFor` is checked with the row's *own* category (`spec.category === wanted`), a misfiled copy stores nothing `[VERIFIED: new-data-allowlist.ts:136-140]`.

2. **The D-21 purge stops protecting them.** `purgeUnsupportedCategoryRows` deletes every row whose category is *not* `supported` `[VERIFIED: db.ts:1086-1102, line 1095 `if (classifyFolder(key) === 'supported') continue;`]`. Phase 9+ builds therefore already emptied these categories on first load. A v1.0 cache that is first opened by a Phase 12 build keeps its raw `Bans`/`Bonus_Codes`/`Personal_Coupons`/`Subscriptions`/`Surveys`/`Authorized_Third_Parties` rows (IPs, codes, possibly emails), because the folders are now "supported" and `narrowStoredNewDataRows` only screens the `sourceFile` index by *name* (`db.ts:1220-1228`). **Recommendation:** extend `narrowStoredNewDataRows` with a second walk over the `category` index for `FAMILY_CATEGORIES`, grouping by (account, file, category) and applying the same `specFor`/`projectRow`/delete logic. Test with a legacy-shaped seed (no `account` field, as v1.0 wrote it) through the real `check-cache` path, the pattern at `multi-account-lifecycle.test.ts:795-930` `[VERIFIED: seedLegacyUnsupportedRows comment and PURGE_CANARIES]`.

### Finding 3: D-02 (`Game_Forums`) is already true; do not promote it

D-18 holds in code: `Game_Forums` is not in `SUPPORTED` or `KNOWN_DEFERRED` (`categories.ts:22-35`), so `storeRows` is false for it; its counts survive (`rowCount += parsed.rows.length` at `ingest.worker.ts:1274` is outside the `storeRows` loop) and the "Not yet supported" footer keeps showing it. Existing tests already plant `MA_FORUM_EMAIL_CANARY`/`MA_FORUM_IP_CANARY` and assert neither reaches storage (`multi-account-import.test.ts:322-328`) and that a legacy seeded `Game_Forums` row is purged on check-cache (`multi-account-lifecycle.test.ts` 795-930) `[VERIFIED: files read this session]`. The Phase 9 research sentence "Unknown categories are parsed and stored raw today" (`09-RESEARCH.md:68, 378`) describes the pre-D-18 state and is superseded. **Recommendation:** D-02 needs no allowlist entry and no pane. Deliver it as (a) a new regression guard that `Game_Forums` is neither in `SUPPORTED` nor in `FAMILY_CATEGORIES` and that no spec key names a forum file, and (b) the existing canary tests stay green after the six promotions (they are the proof). An "empty allowlist entry" would require promoting the folder, which would drop it from the footer and break D-09 ("`Game_Forums` stays listed as not shown").

### Finding 4: the history files must stop feeding the identity and Account-record pools

Two places treat every non-`Account_Info.csv` User_Info row as a fallback pool: the import (`(isAccountInfo ? root.accountInfoRows : root.otherUserInfoRows).push(data)` at `ingest.worker.ts:1271`, pool choice at `:1291`) and the lazy login rebuild (`fallbackPool.push(row.data)` at `db.ts:775-780`, `if (accountPool.length === 0) accountPool.push(...fallbackPool)` at `:782`) `[VERIFIED: ingest.worker.ts:1264-1272, 1289-1292; db.ts:740-790]`. `extractIdentity` does `pick(row, 'NAME')` on `rows[0]` when no row's `ID` matches the root `[VERIFIED: identity.ts:368-381]`, and `extractAccountRecord` reads `IP`, `COUNTRY_CODE`, `CITY` the same way `[VERIFIED: identity.ts:441-459]`. Once name history stores a `NAME`-like column (it must, to show names) an account that has history files but no `Account_Info.csv` would show a *historical* name as its nickname. Today this is a latent bug on raw rows; Phase 12 makes it reachable by design. **Recommendation:** exclude family files from both fallback pools with the one predicate (`isNewDataFile`), in both places, and add a test that a dataset with only the three history files yields `identity === null` and no Account record. The import path and the rebuild must agree (the "rebuild equals import" rule of Phase 9).

### Finding 5: add a value-level email guard for the nine new specs

A header allowlist stops an `EMAIL` column. It does not stop an email that is the *value* of an allowlisted column (for example an external-service "account" or "identifier" column, a ban "comment" column, a third-party "contact" column). Headers are unknown, so this cannot be excluded by inspection. D-01 says emails are "never stored". **Recommendation:** give `SpecFile` an `emailGuard: true` flag (set on all nine Phase 12 specs; Phase 11 specs unchanged, so no existing cache is re-narrowed) and have `projectRow` write `undefined` (key absent) for any cell matching an email shape (`/[^\s@]+@[^\s@]+\.[^\s@]+/` after the 200-char clamp). The same function is used at import and in `narrowStoredNewDataRows`, so import and narrowing cannot disagree. The consequence is visible and honest: the entry still exists (date, kind) with that part `not reported`. Test: plant a synthetic email into *every* allowlisted cell of a second fixture row and assert it is stored nowhere; this is the test the Phase 11 per-header matrix cannot be, because it plants canaries only in non-allowlisted columns `[VERIFIED: new-data-allowlist.test.ts:854-905 (canary columns, `canaryColumnsFor`)]`. Tag `[ASSUMED]` for the regex choice; it is a defensive heuristic and not a validator.

### Finding 6: dedupe has no stored aggregate to keep consistent (D-12)

`DatasetMeta` carries exactly two stored aggregates, `playtime` and `logins`, versioned `PLAYTIME_VERSION = 3` and `LOGINS_VERSION = 3` `[VERIFIED: db.ts:226, 277; playtime-shared.ts:64; login-shared.ts:39]`. Channel views for HEAT/Warships/Device info are built per query from `readRowsByFile` and memoised by `importedAt` (`getDataQueryMemo`/`setDataQueryMemo`, `MAX_MEMO_ENTRIES = 16`) `[VERIFIED: data-queries.ts:253-308, memo section]`. Therefore: build the merge inside the pure channel builder; **do not** add a third stored aggregate and **do not** bump either version. The "`v`-keyed" rule is honoured by absence. The two things that must still agree are the import-time row count in the presence facts (stored rows, per account) and the builder's input; the merge note's `k` is `storedRows - displayedRows`, computed in the builder from the same groups.

### Finding 7: promoting the folders flips about fifteen pinned tests that use `Bans` as THE unknown-folder stand-in

`Bans` is the canonical "unknown folder" example across the suite `[VERIFIED: grep this session]`: `tests/unit/shell/dashboard-status.test.ts:93,429-442,554-556`, `overview-model.test.ts:79`, `selection-state.test.ts:97`, `import/device-info-worker.test.ts:318`, `import/data-query-worker.test.ts:209`, `import/multi-account-import.test.ts:331`, `import/multi-account-lifecycle.test.ts:841,920`, `import/replay-reclassify.test.ts:132,274,318,495-545`, `import/db.test.ts:1065`, `import/classify.test.ts:492-497`, `import/ingest-worker.test.ts:872,2875-2890,3084-3145`, `import/csv-parse.test.ts:148-163`. Each asserts `'unknown'` or "no `Bans` rows stored". The planner must pick a neutral stand-in that stays unknown (recommend `Game_Forums` where counts matter, or a synthetic folder name that no phase will promote) and migrate those pins *in the same task* that edits `categories.ts`, or the suite goes red for reasons unrelated to the change. `classify.test.ts:497` also pins an order of category names that depends on status sorting.

### Finding 8: file names inside four folders, and every header but one, are unknown

Names cited from the Phase 9 sample: `Subscriptions.csv`, `External_Services_History.csv`, `Language_And_Country_History.csv`, `Account_Name_History.csv` `[CITED: 09-RESEARCH.md:368-369, 384]`; `HEAT_Surveys.csv` `[VERIFIED: 11-HEADERS.txt line 31]`. File names in `Bans`, `Authorized_Third_Parties`, `Personal_Coupons`, `Bonus_Codes` are unknown (the earlier phases printed a full entry listing but it was not recorded for these). This session's attempt to list the extracted export directory (`~/Downloads/export`) was denied by the permission classifier `[VERIFIED: tool denial this session]`; no workaround was attempted. Do not guess names: they must come from the Wave 0 capture.

### Finding 9: the one verified header (Surveys)

```text
FILE ACCT-B/Surveys/HEAT_Surveys.csv bytes 653 nonempty_lines 7
DELIM ,
HDR PROFILE_ID|BATTLE_ID|QUESTION_ID|PLAYER_ANSWER|SKIPPED_BY_PLAYER|MESSAGE_TS
```
`[VERIFIED: 11-HEADERS.txt lines 31-33; tests/fixtures/new-data-headers.ts:399-411]`. 7 non-empty lines means 6 data rows in the sample account (account B only; `heat_surveys.csv` is in ACCT-B alone `[VERIFIED: 11-HEADERS.md "Which HEAT and WoWS record types are present, per account"]`). Proposed allowlist (all `[ASSUMED]` decisions for the user to confirm at Wave 0): allow `QUESTION_ID` (survey-question identifier, a game/product object), `SKIPPED_BY_PLAYER` (flag), `MESSAGE_TS` (timestamp); exclude `PROFILE_ID` (a person/profile identifier), `BATTLE_ID`; **exclude `PLAYER_ANSWER` by default**: names alone cannot show whether it is an enumerated rating or free text, and D-03/Claude's-Discretion forbid storing free text outside the allowlist. Widening later costs a cache rebuild (D-08 in Phase 11), narrowing is free, so the fail-closed default is correct. The Surveys card is then a narrow table (question, skipped, date), as UI-SPEC Surface 3 allows ("not widened with invented columns"). Also: Phase 11 left `heat_surveys.csv` as a family file with no spec on purpose `[VERIFIED: new-data-specs.ts:54-55, 157-161]`; Phase 12 gives it a spec of category `surveys`. The comment says a guard test asserts the absence; grep found no assertion naming `heat_surveys` in `tests/unit` (only comments and the capture module), so check `new-data-allowlist.test.ts` and `new-data-facts.test.ts` for a "no spec for the two unlisted files" assertion before editing.

## Where the nine families plug in (answer to Question 1)

Two independent mechanisms exist and both are needed.

| Mechanism | File:line | What it decides |
|-----------|-----------|-----------------|
| Folder status | `categories.ts:22-35`, `ingest.worker.ts:1046` | whether a folder's rows may be stored at all (`storeFile` requires it) |
| Name family + spec | `new-data-allowlist.ts:80-140`, `new-data-specs.ts:162` | which columns of a stored file survive; no spec means store nothing |

```ts
// Source: src/lib/worker/ingest.worker.ts:1118-1122 [VERIFIED]
const rowData = parsed.rows.map((row) => row.data);
const family = isNewDataFile(resolved.sourceFile);
const spec = family ? specFor(entry.name, resolved.sourceFile) : null;
const storeFile =
  storeRows && (!family || (spec !== null && fileMatchesSpec(rowData, spec)));
```

Presence facts (the three-state `ready`/`skipped`/`no-rows` machinery) are written when `PRESENCE_CATEGORIES.has(entry.name.toLowerCase()) || (family && storeRows)` `[VERIFIED: ingest.worker.ts:1139-1159]` with `PRESENCE_CATEGORIES = new Set(['player_statistics','financial_data','payment_history', DEVICE_INFO_CATEGORY])` `[VERIFIED: ingest.worker.ts:111-116]`. Pane facts: `newDataPaneFacts` counts a fact only if `NEW_DATA_PANE_FILES[id].includes(sourceFile)` and `specFor(fact.category, sourceFile) !== null` `[VERIFIED: new-data-facts.ts:53-77]`.

| Family | Folder / category | File | Today | Plug-in work | Pane / kind |
|--------|-------------------|------|-------|--------------|-------------|
| Account_Name_History | `User_Info` / `user_info` | `Account_Name_History.csv` | supported folder, stored with weak strip (F1) | `FAMILY_PATTERNS` whole-name, spec, narrowing free | Timeline / Name |
| External_Services_History | `User_Info` | `External_Services_History.csv` | same | same | Timeline / Service |
| Language_And_Country_History | `User_Info` | `Language_And_Country_History.csv` | same | same; one entry per language/country value present | Timeline / Language, Country |
| Bans | `Bans` | unknown | unknown folder, counted only | promote, `FAMILY_CATEGORIES`, spec after Wave 0 | Timeline / Ban |
| Authorized_Third_Parties | `Authorized_Third_Parties` | unknown | same | same | Timeline / Third party |
| Subscriptions | `Subscriptions` | `Subscriptions.csv` | same | same; merged across accounts | Perks / Subscriptions |
| Personal_Coupons | `Personal_Coupons` | unknown | same | same; `code` column | Perks / Personal coupons |
| Bonus_Codes | `Bonus_Codes` | unknown | same | same; `code` + `address` columns | Perks / Bonus codes |
| Surveys | `Surveys` | `HEAT_Surveys.csv` | unknown folder; heat_ family file without spec | promote, spec (F9) | Perks / Surveys |
| Game_Forums | `Game_Forums` | `WOT_Forum_User_Info.csv` | unknown, counted only | **nothing** (F3); regression guard only | none; stays in footer |

Other registration points (all verified by reading the files this session unless marked):

- `SpecColumnKind = 'text' | 'number' | 'date' | 'address'` `[VERIFIED: new-data-specs.ts:79]` and the mirrored `NewDataColumnKind` `[VERIFIED: new-data-shared.ts "export type NewDataColumnKind"]`. **Add `'code'`** to both. The cell reader (`cellOf`) returns the trimmed, clamped string for it; `formatNewDataCell` masks it unless `revealed`. A maskable column is declared by kind in the spec, so a new column cannot reach the DOM unmasked by omission (UI-SPEC Surface 4).
- `NEW_DATA_PANE_IDS = ['heat', 'warships-storage'] as const` `[VERIFIED: new-data-shared.ts:38]` becomes four ids. `NEW_DATA_PANE_FILES`, `NEW_DATA_PROVENANCE_LABELS` (`ui-copy.ts` near 3447), `PANE_TITLES` (`ui-copy.ts:3355-3370`), `PANE_SECTION` (`selection-state.ts:148-160`), `DataQuery`/`DataResult` unions (`worker-messages.ts:~405-442`), `DATA_FILES` and `answerDataQuery` (`data-queries.ts`) are `Record`/exhaustive-switch sites, so TypeScript flags every omission. TypeScript does **not** flag these `ternary` sites; they must be found by hand:
  - `optionalPaneEntry` picks the summary with `id === 'heat' ? formatHeatRowSummary(...) : formatWowsStorageRowSummary(...)` `[VERIFIED: selection-state.ts:215-219]`; the new panes would silently get the Warships summary. Use a `switch` over the four ids.
  - `zero-network.spec.ts:496-500` picks the test id with `pane === 'heat' ? 'heat-block' : 'warships-storage-block'` `[VERIFIED: zero-network.spec.ts:496-500]`; use `${pane}-block` (UI-SPEC test hooks: `account-timeline-block`, `perks-block`).
- `OPTIONAL_PANE_IDS = NEW_DATA_PANE_IDS` and `PANE_ORDER` spreads all optional ids after `vehicles` `[VERIFIED: selection-state.ts:108-129]`. UI-SPEC wants Perks after Payments and Account timeline directly above Account, so the spread must be replaced by explicit entries. Pinned: `selection-state.test.ts:540` and `list-pane-optional.test.ts:71` assert `['heat', 'warships-storage']`.
- `overview-model.ts:48-49` spreads `OPTIONAL_PANE_IDS` into the card ids `[VERIFIED: overview-model.ts grep lines 48-54]`, so Overview cards follow automatically.
- `Dashboard.svelte`: add two `{:else if active === 'account-timeline'}` / `'perks'` branches beside `heat` (`:449-466`), each `<DashboardSection {...newDataSectionProps(...)}>` with `revealed`/`onRevealChange` props from the shell cell (`Dashboard.svelte:170-176`).
- `UnsupportedBlock` and the list headline derive from `unsupportedEntries(result)` = `result.categories.filter(entry => entry.status !== 'supported')` `[VERIFIED: dashboard-status.ts:220-223]`; promotion removes the six folders from all four footer surfaces at once, and a cache replay re-derives status from the stored name (`resultFromMeta`), so no Dexie bump.

## Header-capture plan (answer to Question 3)

### What exists and why it cannot be reused as-is

`header_capture.py` (Phase 11) opens the zip read-only, extracts nothing, prints only `FILE <path> bytes <n> nonempty_lines <n>`, `DELIM`, and `HDR a|b|c` when **every** token matches `^[A-Za-z][A-Za-z0-9_]{0,63}$`, else `HDR [suppressed]`; account folders are relabelled `ACCT-A`, `ACCT-B`... `[VERIFIED: header_capture.py:1-141]`. Its scope filter is `FAMILY_RE = re.compile(r'(HEAT_|WOTC_|WOWP_|WOWS_Crews|WOWS_Account_Storage)', re.IGNORECASE)` matched against the file name only (`:53`, `:123`). It would skip every Phase 12 file except `HEAT_Surveys.csv`. `11-HEADERS.txt` therefore holds **only** Phase 11 files (it lists `HEAT_Surveys.csv` under `Surveys`; nothing for Bans, Coupons, Bonus_Codes, Subscriptions, the three history files or Authorized_Third_Parties) `[VERIFIED: 11-HEADERS.txt]`.

### What to build (Wave 0, autonomous task) - `header_capture_12.py`

Same output contract (so the existing parse step and `CAPTURED_FILES` module shape are reused), standard library only, `python3 -I`. Differences:

1. **Scope by folder, not by name.** Print every file whose second path segment (case-insensitive) is one of `authorized_third_parties`, `bans`, `bonus_codes`, `personal_coupons`, `subscriptions`, `surveys`; plus, for `user_info`, only these exact file names: `account_name_history.csv`, `external_services_history.csv`, `language_and_country_history.csv`. **Never** `Account_Info.csv` (its header carries `LOGIN`, `BIRTH_DATE`; unnecessary) and **never** `Game_Forums` (D-02 stores nothing; its header carries `EMAIL`/`IP_ADDRESS`). Print a `FILE` line even for a file whose header is suppressed, so the file list is complete.
2. **Code-shape guard (new, the one real leak vector).** Phase 11's rule suppresses a first line unless every token is identifier-like. A *headerless* one-column file whose first line is a coupon or bonus code such as `AB7KQX42` is identifier-like and would print verbatim. Add: suppress the whole line when any token is code-shaped, `^(?=.*[0-9])(?=.*[A-Za-z])[A-Za-z0-9]{6,}$` (mixed letters and digits, six or more, no underscore), and when the file has fewer than two non-empty lines **and** one token. Real headers here are `UPPER_SNAKE` words and are unaffected `[ASSUMED]`; a legitimate header that trips the rule becomes `[suppressed]`, which the checkpoint handles. Tag the exact regex `[ASSUMED]`; the guard test is what proves it.
3. Print the delimiter, byte size and non-empty line count as before (row count = lines - 1).
4. **Guard test** `tests/unit/guards/header-capture-script-12.test.ts`, modelled on `header-capture-script.test.ts` `[VERIFIED: header-capture-script.test.ts:1-60]` (synthetic archive written to a `mkdtemp` directory, three numeric roots, `.example.invalid` emails). Canaries: headerless `Personal_Coupons` file whose first line is a code-shaped token; headerless file whose first line is `<digits>,<email>`; a `Game_Forums` file and `Account_Info.csv` (must not appear in output); BOM and quote-all header; bare-CR terminators; account digits never echoed.

Output location (names only, committed): `.planning/phases/12-account-timeline-perks/12-HEADERS.txt`; decision table `12-HEADERS.md` (columns: header, allow/exclude, kind including `code` and `address`, reason); names-only constants appended to `tests/fixtures/new-data-headers.ts` (`CAPTURED_FILES`, which `tests/unit/guards/new-data-headers.test.ts` re-validates for identifier-shaped tokens and the absence of values) `[VERIFIED: new-data-headers.test.ts:60-110]`.

### Wave 0 checkpoint shape (mirror of 11-02 Task 2)

```xml
<task type="checkpoint:human-action" gate="blocking">
  <name>Run the Phase 12 header-capture script on the real export (human action)</name>
  <action>Run the script on your own export and save its output. Only you can do this: the zip is yours, it must not leave your machine, and the agent's permission rules block reading its contents.</action>
  <instructions>
    1. At the repo root: python3 -I .planning/phases/12-account-timeline-perks/header_capture_12.py /path/to/export.zip > .planning/phases/12-account-timeline-perks/12-HEADERS.txt
    2. Open 12-HEADERS.txt and read it once. Only FILE / DELIM / HDR lines; upper-case column names, sizes, counts. If ANY line looks like a value (number sequence, email, name, code, address), delete the file and tell the agent which line.
    3. Answer in chat, NAMES ONLY, for each captured column: could its VALUES hold an email, a person's name, free text, an IP address or a code? (yes / no / unsure). Unsure is treated as yes, i.e. excluded or masked.
    4. Type the date shape you see in your own files (for example "DD.MM.YYYY HH:MM", "YYYY-MM-DD HH:MM:SS", date only); do not paste any value.
    5. Do not commit or push the zip, and do not paste any cell content into chat.
  </instructions>
  <verification>12-HEADERS.txt exists; every non-FILE line is DELIM or HDR; no at-sign or purely numeric token; FILE lines cover all six folders and the three history files for each account that holds them.</verification>
  <resume-signal>Type "headers captured" plus the answers to steps 3 and 4, or describe what looked wrong.</resume-signal>
</task>
```

Step 3 and 4 are new compared with Phase 11 and they close two gaps names cannot: which allowlisted values might still hold an email (Finding 5), and the date format (UI-SPEC "unresolved" ordering item). Tasks that **depend** on the checkpoint: the nine specs, the column-label maps, the per-kind Entry mapping (primary/secondary columns), the `NEW_DATA_PANE_FILES` lists (file names), the Language/Country row rule, fixtures with the captured headers, the per-header matrix. Tasks that do **not**: everything in the "Wave 1" list under Architecture Patterns.

Expectations that are **unverified** (do not state as facts in plans): a name-history file probably has a name column and a date column; services history probably has a service identifier and an action and possibly an email-like identifier; bans probably have a reason, dates and possibly an IP; coupons and bonus codes have a code column; bonus-code usage has the user IP (D-13). All `[ASSUMED]`. Fixtures must be comma-delimited: every captured Phase 11 file was comma-delimited, contradicting the older "semicolon" belief `[VERIFIED: 11-HEADERS.md Notes 4]`; mixed line endings remain unverified for new files so fixtures should keep mixing LF, CRLF and bare CR.

## Question 4: read-time dedupe (D-10, D-11, D-12)

**Where:** in the pure builders (worker side), not in `readRowsByFile` and not in the Svelte component. The reader stays generic ("these names, these categories") `[VERIFIED: data-queries.ts header comment on why the file table lives there]` and its groups are per account `[VERIFIED: db.ts:926-938]`. The builder receives `AccountRowGroup[]` per file (one group per account), exactly the unit every other builder resolves within (CR-01).

**Rule (implement exactly this):**

1. Merge only in the three files D-10 names: Subscriptions, External_Services_History, Language_And_Country_History (UI-SPEC Recorded Choice 3).
2. Row signature = the ordered tuple of every *allowlisted* column's stored value (absent = a distinct marker), joined with a separator that cannot occur in a cell (NUL, as `narrowGroupKey` does `[VERIFIED: db.ts:1132-1134]`), **plus the occurrence index of that signature inside its own account**. Two accounts' *k*-th occurrence of the same signature merge; a second identical row in the *same* account does not merge with the first (D-10 is about rows "identical across accounts"; collapsing same-account repeats would hide a real repeated event). `[ASSUMED]` reading of D-10/D-11; surface to the user as a one-line confirmation, cheap to flip (drop the occurrence index).
3. Key the grouping in a `Map` (never an object): an account root may be `__proto__` `[VERIFIED: db.ts:921-925 comment T-09-27]`.
4. A merged entry carries `accounts: string[]` in a deterministic order; the UI sorts chips by identity-header letter via `accountChipsOf` (it already "orders chips by LETTER and not by the stored array") `[VERIFIED: login-model.ts:495-529 doc comment]`, so the builder does not need the identity-header order for chips.
5. `k = storedRows - displayedRows` is computed in the builder and returned with the view for the merge note (UI-SPEC Surface 5).
6. Tie-break by identity-header order (UI-SPEC Recorded Choice 2) needs the account order, which `RowsSnapshot` does not carry `[VERIFIED: db.ts:805-815 field list `importedAt`, `files`, `rows`]`. Two options: (a) add `accounts: readonly string[]` to `RowsSnapshot` from `accountsOfMeta(meta)` in `readRowsByFile` (one field, no schema change) and pass it to the builder; or (b) sort on the main thread. Recommend (a): the sort for tens of thousands of entries belongs in the worker and the order is then identical between plain and windowed modes.

**Interaction with account tag chips:** `NewDataRowView` currently carries one `account: string` `[VERIFIED: new-data-shared.ts "NewDataRowView"]`, and `NewDataTable` draws one tag via `tagOf(row)`. Extend (do not fork) to `accounts: readonly string[]` and render with `accountChipsOf(row.accounts, tags)`, the same call the Login table makes (three drawn chips, hidden ones as `visual={false}`, then one `+N` node), with no whitespace text node when tags are `null` `[VERIFIED: LoginTable.svelte:196-212]`. `orderRowsByAccount` in `new-data-state.ts` takes `{ account: string }` `[VERIFIED: new-data-state.ts:45]`; give it the first account of `accounts` or do the ordering in the builder.

## Question 5: reveal and masking

- **State:** `Dashboard.svelte` holds `let revealChoice = $state<RevealChoice>({ revealed: false, stamp: null });`, `const revealed = $derived(resolveReveal(revealChoice, datasetStamp(result)))` and `setRevealed(next)` stamping `datasetStamp(result)` `[VERIFIED: Dashboard.svelte:170-176 via grep + context read]`. `reveal-state.ts` is a pure function over a stamped cell delegating to `maskStateFor`; it has no runes, storage, URL or history, and `tests/unit/shell/reveal-state.test.ts` scans the shell directory to keep it that way `[VERIFIED: reveal-state.ts:1-60]`. **Phase 12 adds no state.** Both new panes take `revealed` and `onRevealChange` exactly as `HeatPane` does (`Dashboard.svelte:457-458`).
- **IP masking:** `maskIp(canonical)` re-parses and returns `A.B.C.xxx` (IPv4) or `g1:g2:g3:xxxx:xxxx:xxxx:xxxx:xxxx` (IPv6), and the fixed `xxx` for anything non-canonical, never echoing its input `[VERIFIED: ip.ts:140,143,381-393]`. `displayIp({ip}, revealed)` = `revealed ? address.ip : maskIp(address.ip)` `[VERIFIED: login-model.ts:94-96]`. For `address`-kind spec columns, `cellOf` already converts the stored string to the canonical form or `null` so a non-address string can never be "revealed" `[VERIFIED: new-data-aggregate.ts "cellOf" kind === 'address']`.
- **Code masking (new):** UI-SPEC defines `maskCode`: stored code of 8 or more characters shows the first two characters then the fixed text `xxx` (`AB7K-QX42` reads `ABxxx`); shorter, empty or non-string shows `xxx` only; derived by character count, never by splitting on a separator; never throws; never reflects length (`12-UI-SPEC.md` Surface 4, Recorded Choice 6). Implement as a pure, import-free function (recommend `src/lib/features/new-data/code-mask.ts`; the UI-SPEC says "beside `maskIp`", but `ip.ts` documents itself as IP parsing, so a sibling module is cleaner). Count by code points (`Array.from(text)`), not UTF-16 units, so a surrogate pair is never split. Wire it in `formatNewDataCell` as a `code` branch next to the `address` branch `[VERIFIED: new-data-cell.ts:55-57]`, and add a `code` width class to the table's kind map (`NewDataTable.svelte:116` has `address: { px: 176, cls: 'w-address', taggedCls: 'w-address-tagged' }`).
- **What is where, honestly:** codes and IPs are stored in clear in the user's own IndexedDB (D-13 requires a reveal, so they must be). They cross `postMessage` to the main thread as strings (canonical address for `address`; clamped string for `code`) and reach the DOM *only* through `formatNewDataCell`. Emails are in none of these places. `[ASSUMED]` that the user accepts codes at rest in their own browser as the same class as session IPs; list in the Assumptions Log.
- **Proof that nothing leaks to the DOM while masked:** Playwright, on a fixture with a synthetic code (shape `ZQ7K-CANARY-0001`), a synthetic IP (TEST-NET-3 `203.0.113.250`, already the Phase 11 canary) and a synthetic email in every file: assert `page.content()`, the pane `innerText` and `outerHTML`, `document.title`, console output and every attribute value contain neither the full code, nor `code.slice(2)`, nor the full IP; assert the masked forms are present; press the toggle and assert they appear; reload and assert re-masked. The Phase 11 HEAT test is the template: `surfaceOf`, `expectNoCanary`, `maskIp(address)` assertions `[VERIFIED: new-data-panes.spec.ts:120-215]`.
- **Proof for IndexedDB:** the unit matrix reads `db.rows` and `db.meta` after a real-worker ingest and asserts the email canary absent, and (by design) the code and IP canaries present *only* under their allowlisted keys; the presence facts, `meta` and the memo hold counts only.
- **Toggle copy and placement:** Timeline reuses `MASK_TOGGLE_*`/`MASK_CAPTION_*`/`MASK_ANNOUNCE_*` (IP-only); Perks adds `PERKS_MASK_*` (UI-SPEC copy table). The toggle renders only when at least one rendered maskable value exists, using the same condition as `HeatPane` (`card.columns.some(column => column.kind === 'address')` and at least one row, `HeatPane.svelte:147-158`), extended with `'code'`. The toggle in either pane changes Login history's addresses too, because it is the one reveal.

## Question 6: scale, windowing and the e2e budget

- **Windowing:** `PLAIN_TABLE_MAX_ROWS = 500`, `shouldWindow(rows) = rows > 500` `[VERIFIED: new-data-state.ts:32-37]`; the table draws a window between two spacer rows at constant `ROW_PX = 40`, written through the CSSOM because the build CSP forbids inline styles `[VERIFIED: NewDataTable.svelte:1-60]`. The timeline is one table: merged entries are windowed above 500; each Perks card is its own table. Real files are tiny; windowing proof must use a **synthetic large fixture** (generator `buildLargeTableCsv(key, rows)` exists in the Phase 11 fixtures `[VERIFIED: multi-account-fixtures.ts:~1640 usage]`). Sorting and merging tens of thousands of entries is O(n log n) in the worker; the posted view carries cells, not DOM.
- **No truncation, no "more rows" line** (UI-SPEC Recorded Choice 4 of Phase 11 carries over). Do not copy Device info's `MAX_DEVICE_ROWS = 200`.
- **CI budget, measured:** `playwright test --list` printed **`Total: 263 tests in 30 files`** `[VERIFIED: tool output this session]`. The three limits and their pins:

  | Limit | Where | Value |
  |---|---|---|
  | G, `globalTimeout` | `playwright.config.ts:222` | `globalTimeout: 31 * 60 * 1000,` `[GREP]` |
  | W, wrapper | `.github/workflows/ci.yml:236` | `run: pnpm exec timeout 33m playwright test` `[GREP]` |
  | J, job | `.github/workflows/ci.yml:110` | `timeout-minutes: 41` `[GREP]` |
  | Pins | `tests/unit/guards/ci-budget.test.ts:536-545` | `toBe(1860)`, `toBe(1980)`, `toBe(2460)` and `toBeLessThanOrEqual(264)` `[VERIFIED: sed 520-560]` |
  | Comment sentence | `.github/workflows/ci.yml:188` | ``Playwright's own `globalTimeout` (31 min)`` must equal G (test at `ci-budget.test.ts:571-598`) `[VERIFIED: sed 560-600]` |

  Rule: all three move together, W = G + 2 min, J = W + 8 min, required `G >= 1.3 * E` `[VERIFIED: ci-budget.test.ts:348-355, 529-560]`. With the Phase 11 closing formula `E(N) = 1429 + 5*(N - 264)` for `N >= 260` `[CITED: 11-RESEARCH.md "CI Budget"; re-derived: 330 + 5*(N-105) + 304]`, N = 264 gives floor 1857.7 s (passes 1860), **N = 265 gives 1864.2 s (fails)**. So exactly **one** new listed test fits without a raise.
- **Recommendation (prescriptive):** raise now and spend two listed tests: one spec file with two tests (`account-timeline`, `perks`), each carrying its claims as `test.step`s (states, tags, merge, reveal, canaries, window node count, 375px), and extend the existing long zero-network test with the two panes (zero extra listed tests, as Phase 11 did). N = 265, so G = 32 min (1920 s), W = 34 min (2040 s), J = 42 min (2520 s); at G = 1920 s the model admits `N <= 273` (`1920 / 1.3 = 1476.9 s`, `(1476.9 - 1429) / 5 = 9.6`), so pin `toBeLessThanOrEqual(273)`. Edits that must land together: `playwright.config.ts` (G and an appended, dated "Raised from ..." paragraph near lines 197-216), `ci.yml` (`timeout 34m`, `timeout-minutes: 42`, the `(32 min)` sentence at 188, the present-tense comment at 108-109 and 232), `ci-budget.test.ts` (three `toBe` pins, the ceiling pin, a new "phase 12 raised ..." test name, a `projectedE2eSeconds(265)` worked case). If the planner prices the large-fixture import as its own block (as `MULTI_ACCOUNT_SCALE_SECONDS = 49` does `[VERIFIED: ci-budget.test.ts:~330]`), measure it and add it; unmeasured CI wall time is an open item (a local 12-core run of 263 took about 1.4 minutes per Phase 11, CI unmeasured `[CITED: ROADMAP.md Planning Notes]`).
- **Cheaper alternative:** one new listed test covering both panes as steps keeps N = 264 and no raise, at the cost of one long test (`test.setTimeout(180_000)` as Phase 11's HEAT test does). Both are valid; choose by whether the planner wants per-pane failure isolation.
- **Pinned unit/e2e loops that will break when the optional ids grow:** `selection-state.test.ts:540`, `list-pane-optional.test.ts:71`, `new-data-facts.test.ts:426-436` (asserts `Object.keys(NEW_DATA_PANE_FILES)` equals `NEW_DATA_PANE_IDS`, fine if both are extended), `overview-model.test.ts` cards, `zero-network.spec.ts:496-500`, `mobile-sweep.spec.ts` (`[...PANE_IDS]` equals `PANE_EXPECTATIONS` keys, nine panes only, unaffected). `identity-privacy.spec.ts` scans `PANE_IDS` only (the nine), so a Name entry equal to the nickname in the timeline does not trip its "nickname exactly once" assertion `[VERIFIED: identity-privacy.spec.ts:253-262]`; keep new fixtures in a **new builder** (as `buildNewGamesThreeAccountExport` does) rather than editing `buildRealShapeThreeAccountExport`.

## Architecture Patterns

### System Architecture Diagram

```
zip bytes ──> analyzeExport (N roots) ──> unzipSync(filter) ──> parseCsvFile (BOM, mixed CR/LF, glued-header withhold)
                                                  │
        folder status: categories.ts SUPPORTED  <── + Authorized_Third_Parties, Bans, Bonus_Codes,
                                                  │     Personal_Coupons, Subscriptions, Surveys   (NEW)
                                                  ▼
        ┌──────────────────────── ingest choke point (per file, per row) ─────────────────────────┐
        │ family = isNewDataFile(name) || isFamilyCategory(category)                (NEW: category) │
        │ spec   = specFor(category, name)         spec null  -> store NOTHING (fail closed)       │
        │ file-level fileMatchesSpec               no column matched -> store nothing, "skipped"    │
        │ projectRow(raw, spec)  + emailGuard on every cell                          (NEW guard)   │
        │ history files excluded from identity / Account-record fallback pools       (NEW)         │
        └───────────────┬───────────────────────────────────────────────────────────────────────────┘
                        │ presence fact per family file (rowCount = stored, parsedRowCount = parsed)
                        ▼
   Dexie rows(account, spec keys only) + meta.files ──> newDataPaneFacts ──> ClassifyResult.newDataPanes
                        │                                        │ (list rows, Overview, headers: no query)
   check-cache: purge unsupported ─> narrowStoredNewDataRows (name walk + category walk NEW)
                        │
   data-query 'account-timeline' / 'perks' ──> readRowsByFile ──> pure builders:
        timeline: per-file kind mapping, language/country split, merge (3 files), date sort, k
        perks:    4 card inputs (buildNewDataCard), merge (Subscriptions), code/address kinds
                        │ postMessage: cells + kinds + accounts[] (no email, no file name)
                        ▼
   Dashboard.svelte (revealed, onRevealChange) ──> AccountTimeline.svelte / Perks.svelte
        NewDataCard/NewDataTable (accounts[], 'code' kind) ──> formatNewDataCell ──> maskIp / maskCode
```

### Recommended Project Structure

```
src/lib/worker/categories.ts                 # +6 SUPPORTED folders
src/lib/worker/new-data-specs.ts             # +9 SpecFile entries, SpecColumnKind 'code', emailGuard flag
src/lib/worker/new-data-allowlist.ts         # +3 whole-name patterns, FAMILY_CATEGORIES, isFamilyCategory, projectRow emailGuard
src/lib/worker/db.ts                         # narrowStoredNewDataRows: + category walk; RowsSnapshot.accounts; fallbackPool excludes family
src/lib/worker/ingest.worker.ts              # family decision, otherUserInfoRows exclusion
src/lib/features/new-data/new-data-shared.ts # 4 pane ids, files, 'code' kind, accounts[] on rows
src/lib/features/new-data/code-mask.ts       # maskCode (pure, no imports)
src/lib/features/account-timeline/           # timeline-shared.ts (no imports), timeline-aggregate.ts (pure), AccountTimeline.svelte, KindFilter.svelte
src/lib/features/perks/                      # perks-aggregate.ts (pure), Perks.svelte
```

### Pattern 1: file-level, fail-closed registration (reuse)

Add a `SpecFile` per file; the file stores nothing until it has one. Never add a column on a hunch; every column traces to the Wave 0 decision table (the Phase 11 guard `new-data-allowlist.test.ts:470-545` requires each stored column to be evidenced and each identity-pattern match to be a documented exception, so name history's name column, `IP` columns and `CODE` columns need entries in `IDENTITY_EXCEPTIONS` with a reason over 20 characters `[VERIFIED: new-data-allowlist.test.ts:208-232, 547-575]`).

### Pattern 2: per-kind Entry mapping lives beside the specs, validated by a test

Timeline entries need, per file key, `{ kind, dateColumn, primaryColumn, secondaryColumns[<=2] }` and, for Language/Country, `{ languageColumn, countryColumn }`. Keep this in a no-import shared module and add a unit test that every referenced id exists in the file's spec (so a column rename cannot silently blank a kind). A cell's *display kind* (text/date/address/code) comes from the spec column, so the view carries `parts: { cell, kind }[]` and the formatter masks by kind; a part cannot bypass masking.

### Pattern 3: view shape (PROPOSED, names are the planner's)

```ts
// PROPOSED; none of these names exist yet. Cells and kinds only, no file names, no emails.
type TimelineKind = 'name' | 'service' | 'language' | 'country' | 'ban' | 'third-party';
interface TimelineEntryView {
  readonly kind: TimelineKind;
  readonly date: string | null;                 // as the export wrote it
  readonly parts: readonly { cell: NewDataCell; kind: NewDataColumnKind }[]; // primary then <=2 secondary
  readonly accounts: readonly string[];         // >=1, merged entries >1
}
interface TimelineView { status: 'ready'; entries: readonly TimelineEntryView[]; mergedAway: number;
  files: Record<'name'|'service'|'languageCountry'|'bans'|'thirdParties', NewDataCardView['status']>; }
```
Sorting: newest first by `parseSessionTimestamp`-based instant widened to accept date-only values; unparseable dates last, original text still displayed; ties by kind order, file order, then identity-header account order (UI-SPEC Recorded Choice 2). A format the parser rejects makes the entry "undated" (UI-SPEC unresolved item): the display text must still be the export's own string.

### Wave structure suggestion (non-binding)

- **Wave 0 (header-independent, autonomous):** `header_capture_12.py` + guard test. **Then** `checkpoint:human-action`. **Then** transcription into `12-HEADERS.md` and `new-data-headers.ts`.
- **Wave 1 (parallel to the checkpoint; fail-closed so safe without specs):** promotion + `FAMILY_CATEGORIES` + category narrowing walk; whole-name patterns for the three history files; `code` kind + `maskCode`; email guard; identity-pool exclusion; pane contract (4 ids) + shell wiring + `PANE_ORDER`; pinned-test migration (Finding 7); budget raise. Ship with zero specs: the folders store nothing.
- **Wave 2 (needs headers):** nine specs, label maps, `NEW_DATA_PANE_FILES`, fixtures, per-header matrix, narrowing tests, builders.
- **Wave 3:** panes (`AccountTimeline`, `Perks`), kind filter, merge note, copy and `ui-copy` tests.
- **Wave 4:** e2e (two tests), zero-network extension, large fixture, final budget check.

### Anti-Patterns to Avoid

- **Promoting `Game_Forums`** to get an "empty allowlist": drops it from the footer and contradicts D-09 (F3).
- **Name-only family for newly promoted folders** (F2).
- **A growing deny-list** for emails; the direction is allowlist plus a value guard.
- **Storing a third aggregate** for the merge (F6).
- **Reading a file's header text into stored keys**; keys are spec constants `[VERIFIED: new-data-allowlist.ts:31-38]`.
- **A second status derivation** for list rows; one `newDataPaneFacts` feeds `done`, `duplicate`, `cache-status`, list, Overview and headers.
- **Merging coupons, bonus codes, bans or names** (could hide a per-account fact; UI-SPEC Recorded Choice 3).
- **Changing `buildRealShapeThreeAccountExport`** (existing literals and the identity-privacy scan depend on it).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Header normalisation | trim/case helper | `headerKey` (`csv-columns.ts:15`) | every aggregator matches through it |
| Per-account row grouping | a new map | `AccountRowGroup` + `readRowsByFile` | CR-01: a key must not cross accounts |
| Column projection / unknown-column drop | a deny-list | `specFor` + `projectRow` + `fileMatchesSpec` | fail-closed, hostile-header safe |
| In-place cache narrowing | a new migration | `narrowStoredNewDataRows` (extend with a category walk) | idempotent, no Dexie bump |
| IP mask | a new mask | `maskIp` / `displayIp` | one formatter, one vocabulary |
| Several account chips | new markup | `accountChipsOf` + `AccountTag` | letter order, `+N`, no ID/nickname attribute |
| Windowed table | virtual-list component | `windowRange`, `ROW_PX`, `shouldWindow` | pure, unit-tested |
| Timestamp parsing | `new Date(...)` | `parseSessionTimestamp` (+ date-only widening) | range-checked, no roll-over, day-first, no zone claim |
| Reveal state | a per-pane boolean | `reveal-state.ts` / Dashboard `revealChoice` | two booleans can disagree |
| Legacy-cache test seeding | ad-hoc Dexie writes | the `seedLegacyUnsupportedRows` pattern (`multi-account-lifecycle.test.ts:795-830`) | real `check-cache` path |
| Test harness | a new worker harness | `tests/helpers/worker-harness.ts` | used by every worker test |

**Key insight:** every strip, grouping, mask and window rule already exists as a function. The Phase 12 risks are scope errors: folder vs file vs category, one account vs a group, header-only vs value-level, and forgetting a consumer (identity pools, `PANE_ORDER`, ternaries, pinned `Bans` tests).

## Runtime State Inventory

This phase changes the stored row shape of live files and the status of six folders, so all five categories are answered.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Every existing v1.1 cache holds the three history files in `user_info` with all columns except `LOGIN`/`BIRTH_DATE*` (F1). A v1.0 cache first opened by a Phase 12 build may still hold raw rows of the six promoted folders and of `Game_Forums` (the latter is purged by D-21; the six are not once promoted) | Code edit for new imports **plus** data narrowing: `narrowStoredNewDataRows` name walk covers the three history files; add the category walk for the six folders (F2). Idempotent, no Dexie bump (`db.verno` stays 2, pinned by `db.test.ts`) |
| Live service config | None. No server, no hosted state | None |
| OS-registered state | None | None |
| Secrets/env vars | None. CSP `connect-src 'self'` and the ESLint network ban are untouched | None |
| Build artifacts | None (no package, no geo asset touched) | None |

**Canonical question answered:** after every file is updated, only IndexedDB caches written before the allowlist still hold the old shape; narrowing plus read-time use of spec keys makes them safe to render, and the narrowing walk removes them at rest. Presence facts of narrowed groups are rewritten in the same transaction (`db.ts:1279-1322`), so list counts stay truthful.

## Common Pitfalls

### Pitfall 1: promoting folders breaks unrelated tests
**What goes wrong:** about fifteen tests treat `Bans` as the unknown folder (Finding 7). **How to avoid:** migrate the stand-in in the same task as the `categories.ts` edit. **Warning sign:** `'unknown'` expectations failing in `dashboard-status`, `replay-reclassify`, `ingest-worker`.

### Pitfall 2: unknown file inside a promoted folder is stored raw
Name-only family (F2). **Avoid:** category-scoped family; test: an unlisted file in `Bans/` stores nothing and records a `skipped`-shaped fact.

### Pitfall 3: v1.0 raw rows survive promotion
The purge no longer covers the six folders (F2). **Avoid:** category narrowing walk; legacy-shaped seed test.

### Pitfall 4: a history file becomes the account's nickname
F4. **Avoid:** exclude family files from both fallback pools; test identity with history files only.

### Pitfall 5: the optional-pane ternaries
`optionalPaneEntry` and `zero-network.spec.ts` choose by `=== 'heat'`; the two new panes silently inherit the Warships summary and test id. **Avoid:** `switch`; `${pane}-block`; a unit test that each of the four ids yields its own summary.

### Pitfall 6: `PANE_ORDER` spreads the optional ids
UI-SPEC order differs (Perks after Payments, Timeline above Account). **Avoid:** explicit tuple; update `selection-state.test.ts:540` and `list-pane-optional.test.ts:71` with it.

### Pitfall 7: one account per row
`NewDataRowView.account` is a single string. **Avoid:** `accounts[]`; `{#each}` over rows is index-keyed and every new keyed `{#each}` needs a row in the AUDITED table of `tests/unit/import/multi-account-keys.test.ts` `[VERIFIED: 11-RESEARCH Pitfall 12; NewDataTable.svelte keyed-by-position comment]`.

### Pitfall 8: date format unknown
`parseSessionTimestamp` accepts only the ISO shape and `DD.MM.YYYY HH:MM`. A date-only or other shape sorts last. **Avoid:** widen deliberately (date-only ISO and dotted, same range checks, day-first), keep display text verbatim, and take the shape from the Wave 0 answer; never swap day and month.

### Pitfall 9: the header script leaks a code
F8 / script item 2. **Avoid:** code-shape guard and a headerless-coupon canary in the guard test.

### Pitfall 10: the toggle appears with nothing to mask
**Avoid:** render condition on rendered maskable values (`address` or `code` kinds) as in `HeatPane`; one explicit `aria-live` per pane (UI-SPEC Accessibility).

### Pitfall 11: a masked value in an attribute
`title`, `aria-label`, test ids and `data-*` must never carry a code, IP or name `[CITED: 12-UI-SPEC.md Surface 4]`. **Avoid:** formatter returns text only; e2e scans markup, not only text.

### Pitfall 12: the merge changes the headline
List headline and provenance count stored rows (UI-SPEC Recorded Choice 7); the merge note reconciles. **Avoid:** do not publish merged counts on `ClassifyResult`.

### Pitfall 13: log leakage
The new builders must never log a row; log the error object name only (T-06-01 rule) `[CITED: 11-RESEARCH Pitfall 11]`.

## Code Examples

### Registering a spec file (shape only; columns come from the Wave 0 decision table)

```ts
// Source: shape of src/lib/worker/new-data-specs.ts:162-258 [VERIFIED]; the entry below is a PLACEHOLDER
{
  key: 'heat_surveys.csv',
  category: 'surveys',
  // Columns per 12-HEADERS.md. Proposed from the verified capture (F9): QUESTION_ID, SKIPPED_BY_PLAYER, MESSAGE_TS.
  columns: [
    { header: 'QUESTION_ID', id: 'QUESTION_ID', kind: 'text' },
    { header: 'SKIPPED_BY_PLAYER', id: 'SKIPPED_BY_PLAYER', kind: 'text' },
    { header: 'MESSAGE_TS', id: 'MESSAGE_TS', kind: 'date' },
  ],
},
```

### Category-scoped family (PROPOSED)

```ts
// PROPOSED addition beside FAMILY_PATTERNS in new-data-allowlist.ts
export const FAMILY_CATEGORIES: ReadonlySet<string> = new Set([
  'authorized_third_parties', 'bans', 'bonus_codes', 'personal_coupons', 'subscriptions', 'surveys',
]);
export function isFamilyCategory(category: string): boolean {
  return FAMILY_CATEGORIES.has(category.toLowerCase());
}
// ingest.worker.ts: const family = isNewDataFile(resolved.sourceFile) || isFamilyCategory(entry.name);
```

### Value-level email guard (PROPOSED)

```ts
const EMAIL_SHAPE = /[^\s@]+@[^\s@]+\.[^\s@]+/;
// in projectRow, when spec.emailGuard === true:
const value = clampCell(raw[key]);
if (value !== undefined && EMAIL_SHAPE.test(value)) continue; // key stays absent -> "not reported"
out[id] = value;
```

### The reveal-aware cell (extension of the existing function)

```ts
// Source: src/lib/features/new-data/new-data-cell.ts:55-57 [VERIFIED]; the code branch is PROPOSED
if (column.kind === 'address') {
  return { text: displayIp({ ip: String(cell) }, options.revealed), muted: false };
}
if (column.kind === 'code') {
  return { text: options.revealed ? String(cell) : maskCode(String(cell)), muted: false };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Phase 9 research: unknown folders stored raw | Counted, never stored; legacy rows purged on check-cache | Phase 9 D-18/D-21 | D-02 is a regression test, not a promotion |
| Deny-list strip (three columns) in supported folders | Per-file allowlist for new families | Phase 11 D-08 | Phase 12 extends it, plus a value-level guard |
| Reveal inside Login history | One shell-held stamped cell | Phase 11 (11-06) | No new state this phase |
| `PANE_IDS` = nine panes | `PANE_ORDER` with optional panes present only with data | Phase 11 | Phase 12 makes four optional panes and reorders |

**Deprecated/outdated in the inputs:** CONTEXT code-context bullet "The new folders ... are unknown today; each moves to SUPPORTED" is true for six folders only; the three history files are already in a supported folder. UI-SPEC "A6" says Phase 11 closed at 263 tests against a 264 ceiling: confirmed this session.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The three history files (or at least one) carry an email-bearing column or value, so emails are at rest today | Finding 1 | If none, narrowing is still correct and harmless |
| A2 | Real headers, per-kind Entry columns, which columns are codes or addresses, and the date shapes of the eight unverified families | Header-capture plan | Allowlists and mapping rewritten after the checkpoint; fixtures use the captured names |
| A3 | A mixed letters-and-digits token of six or more characters without an underscore is never a legitimate header here | Header-capture plan item 2 | A legitimate header prints `[suppressed]`; the user pastes it by hand |
| A4 | Email-shape regex `[^\s@]+@[^\s@]+\.[^\s@]+` is an adequate defensive heuristic | Finding 5 | A malformed email or a name containing `@.` is mishandled; a false positive only blanks one cell |
| A5 | Identical rows within the same account must stay separate (merge only across accounts, occurrence-indexed) | Question 4 | If the user wants any identical rows collapsed, drop the occurrence index |
| A6 | `PLAYER_ANSWER` of `HEAT_Surveys.csv` may be free text, so it is excluded by default; `PROFILE_ID` and `BATTLE_ID` excluded | Finding 9 | A survey card shows fewer columns than the user hoped; widening costs a cache rebuild |
| A7 | Codes and IPs stored in clear in the user's own IndexedDB is acceptable (same class as session IPs); D-13 requires a reveal so it cannot be avoided | Question 5 | Would need a different reveal design (rejected by D-13) |
| A8 | Name-history values (past nicknames) are shown in clear text; D-01 only decided emails | Summary / UI | If nicknames should be masked, the timeline needs a mask kind for them; UI-SPEC does not specify one |
| A9 | Ordering newest first (UI-SPEC Recorded Choice 2) and the list order (Choice 1) are accepted | Panes | Tuple edits |
| A10 | Real files are small, so windowing is only provable on a synthetic fixture | Question 6 | None; D-15 binds regardless |
| A11 | Chromium cannot launch in the agent sandbox (STATE.md note); e2e runs on the user's machine or CI | Validation | Verification delegated to the user |
| A12 | CI wall time at one worker is unmeasured; the budget model's 5 s per test is an estimate | Question 6 | A later raise |

## Open Questions (RESOLVED)

All seven are closed for planning. Q1 is deferred to the Wave 0 checkpoint by design; Q2 to Q7 were decided by the orchestrator defaults and are recorded in the plans named below.

1. **Headers and file names for eight families (BLOCKER for specs, not for infrastructure).** (RESOLVED: deferred to the Wave 0 checkpoint, plan 12-01 Task 2 (the user runs `header_capture_12.py` and answers names-only questions) and Task 3 (transcription, decision tables, Pane mapping, completeness gate). Header-independent infrastructure lands in plans 12-02 to 12-07 in parallel; the specs, builders and fixtures that need the names are plans 12-08, 12-10, 12-11 and 12-13, which read the committed capture.)
   - Known: `HEAT_Surveys.csv` header; the five file names cited from Phase 9; the six folder names.
   - Unknown: every other header; the file names in `Bans`, `Authorized_Third_Parties`, `Personal_Coupons`, `Bonus_Codes`; delimiters; date shapes; which values may be email-like.
   - Recommendation: Wave 0 script + checkpoint above. Block spec, label-map, fixture and mapping tasks on it.

2. **Same-account identical rows: merge or keep separate?** (RESOLVED: keep separate, orchestrator default 2; the occurrence-indexed merge is plan 12-05 Task 1 and is used by plans 12-10 and 12-11. The checkpoint also asks whether any file repeats identical rows within one account, informational.) Recommendation: keep separate (A5); confirm in the checkpoint reply or in plan-check.

3. **`PLAYER_ANSWER` of surveys.** (RESOLVED: excluded by default, orchestrator default 3; the user states in the plan 12-01 checkpoint whether it is a rating, rule (h) in 12-01 and plan 12-08 Task 2 widen the spec only on that statement, and the risk-answer lint in 12-08 enforces it.) Recommendation: exclude by default (A6); ask the user to say whether it is a rating or free text during the checkpoint (names-only answer is enough, no value pasted).

4. **Nicknames in name history shown in clear.** (RESOLVED: shown in clear, only emails are stripped, orchestrator default 4; plan 12-01 rule (c) admits past nicknames in the name history file only, plan 12-08 records the deliberate relaxation of the v1.0 nickname-once rule for the Account timeline pane, and plans 12-12 and 12-13 prove they are page text and never an attribute.) D-01 covers emails only. Recommendation: show as written (the requirement is to show name history); flag for confirmation (A8).

5. **Value-level email guard scope.** (RESOLVED: the nine Phase 12 specs only, orchestrator default 5; the `emailGuard` flag is plan 12-06 Task 1, set on all nine specs by plan 12-08.) Recommendation: the nine Phase 12 specs only (flag on `SpecFile`); applying it to Phase 11 specs would re-narrow existing caches for no known gain.

6. **Tie-break by identity-header order.** (RESOLVED: add `accounts` to `RowsSnapshot`, orchestrator default 6; plan 12-11 Task 2.) Recommendation: add `accounts` to `RowsSnapshot` (option a) so the worker sorts once.

7. **Budget path.** (RESOLVED: raise to 32 / 34 / 42 min with two new listed tests, orchestrator default 7; plan 12-03 raises the three limits together and pins a 273-test ceiling, plan 12-13 adds the two listed tests (265 total) and the zero-network stage.) Raise to 32 / 34 / 42 with two new listed tests (recommended), or one test and no raise. Decide at planning; both are internally consistent.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | build, tests | yes | v26.12.0 | none needed |
| pnpm | scripts | yes | 12.6.0 | none needed |
| Python 3 | header-capture script and its guard test | yes | 3.15.0 | run on a machine with python3 before the checkpoint |
| vitest, playwright, eslint, prettier, tsc, svelte-check | validation | yes (`pnpm exec playwright test --list` ran) | project-pinned | none needed |
| Chromium for Playwright | e2e | not probed; may not launch in a sandbox `[ASSUMED]` | none | run e2e on the user's machine or CI |
| Real export zip (content or names) | header allowlists, file names | no (permission classifier denied directory listing and content reads) | none | Wave 0 `checkpoint:human-action` |
| Web search | none required | not used | none | none |

**Missing dependencies with no fallback:** none technical; header names need the user.
**Missing with fallback:** Chromium in sandboxes.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (Node env, no DOM, `tests/unit/**/*.test.ts`) and Playwright (`chromium`, `chromium-mobile`) |
| Config file | `vitest.config.ts`, `playwright.config.ts` |
| Quick run command | `pnpm exec vitest run tests/unit/import/new-data-allowlist.test.ts` (per file) |
| Full suite command | `pnpm run test:unit && pnpm exec playwright test` (project `test_command`); also `pnpm run check`, `pnpm run lint`, `pnpm run build` |

`[VERIFIED: package.json scripts lines 9-15, .planning/config.json workflow.test_command]`. Svelte components are tested as **source-shape guards** under Node (no DOM) plus Playwright for rendered claims (`tests/unit/new-data/new-data-blocks.test.ts` pattern).

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PRIV-01 (D-03) | Per spec file (nine): canary in non-allowlisted columns AND an email planted in every allowlisted cell absent from `db.rows` and `db.meta`; allowlisted values present; duplicate header and surplus cell absorbed | unit (real worker + fake IndexedDB) | `pnpm exec vitest run tests/unit/import/new-data-allowlist.test.ts` | extend (per-key matrix is `it.each(SPEC_KEYS)`) |
| PRIV-01 | Unlisted file inside a promoted folder stores nothing; misfiled name in wrong category stores nothing | unit | same file | extend |
| PRIV-01 (D-02) | `Game_Forums` not in `SUPPORTED`/`FAMILY_CATEGORIES`; forum email/IP canaries absent after import and after legacy purge | unit | `pnpm exec vitest run tests/unit/import/multi-account-import.test.ts tests/unit/import/multi-account-lifecycle.test.ts` | exists, keep green + new guard |
| PRIV-01 (D-14 pattern) | Legacy raw rows (3 history files in `user_info`; 6 promoted categories, no `account` field) narrowed/deleted on check-cache; second run is a no-op; facts rewritten | unit | `pnpm exec vitest run tests/unit/import/new-data-narrow.test.ts` | extend |
| TIMELINE-01 | Kind mapping, Language/Country split, newest-first order with undated last and the tie-break chain, stable between plain and windowed | unit (pure builder) | `pnpm exec vitest run tests/unit/account-timeline/timeline-aggregate.test.ts` | Wave 0 gap |
| TIMELINE-01/02, D-10/D-11 | Merge only on equality of every allowlisted column, only the three files, occurrence-indexed, `k` equals stored minus displayed, `__proto__` account root safe | unit | same | Wave 0 gap |
| TIMELINE-01/02 | `account-timeline` channel states per file: ready / not-in-export / no-rows / skipped; `isDataQuery` rejects smuggled fields | unit (worker) | `pnpm exec vitest run tests/unit/import/account-timeline-worker.test.ts` | Wave 0 gap |
| TIMELINE-02, PERKS-02 | `address`/`code` kind masked in the view contract; `maskCode` truth table (8+ chars, short, empty, non-string, surrogate pairs, never throws, never longer than 5 chars) | unit | `pnpm exec vitest run tests/unit/new-data/code-mask.test.ts`, `tests/unit/geo/ip.test.ts` | Wave 0 gap / exists |
| PERKS-01..03 | `perks` channel: four cards in fixed order each with its own state; Surveys narrow table; Subscriptions merged | unit | `pnpm exec vitest run tests/unit/import/perks-worker.test.ts` | Wave 0 gap |
| D-05, D-09 | List rows and Overview cards only when files exist, order per UI-SPEC, footer loses the six folders and keeps `Game_Forums`, replay re-derives | unit | `tests/unit/shell/selection-state.test.ts`, `overview-model.test.ts`, `dashboard-status.test.ts`, `list-pane-optional.test.ts`, `import/replay-reclassify.test.ts` | exists, edit pins |
| F4 | History files only: `identity === null`, no Account record, import and rebuild agree | unit | `pnpm exec vitest run tests/unit/import/ingest-worker.test.ts` | extend |
| UI copy | Every UI-SPEC string pinned; label maps complete (walk the spec table) | unit | `pnpm exec vitest run tests/unit/shell/ui-copy.test.ts` | extend |
| Source guards | Both panes: one `aria-live`, no `title`/`aria-label` carrying values, index-keyed `{#each}`, AUDITED rows | unit | `tests/unit/new-data/*`, `tests/unit/import/multi-account-keys.test.ts` | extend |
| Header script | Never prints a value, code-shaped token, `Account_Info`/`Game_Forums` content | unit (spawns python3 on a synthetic zip) | `pnpm exec vitest run tests/unit/guards/header-capture-script-12.test.ts` | Wave 0 gap |
| PRIV-02, D-15 | Zero requests, one worker, no CSP violation while opening both panes (extend the existing long test; ids `${pane}-block`) | e2e | `pnpm exec playwright test guards/zero-network` | exists, extend |
| PRIV-01 rendered | Planted email in every file absent from text and markup of both panes; code and IP absent while masked, present after reveal, re-masked after reload/new dataset; toggle shared with Login history | e2e | `pnpm exec playwright test shell/account-timeline-perks` | Wave 0 gap |
| SCALE-01, D-15 | Large synthetic fixture: >500 merged entries windowed, DOM node count bounded by the window plus two spacers, no per-row SVG | e2e (node count) + unit (`windowRange`) | same spec | Wave 0 gap |
| Layout | 375px: chips wrap to two lines, no horizontal page scroll, 44px targets | e2e | same spec | Wave 0 gap |
| Budget | Listed tests within the ceiling or all three limits raised together | unit guard | `pnpm exec vitest run tests/unit/guards/ci-budget.test.ts` | exists, edit pins |

### Sampling Rate
- **Per task commit:** the touched file's Vitest file (about 10 s).
- **Per wave merge:** `pnpm run test:unit && pnpm run check && pnpm run lint`.
- **Phase gate:** full unit suite, `pnpm run build`, `pnpm exec playwright test --list` count against the budget, then the e2e suite on a machine that can launch Chromium, before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `header_capture_12.py` + `tests/unit/guards/header-capture-script-12.test.ts`; the checkpoint; `12-HEADERS.txt`, `12-HEADERS.md`; names-only additions to `tests/fixtures/new-data-headers.ts`.
- [ ] `tests/fixtures/new-data-fixtures.ts` additions: one synthetic comma-delimited file per spec key (captured headers, canary columns, a second row with an email in every allowlisted cell, drifted-header copy, header-only copy, a bare-CR copy), a generator for a few-thousand-row merged timeline, and a **new** `buildAccountTimelinePerksExport` builder in `multi-account-fixtures.ts` (three accounts; identical Subscriptions/services/language rows across two of them, one differing row, an unlisted file in a promoted folder, a `Game_Forums` file, a legacy-shaped seed helper).
- [ ] New unit files: `tests/unit/account-timeline/timeline-aggregate.test.ts`, `tests/unit/import/account-timeline-worker.test.ts`, `tests/unit/import/perks-worker.test.ts`, `tests/unit/new-data/code-mask.test.ts`; extensions of the allowlist, narrow, facts, selection-state, overview-model, dashboard-status, ui-copy, ci-budget and multi-account-keys tests.
- [ ] `tests/e2e/shell/account-timeline-perks.spec.ts` (and the zero-network extension).
- [ ] Migrate every `Bans` stand-in (Finding 7) in the same task as the `categories.ts` change.

## Security Domain

`security_enforcement` is enabled (`security_asvs_level: 1`, `security_block_on: high`) `[VERIFIED: .planning/config.json workflow]`.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication / V3 Session | no | no accounts, no backend |
| V4 Access Control | no | single user, local |
| V5 Input Validation | **yes** | Allowlist projection by canonical header; 200-char clamp; value-level email guard; `isDataQuery` strict predicate for two new fieldless channels; file names printed only via a constant label table |
| V6 Cryptography | no | none added |
| V7 Error handling and logging | yes | Fixed error sentences (`TIMELINE_ERROR`, `PERKS_ERROR`); never log a row |
| V8 Data protection | **yes** | Minimise at rest (allowlist, narrowing, email guard), codes and IPs masked until the one reveal, no value in attributes/titles/logs |
| V14 Configuration | yes | No new network path; ESLint network ban and CSP `connect-src 'self'` unchanged |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Email in a non-allowlisted column | Information disclosure | Not on the spec, never stored; per-header canary test |
| Email as the *value* of an allowlisted column | Information disclosure | Value-level email guard on the nine specs; email planted in every allowlisted cell in the matrix (F5) |
| Unlisted/misfiled file inside a promoted folder stored raw | Information disclosure | Category-scoped family; `specFor` with the row's own category (F2) |
| v1.0 raw rows of newly promoted folders survive | Information disclosure | Category walk in `narrowStoredNewDataRows` (F2) |
| Hostile header (`__proto__`, huge, BOM, padded) reaching a stored key | Tampering | Output keys are spec constants; `Map`-based resolution `[VERIFIED: new-data-allowlist.ts:31-38]` |
| Hostile zip entry or nickname in a caption | Spoofing/XSS | Captions from `NEW_DATA_FILE_LABELS` keyed by record type; nickname only as `.visually-hidden` text; text interpolation only |
| Code or IP in DOM attribute, `title`, `aria-label`, log while masked | Information disclosure | Formatter returns text; e2e scans markup, `document.title`, console |
| Header script prints a code or value | Information disclosure | Identifier-only plus code-shape guard; guard test with planted canaries |
| Historic nickname becomes the account identity | Spoofing | Family files excluded from identity pools (F4) |
| Oversized table or row flood | DoS | Windowing, per-cell clamp, `MAX_PRESENCE_FILES = 500` per account `[VERIFIED: db.ts:308 (grep)]` |
| Account root named `__proto__` in the merge map | Tampering | `Map`, never an object (T-09-27) |
| Residual: a free-text allowlisted value containing personal data other than an email | Information disclosure | Accepted residual (same class as T-bog-07); keep allowlists to enumerations, dates, flags, ids; the checkpoint question (step 3) flags free-text columns |

## Sources

### Primary (HIGH confidence)
- This repository, files opened this session: `src/lib/worker/{categories,new-data-specs,new-data-allowlist,new-data-facts,csv-columns,data-queries,identity (340-460, 60-100),ingest.worker (95-135, 660-760, 1000-1340),db (40-130, 196-290, 740-795, 880-950, 1070-1325)}.ts`, `src/lib/shell/{selection-state (70-410),reveal-state (1-60),Dashboard (300-520)}`, `src/lib/features/new-data/{new-data-shared,new-data-aggregate,new-data-cell,NewDataTable (1-80, 225-260)}`, `src/lib/features/logins/LoginTable.svelte (150-215)`, `src/lib/features/playtime/playtime-aggregate.ts (126-181)`, `src/lib/geo/ip.ts`, `src/lib/ui-copy.ts (3355-3375, 3435-3455, 3765-3800)`, `tests/unit/import/{new-data-allowlist,multi-account-import,multi-account-lifecycle}.test.ts` (selected ranges), `tests/unit/guards/{ci-budget,header-capture-script,new-data-headers}.test.ts` (selected ranges), `tests/e2e/guards/zero-network.spec.ts (440-530)`, `tests/e2e/shell/{new-data-panes,identity-privacy}.spec.ts` (selected ranges), `tests/fixtures/{new-data-headers,multi-account-fixtures}.ts` (selected ranges), `.planning/phases/11-new-game-data/{11-RESEARCH,11-HEADERS.md,11-HEADERS.txt,header_capture.py,11-02-PLAN.md (checkpoint)}`, `.planning/phases/09-multi-account-import-account-identity/09-RESEARCH.md (Real Sample Shape)`, `12-CONTEXT.md`, `12-UI-SPEC.md`, `REQUIREMENTS.md`, `ROADMAP.md`, `.planning/config.json`, `.claude/skills/sketch-findings-wot-gdpr-stats-visualizer/SKILL.md`.
- Tool output this session: `pnpm exec playwright test --list` -> `Total: 263 tests in 30 files`; node v26.12.0, pnpm 12.6.0, Python 3.15.0.

### Secondary (MEDIUM confidence)
- `grep -n` single-line matches tagged `[GREP]` (CI limit lines in `playwright.config.ts` and `ci.yml`); the planner should Read those lines before quoting them into a plan action.

### Tertiary (LOW confidence)
- Training-knowledge expectations about what the eight unread files contain (all tagged `[ASSUMED]`, none stated as fact).

**Provenance note:** `[VERIFIED: path:lines]` means the file region was read in full this session (Read tool, or `sed`/`cat` over the whole region). A single-line `grep` match is tagged `[GREP]`. Not read, and not claimed: any cell value, any header of the eight unverified families, any file name inside `Bans`, `Authorized_Third_Parties`, `Personal_Coupons`, `Bonus_Codes`. A names-only listing of the extracted export directory was denied by the permission classifier; no workaround was attempted.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH, no new dependencies.
- Architecture: MEDIUM-HIGH, built on code read this session; pane and builder shapes are recommendations.
- Allowlist contents: **LOW** except `HEAT_Surveys.csv` (VERIFIED header, proposed columns ASSUMED), blocked on the Wave 0 capture.
- Storage hazards (F1-F4): HIGH for the code facts; the existence of email columns is `[ASSUMED]`.
- Pitfalls: HIGH for code-derived ones, MEDIUM for fixture ones.
- CI budget: HIGH (measured count, pinned constants read); the 273 ceiling is derived arithmetic, recompute with the guard's own function when pinning.

**Research date:** 2026-10-20
**Valid until:** 30 days for code facts; the Wave 0 capture must close before any allowlist task is planned.
