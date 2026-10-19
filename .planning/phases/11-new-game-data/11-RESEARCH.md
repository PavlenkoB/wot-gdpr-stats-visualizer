# Phase 11: New Game Data - Research

**Researched:** 2026-10-19
**Domain:** Client-side allowlist parsing at the worker choke point, Dexie presence facts, a shell pane model with conditional rows, game-filter extension, Svelte 5 tables (no new dependencies)
**Confidence:** HIGH for the code paths, the file inventory and the CI limits; MEDIUM for the architecture recommendations; **LOW / BLOCKED for the column allowlists: the real export's column headers could NOT be read this session** (see "Blocking Gap")

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** HEAT gets its own list row ("HEAT") in the master-detail shell, shown only when the export holds HEAT data. Battle types, account stats, storage and geolocation live in that pane. — **Reversibility:** reversible — **Reversibility rationale:** a list entry and a component; no storage or schema.
- **D-02:** WoWP account stats and plane stats go inside Vehicles under the existing Warplanes title (the Vehicles-local fourth title). A title absent from an account shows an empty state, never an error.
- **D-03:** WoWS crews and account storage get their own list row ("Warships crews & storage"), not Vehicles blocks. Every row carries the account tag chip (Phase 10 D-10).
- **D-04:** HEAT pane layout and geolocation handling were not discussed; default: stacked cards in the pane, geolocation addresses reuse the existing masking and single global reveal, and HEAT addresses do not feed the Logins map or country list. Planner may refine; any IP shown must stay masked until the global reveal.
- **D-05:** HEAT and WOTC are appended to `GAME_FILTER_TOKENS` (the Phase 10 D-05 extension point). Playtime narrows for them like any other game: extend the stored per-game aggregates (`byGame`, `games`) and bump `PLAYTIME_VERSION` so lazy rebuilds agree with import-time aggregates. A chip shows only when that game has sessions in the data. — **Reversibility:** costly — **Reversibility rationale:** a stored aggregate version bump; reverting forces another rebuild and the pinned playtime version test encodes the number.
- **D-06:** With the filter on HEAT or WOTC, Vehicles keeps its last title and shows a one-line note that this game has no vehicle table (same pattern as Warplanes being Vehicles-local). The shared filter is not cleared by Vehicles.
- **D-07:** The filter stays on Playtime and Vehicles only. Finance and Logins do not react to it (Phase 10 D-02 stands).
- **D-08:** Every new category uses a per-file column allowlist: only named columns are stored; any other column, including unknown or drifted ones, is dropped before storage. One unit test per file header plants a synthetic email and asserts it reaches neither IndexedDB nor any rendered pane (PRIV-01). — **Reversibility:** costly — **Reversibility rationale:** allowlists define the stored row shape; widening later needs a cache rebuild.
- **D-09:** If a file's headers match none of its allowlist, import still succeeds and the pane shows an empty state, with the file named in the pane's provenance line so the user can see it was skipped. No import-summary warning and no import failure.
- **D-10:** Research inspects the real export's column headers only, never cell values, as Phase 9 did, before the allowlists are fixed. Fixtures stay synthetic; the real zip is never committed.
- **D-11:** Zero-network assertions (Playwright) are extended to every new pane (PRIV-02). Any table over a few thousand rows is windowed or aggregated; no per-row SVG nodes.

### Claude's Discretion

- Exact copy, chip and card visuals within the Day 10 shell and sketch findings.
- HEAT pane card order and whether geolocation sits in its own card.
- Allowlist contents once headers are inspected.

### Deferred Ideas (OUT OF SCOPE)

- Filtering Finance or Logins by game.
- HEAT geolocation on the Logins map.
- Game_Forums `EMAIL` handling and other unknown categories (Phase 12 decision on strip vs masked store).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GAMES-01 | HEAT sessions, battle types, account stats, storage and geolocation are shown | HEAT files all sit in already-supported folders (Activity_History, Player_Statistics); allowlist table + new `heat` data channel + pane; HEAT sessions already feed Playtime (see Architecture Patterns 1, 4, 5) |
| GAMES-02 | WoT Console (WOTC) sessions are shown in activity | `WOTC_Game_Sessions.csv` is the only WOTC file; the per-game playtime scope for WOTC already exists; the work is `GAME_FILTER_TOKENS`, copy and tests (Pattern 6) |
| GAMES-03 | WOWP 19 and 20 account and plane stats are shown | Files already read by the Vehicles builder; add an "Account statistics" block under the Warplanes title and a WOWP allowlist that is a superset of the builder's header vocabulary (Pattern 7) |
| GAMES-04 | WoWS crews and account storage are shown | `WOWS_Crews.csv` and `WOWS_Account_Storage.csv` in Player_Statistics; new `warships-storage` channel and pane; every row account-tagged (Pattern 4) |
| PRIV-01 | Every new category goes through the same fail-closed PII strip with unit tests per header | Per-file allowlist projection at the ingest choke point, family-level fail-closed, per-header canary test through the real worker harness (Pattern 1, Validation Architecture) |
| PRIV-02 | Zero network requests after load; Playwright guard extended to new panes | Extend the existing Phase 5/9 zero-network test (adds no listed test); the fixture must carry the new files (Pattern 9, Pitfall 9) |
</phase_requirements>

## Summary

The two premises in CONTEXT that most change the design are both about where the data is today. First, **every HEAT, WOTC, WOWP and WoWS file in the real export sits inside a folder the viewer already classes as supported** (Activity_History, Player_Statistics, Device_Info). Only `HEAT_Surveys.csv` sits in an unknown folder (`Surveys`, Phase 12). So the CONTEXT note that "new categories currently unknown/stored raw" is outdated: since Phase 9 D-18 the unknown folders are counted and never stored, while the supported folders store **every column of every file** behind only the three-column LOGIN/BIRTH_DATE deny-list. The new files are therefore already at rest in IndexedDB today, unfiltered, in every v1.1 cache. The allowlist cannot be a "promote the folder" change; it must be a per-file projection at the ingest choke point, plus a decision about the rows already at rest (Open Question 3).

Second, **the per-game playtime aggregate already carries HEAT and WOTC**: `buildGameScopes` groups usable sessions by whatever token the session file name carries and builds one scope for each, and the three-account fixture's own literals already list `HEAT` and `WOTC` in `games` and `byGame`. D-05's "extend the stored per-game aggregates and bump `PLAYTIME_VERSION`" is therefore not required by the code as it stands: adding the two tokens to `GAME_FILTER_TOKENS` is enough to make the chips and the filtered Playtime work. A bump is harmless (the lazy rebuild exists) but it is a locked-decision conflict the planner must settle with a test first (Open Question 2).

The one thing that blocks fixing the allowlists is evidence: **the permission classifier denied every attempt to read the real zip's contents** (name and size listing was allowed). No header line and no row count for any HEAT, WOTC, WOWP or WoWS file could be read. Section "Blocking Gap" gives the exact script, the exact output that is needed, and a recommended Wave 0 checkpoint. Everything else in this document (pane model, choke point, channels, game filter, budget, tests) is independent of the header names and can be planned now.

**Primary recommendation:** Build one pure `new-data-allowlist` module (per-file specs keyed by lower-cased file name, canonical output headers, family-level "no spec means store nothing"), apply it at the single ingest choke point beside `reduceBlobRow`, record presence facts for the pane files from every category, derive pane presence and counts for the list from those facts on `ClassifyResult`, add two Device-info-style data channels plus a Warplanes block inside the existing vehicle view, and keep `PANE_IDS` at nine with two optional panes so the six e2e specs and the unit tests that iterate it keep passing.

## Blocking Gap: real-export headers could not be read

**What was done, with the denial recorded.** The user approved reading the real export's headers (CONTEXT D-10, restated in the task). Using `python3 -I` with `zipfile`, a listing of entry names and sizes **succeeded**. Four later commands that read entry content (one full-content script with header and line counts, one first-line-only script, one `unzip -p ... | head -n 1 | grep` pipeline, and a first-line-only retry) were each **denied by the auto-mode permission classifier** ("Blocked by fast classifier"). These were not retried further and no workaround was attempted. No cell value, header line or line count of any target file was seen. `[VERIFIED: tool denials this session]`

**What is verified vs not.**

| Item | Status |
|------|--------|
| Entry names, folders and byte sizes of every target file | `[VERIFIED: python3 -I zipfile listing this session]` (table below) |
| Header names of HEAT_*, WOTC (other than sessions), WOWS_Crews, WOWS_Account_Storage | **Unknown** |
| Header names of `*_Game_Sessions.csv` (includes HEAT and WOTC) | `STARTED_AT`, `FINISHED_AT`, `IP` `[CITED: 09-RESEARCH.md:373, read from this same export in Phase 9]` |
| Header names of WOWP_19 plane file (13 columns) | `[CITED: 05-RESEARCH.md:189]` from the **2021** sample; the 2026 files are a different revision |
| Header names of WOWP account files | 2021: `GAMES_PLAYED` / `BATTLES`, `PREMIUM_EXPIRY_TIME`, plus `NAME`; the 2026 account files are 1.1-1.2 KB so carry many more columns than the three the fixtures use `[CITED: 05-RESEARCH.md:190,192; 05-RESEARCH.md:180]` |
| Row counts of any target file | Unknown (sizes only) |

**Why the size matters.** `WOWP_20_Plane_Statistics.csv` is 2,124 and 2,402 bytes in the 2026 export, against a 2021 shape of three columns and six rows (about 60 bytes of data). The Phase 5 decision that WOWP_20 "has no vehicle identifier" and is only a note (D-09 there) may no longer be true; the header must be re-read before the Warplanes block is designed `[CITED: 05-RESEARCH.md:191; sizes VERIFIED this session]`.

### Recommended Wave 0: header-capture checkpoint (`checkpoint:human-action`)

The user (or the orchestrator after the user grants a Bash permission rule for the script path) runs this and pastes the output into a file under `.planning/phases/11-new-game-data/`. Header names and file names are allowed in planning docs and committed synthetic fixtures; cell values never are. The script prints a first line **only** if every token is identifier-like, so a headerless file cannot leak a data cell, and it relabels account folders.

```python
# header_capture.py  (run: python3 -I header_capture.py <zip>)   -- prints names, sizes, header, line count; no cell value
import sys, zipfile, re
path = sys.argv[1]
HDR = re.compile(r'^[\ufeff]?("?[A-Za-z0-9_ ./-]+"?[;,])*"?[A-Za-z0-9_ ./-]+"?$')
FAMILY = re.compile(r'(HEAT_|WOTC_|WOWP_|WOWS_Crews|WOWS_Account_Storage)', re.I)
z = zipfile.ZipFile(path)
ids = sorted({i.filename.split('/')[0] for i in z.infolist() if re.fullmatch(r'\d{4,}', i.filename.split('/')[0])}, key=lambda s: (len(s), s))
label = {x: 'ACCT-' + 'ABCDEFGH'[n] for n, x in enumerate(ids)}
for i in z.infolist():
    if i.is_dir() or not FAMILY.search(i.filename):
        continue
    parts = i.filename.split('/'); parts[0] = label.get(parts[0], parts[0])
    with z.open(i) as fh:
        raw = fh.read().decode('utf-8', errors='replace')
    lines = [l for l in re.split(r'\r\n|\n|\r', raw) if l.strip()]
    first = lines[0].lstrip('\ufeff') if lines else ''
    print('FILE', '/'.join(parts), 'bytes', i.file_size, 'nonempty_lines', len(lines))
    print('  HDR', first if HDR.match(first) else '[first line not identifier-only: suppressed]')
```

The output needed per file: relative path, header tokens in order, delimiter (`;` per the Phase 5 evidence) and non-empty line count (rows = lines minus 1). That is the only input the allowlists, the column-label maps, the canary-test header lists and the windowing fixtures are waiting for.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Per-file column allowlist projection (PII strip) | Worker (ingest choke point) | — | The raw parsed row must never leave the worker; same tier as the LOGIN strip and `reduceBlobRow` |
| Pane presence and counts for list rows | Worker (derived from presence facts, published on `ClassifyResult`) | Browser (renders) | The list issues no worker query (selection-state rule); the worker already owns `meta.files` |
| HEAT and Warships view building | Worker (pure builders over a Dexie snapshot) | Browser (renders cells) | Same split as Device info: cells only cross `postMessage` |
| Warplanes account-statistics block | Worker (extends the vehicle builder) | Browser (`PlayerStats.svelte`) | The WOWP files are already in the vehicle snapshot |
| Game filter tokens, chip row, no-vehicle-table note | Browser (shell `game-filter-state.ts`, `PlayerStats.svelte`) | Worker (per-game scopes, already stored) | The filter is shell component state; the worker only answers a validated token |
| Masking of geolocation addresses | Browser (`maskIp` at render) | Worker (never masks; sends the stored string as Logins does) | Matches the Login history precedent; the reveal state needs lifting (A4) |
| Windowed tables | Browser | — | `windowRange` is pure browser-side arithmetic |
| Zero-network guarantee | CI (Playwright) | ESLint network ban, CSP meta | Unchanged mechanism, extended panes |

## Standard Stack

### Core

No new packages. Every capability is an existing module of this repository.

| Module | Purpose | Why Standard Here |
|--------|---------|-------------------|
| `src/lib/worker/csv-columns.ts` (`headerKey`, `cell`, `AccountRowGroup`) | Header normalisation (trim + upper-case) and per-account row groups | The one normaliser every aggregator uses `[VERIFIED: csv-columns.ts:14-17]` |
| `src/lib/worker/csv-parse.ts` (`parseCsvFile`) | Parse, BOM strip, glued-sensitive-header withhold | Already fail-closed on hidden LOGIN/BIRTH_DATE keys `[VERIFIED: csv-parse.ts:233-270]` |
| `src/lib/features/device-info/*` | Template for a folder-to-pane promotion (shared contract, aggregate, state, table) | Quick task 261012-bog; the UI-SPEC names it the template |
| `src/lib/core/windowing.ts` (`windowRange`, `ROW_PX`) | Windowed rows | `ROW_PX = 40`, `OVERSCAN_ROWS = 6` `[VERIFIED: windowing.ts:22,31]` |
| `src/lib/core/decimal.ts` | Exact sums | Only if a pane totals a monetary-like column |
| `src/lib/shell/AccountTag.svelte` + `identity-model.ts` `accountTagsOf` | Account chips | Inert letter + hidden phrase, no attribute carries an ID |

**Installation:** none. **Version verification:** not applicable.

## Package Legitimacy Audit

No external packages are installed or recommended by this phase, so the gate has no entries. Nothing discovered via web search or training data is used (web search was unavailable this session).

## Current State: How the Worker Stores Files Today

All facts below are from files opened with Read this session.

**1. Storage is decided by category status, not by file.** `const storeRows = entry.status === 'supported';` `[VERIFIED: ingest.worker.ts:1024]`. `SUPPORTED` is `['Activity_history', 'Player_statistics', 'User_Info', 'Payment_history', 'Financial_data', 'Device_info']` and `KNOWN_DEFERRED` is `['Chat_history', 'Clans']` `[VERIFIED: categories.ts:22-29,35]`. Unknown and known-deferred rows are parsed for their counts and never stored (Phase 9 D-18/D-21; the comment at `ingest.worker.ts:1006-1023`, and `purgeUnsupportedCategoryRows` removes legacy rows on check-cache `[VERIFIED: ingest.worker.ts:677; db.ts:1053-1069]`).

**2. In a supported folder every column is stored.** The row choke point (`ingest.worker.ts:1128-1134`) is:

```ts
const raw = parsed.rows[r]!.data;
const data =
  deviceInfo && hasBlobColumn(raw)
    ? reduceBlobRow(raw)
    : userInfo || hasSensitiveColumn(raw)
      ? sanitizeUserInfoRow(raw)
      : raw;
```

so a `HEAT_Session_Geolocation.csv` row is stored as the parsed object (all columns, plus `__parsed_extra`) unless it carries a LOGIN/BIRTH_DATE/BIRTH_DATE_SRC header (`DROPPED_COLUMN = /^(LOGIN|BIRTH_DATE|BIRTH_DATE_SRC)(_\d+)?$/` `[VERIFIED: identity.ts:57]`). `WOWP_*_Account_Statistics.csv` rows therefore sit at rest **with `NAME` (the nickname)**; `05-RESEARCH.md:180` records that the WoT account file also carries `NAME`, `CREDITS`, `GOLD`, `FREE_XP` `[CITED]`.

**3. How the Player_statistics files map for the four games.** The vehicle builder owns sixteen exact lower-cased names. Quoted from `vehicle-aggregate.ts:119-148` `[VERIFIED]`:

```ts
wowp: {
  main: 'wowp_19_plane_statistics.csv',
  byType: null,
  battleTypes: null,
  accounts: ['wowp_19_account_statistics.csv', 'wowp_20_account_statistics.csv'],
  extras: ['wowp_20_plane_statistics.csv'],
},
```

WOT/WOTB/WOWS use `{wot,wotb,wows}_vehicle|ship_statistics[_by_type].csv`, `_battle_types_statistics.csv`, `_account_statistics.csv`. `WOWS_Crews.csv` and `WOWS_Account_Storage.csv` are **not** read by any builder: the 05 fixtures call them "recognised, counted, never shown" `[VERIFIED: player-stats-fixtures.ts:639-649]` and their headers there (`CREW_ID;CREW_TITLE`, `ITEM_ID;ITEM_COUNT`) are invented, not evidence. `HEAT_*` and `WOTC_*` (other than the sessions) are read by nothing.

**4. Presence facts are recorded only for four categories.** `PRESENCE_CATEGORIES = new Set(['player_statistics','financial_data','payment_history', DEVICE_INFO_CATEGORY])` `[VERIFIED: ingest.worker.ts:101-106]`. `Activity_History` is not in it, so `HEAT_Session_Geolocation.csv` (Activity_History) has no presence fact today. A fact is `{ category, sourceFile, rowCount, account? }` `[VERIFIED: db.ts:82-96]`, capped per account by `MAX_PRESENCE_FILES = 500` `[VERIFIED: db.ts:275]`.

**5. Readers.** `DATA_FILES` is the per-channel `{ names, categories }` table; `readRowsByFile(names, categories)` screens the `sourceFile` index by lower-cased name and groups rows per account then file `[VERIFIED: data-queries.ts:84-110; db.ts:866-910]`. `isDataQuery` rejects any extra field on a non-vehicles channel, so new fieldless channels are validated for free once added to `DATA_FILES` `[VERIFIED: data-queries.ts:188,218-236]`. `answerDataQuery` is an exhaustive switch whose default throws `unreachable channel` `[VERIFIED: data-queries.ts:253-308]`.

**6. Cache replay re-derives status from stored names**, never from a stored label: `resultFromMeta` re-runs `classifyFolder` per entry, so promoting a folder needs no Dexie bump `[VERIFIED: ingest.worker.ts:738-762; categories.ts:3-21]`. This phase promotes **no** folder (Pattern 8).

## File Inventory (real export, names and sizes only)

Account folders relabelled by sort order: **ACCT-A** is the account with `WOTC`, `WOWS`, `WOWP_19` and no `User_Info`; **ACCT-B** is the account with HEAT, `User_Info` and `Game_Forums`; **ACCT-C** is the third account. No real account number is written here. `[VERIFIED: python3 -I zipfile listing this session]`

| Path (relative to account folder) | Account: bytes | In supported folder? | Notes |
|---|---|---|---|
| `Activity_History/HEAT_Game_Sessions.csv` | B: 523 | yes | Already feeds Playtime and Logins; header `STARTED_AT`,`FINISHED_AT`,`IP` `[CITED: 09-RESEARCH.md:373]` |
| `Activity_History/HEAT_Session_Geolocation.csv` | B: 502 | yes | **Not** a session file (`sessionFileNameGame` requires `_game_sessions.csv`); stored raw today |
| `Activity_History/WOTC_Game_Sessions.csv` | A: 225 | yes | The only WOTC file |
| `Device_Info/HEAT_Device_Info.csv` | B: 1,502 | yes | Out of the HEAT pane's four cards; unread |
| `Player_Statistics/HEAT_Account_Statistics.csv` | B: 269 | yes | |
| `Player_Statistics/HEAT_Account_Storage.csv` | B: 2,193 | yes | |
| `Player_Statistics/HEAT_Battle_Types_Statistics.csv` | B: 998 | yes | |
| `Surveys/HEAT_Surveys.csv` | B: 653 | **no (unknown)** | Phase 12 (PERKS-03) |
| `Player_Statistics/WOWP_19_Account_Statistics.csv` | A: 1,249 | yes | Contains `NAME` per 2021 shape `[CITED]` |
| `Player_Statistics/WOWP_19_Plane_Statistics.csv` | A: 2,109 | yes | |
| `Player_Statistics/WOWP_20_Account_Statistics.csv` | A: 1,154; B: 1,143 | yes | |
| `Player_Statistics/WOWP_20_Plane_Statistics.csv` | A: 2,124; B: 2,402 | yes | See "Why the size matters" |
| `Player_Statistics/WOWS_Crews.csv` | A: 840; B: 1,308 | yes | |
| `Player_Statistics/WOWS_Account_Storage.csv` | A: 1,844; B: 4,295 | yes | |

ACCT-C holds none of the target files. WOWP_19 exists only in ACCT-A; WOWP_20 exists in A and B; HEAT only in B; WOTC only in A. So "a title absent from an account" (D-02) is the normal real case.

**Consequences for the plan.**
- **Footer (UI-SPEC A5, ROADMAP SC5 clause "folders leave the footer").** No folder is promoted: all target files are in supported folders already, and `HEAT_Surveys.csv` belongs to Phase 12. The clause is vacuous for this export; pin it with a test (the footer derivation `unsupportedEntries` must not change) instead of building a promotion.
- **Scale.** The real files are tiny (the largest, `WOWS_Account_Storage.csv`, is 4.3 KB). The >500-row windowing and any "few thousand rows" proof must come from a **synthetic large fixture**, not from the real sample.

## Per-file Allowlist Proposal (column names UNVERIFIED unless tagged)

The projection stores values under the **canonical header the spec names** (never the file's own spelling), matched through `headerKey`. Duplicate-suffixed keys (`NAME_1`), the `__parsed_extra` overflow and every unmatched header are dropped.

| File (lower-cased key) | Pane | Columns to allow | Evidence |
|---|---|---|---|
| `heat_game_sessions.csv`, `wotc_game_sessions.csv` | Playtime / Logins (existing) | `STARTED_AT`, `FINISHED_AT`, `IP` | `[CITED: 09-RESEARCH.md:373]`. Keep the fixture aliases `SESSION_START`,`SESSION_END` only if a fixture needs them (`resolveSessionColumns` accepts `SESSION_START/STARTED_AT`, `SESSION_END/FINISHED_AT`, `SERVER_NAME`, `CLIENT_PLATFORM` `[VERIFIED: playtime-aggregate.ts:323-328]`) |
| `heat_session_geolocation.csv` | HEAT / Geolocation | **Header unknown.** Policy proposal: a timestamp column, a country-level column, and an address column **only if** it goes through `maskIp`; **never** latitude, longitude, city or postal columns | `[ASSUMED]` (Open Question 4) |
| `heat_account_statistics.csv` | HEAT / Account statistics | **Header unknown.** By analogy with `WOTB_Account_Statistics` (`BATTLES_COUNT`, `PREMIUM_EXPIRY_TIME`); **exclude `NAME`** | analogy `[ASSUMED]`; WOTB shape `[CITED: 05-RESEARCH.md:184]` |
| `heat_battle_types_statistics.csv` | HEAT / Battle types | **Header unknown.** Analogous files carry `TYPE`, `BATTLES_COUNT`, `WINS`, `DAMAGE_DEALT` | analogy `[ASSUMED]`; WOTB/WOWS `[CITED: 05-RESEARCH.md:183,187]`. The real file is 998 B, so it has more columns |
| `heat_account_storage.csv` | HEAT / Storage | **Header unknown** | — |
| `wows_crews.csv` | Warships / Crews | **Header unknown** (the repo fixture header is invented) | — |
| `wows_account_storage.csv` | Warships / Account storage | **Header unknown** (same) | — |
| `wowp_19_plane_statistics.csv` | Vehicles (existing builder) | `VEHICLE_NAME`, `GAMES_PLAYED`, `WINS`, `TOTAL_DAMAGE_DEALT`, `TOTAL_KILLED`, `GAIN_EXPERIENCE`, `SURVIVED`, `TOTAL_HITS`, `TOTAL_SHOTS`, `MAX_DAMAGE_DEALT`, `MAX_GAIN_EXPERIENCE`, `LAST_GAME_TIME`, `IN_GARAGE` | `[CITED: 05-RESEARCH.md:189]` (2021) |
| `wowp_20_plane_statistics.csv` | Vehicles note | `BATTLES`, `WINS`, `IN_GARAGE` and any vehicle-identifier column found on re-read | 2021 `[CITED: 05-RESEARCH.md:191]`; **re-read required** |
| `wowp_19_account_statistics.csv` | Vehicles header + new block | `GAMES_PLAYED`, `PREMIUM_EXPIRY_TIME` + non-identifying statistics found on re-read; **exclude `NAME`** | `[CITED: 05-RESEARCH.md:190]` |
| `wowp_20_account_statistics.csv` | same | `BATTLES`, `PREMIUM_EXPIRY_TIME` + as above; **exclude `NAME`** | `[CITED: 05-RESEARCH.md:192]` |

**Hard constraint on the WOWP rows (Pitfall 2).** The Warplanes view reads the shared `ALL_FIELDS` vocabulary `[VERIFIED: vehicle-aggregate.ts:319-379]`. Quoted headers: `VEHICLE_NAME`; `BATTLES_COUNT`,`BATTLES`,`GAMES_PLAYED`; `WINS_COUNT`,`WINS`; `DAMAGE_DEALT`,`TOTAL_DAMAGE_DEALT`; `FRAGS_COUNT`,`FRAGS`,`TOTAL_KILLED`; `XP_AMOUNT`,`XP`,`EXP`,`GAIN_EXPERIENCE`; `SURVIVED_BATTLES`,`SURVIVED`; `HITS_COUNT`,`HITS`,`TOTAL_HITS`; `SHOTS_COUNT`,`SHOTS`,`TOTAL_SHOTS`; `DAMAGE_MAX`,`MAX_DAMAGE_DEALT`; `FRAGS_MAX`,`MAX_FRAGS`; `XP_MAX`,`MAX_XP`,`MAX_EXP`,`MAX_GAIN_EXPERIENCE`; `DAMAGE_RECEIVED`; `SPOTTED_COUNT`,`SPOTTED`; `PLANES_KILLED`; `DISTANCE`; `LAST_BATTLE_AT`,`LAST_BATTLE_TIME`,`LAST_GAME_TIME`; `IN_GARAGE`; and the WOWP-20 note's `BATTLES`. Any column of a WOWP file in this list that is missing from its allowlist silently turns that column into "not in export" in the shipped vehicle table. A unit test must assert allowlist ⊇ builder vocabulary for each WOWP file.

**Identifier-like and PII-like candidates to plant in the per-header canary test** (names only, all `[ASSUMED]` as to whether the real files carry them): `NAME`, `NICKNAME`, `LOGIN`, `EMAIL`, `E_MAIL`, `BIRTH_DATE`, `ACCOUNT_ID`, `SPA_ID`, `USER_ID`, `IP_ADDRESS`, `PHONE`, `LATITUDE`, `LONGITUDE`, `CITY`, an unknown future column, a surplus cell beyond the header (`__parsed_extra`), a BOM-prefixed and a padded/lower-case copy of an allowlisted header, a duplicated header (`NAME_1`), and a header named `__proto__`.

## Architecture Patterns

### System Architecture Diagram

```
zip bytes ──> listEntryPaths ──> analyzeExport (N roots, unchanged)
                                      │
                      unzipSync(filter = resolveCsvFileOwner)  (unchanged)
                                      │
                       parseCsvFile (BOM, mixed CR/LF, glued-LOGIN withhold)
                                      │
        ┌─────────────────────────────┴──────────────────────────────┐
        │ ingest choke point (per row)                                │
        │   spec = specFor(category, sourceFile)   <── NEW            │
        │   family file, no spec        -> store NOTHING (fail closed)│
        │   spec, no header matched     -> store nothing, mark skipped│
        │   spec, matched               -> projectRow(raw, spec)      │
        │   else (existing)             -> reduceBlobRow / sanitize   │
        └─────────────────────────────┬──────────────────────────────┘
                                      │ presence fact per pane file (ALL categories, NEW)
                                      ▼
          Dexie: rows(account, canonical headers only) + meta.files (+parsedRowCount)
                                      │
     ┌───────────────┬────────────────┼──────────────────┬──────────────────┐
     ▼               ▼                ▼                  ▼                  ▼
 resultFromMeta  data-query heat   data-query wows-    data-query         playtime-query
 + finalResult   (builder -> view  storage (builder    vehicles (+ wowp   (stored byGame,
 (newDataPanes)  cells + account)  -> cells + account) account block)     game = HEAT|WOTC)
     │               │                │                  │                  │
     ▼               ▼                ▼                  ▼                  ▼
 paneEntries ─> ListPane/Overview   HEAT pane      Warships pane     PlayerStats (Warplanes)  Playtime chips
 (rows only if                      (4 cards,      (2 cards)         + no-vehicle-table note  (GAME_FILTER_TOKENS
  pane facts)                       mask toggle)                                                + WOTC, HEAT)
```

### Recommended Project Structure

```
src/lib/worker/new-data-allowlist.ts        # NEW: specs, family predicate, projectRow (pure, no imports but csv-columns)
src/lib/features/new-data/                  # NEW, copies features/device-info/
├── new-data-shared.ts                      #   no-import contract: file keys, column ids, canonical headers, labels, bounds, view types
├── new-data-aggregate.ts                   #   pure builders: buildHeatView, buildWowsStorageView
├── new-data-state.ts                       #   pane summaries / provenance
├── NewDataCard.svelte                      #   card (title, caption, four states)
├── NewDataTable.svelte                     #   plain <= 500 rows, windowed above (windowRange, ROW_PX)
├── HeatPane.svelte
└── WarshipsStoragePane.svelte
```

### Pattern 1: per-file allowlist projection at the choke point (PRIV-01, D-08)

**What:** a pure module with a spec table keyed by lower-cased file name and a family predicate.
**When to use:** for every row of every file whose name is in the new-game family, **whatever folder it was filed under**.
**Fail-closed rules (all testable):**
1. `isNewDataFile(sourceFile)` is name-based: `/^(heat|wotc)_/`, `/^wowp_(19|20)_/`, and the two WoWS names. A family file with **no spec** (for example `heat_device_info.csv`) stores nothing. Folder is irrelevant, so a misfiled copy cannot dodge it (the folder is attacker-controlled; this is the same argument as CR-01 layer 2 in the existing choke point comment `[VERIFIED: ingest.worker.ts:1106-1113]`).
2. A spec also names its expected category; a name match in the wrong category stores nothing.
3. Output keys come from the **spec**, never from the file's header text, so a hostile header (`__proto__`, a 100 KB name) cannot reach storage. Build the output on `Object.create(null)`-safe maps or a `Map` then a plain object whose keys are all spec-controlled.
4. Cell values are clamped to a fixed length (the Device-info bound is `MAX_DEVICE_TEXT = 200` `[VERIFIED: device-info-shared.ts:149]`).
5. **File-level skipped state (D-09):** decide per file, not per row. `matched = parsed.rows.some(row => Object.keys(row).some(k => spec has headerKey(k)))`. If `matched`, store every row's projection (a short ragged row projects to `{}` and is still a row); if not, store nothing. A short row must not be miscounted as skipped.
6. The projection replaces both `sanitizeUserInfoRow` and `reduceBlobRow` for these files; run it **before** them in the same expression.

**Skeleton (PROPOSED names; not an existing API):**
```ts
// src/lib/worker/new-data-allowlist.ts
import { headerKey } from './csv-columns.ts';
export interface AllowlistSpec {
  readonly category: string;                 // lower-cased stored category
  readonly pane: 'heat' | 'warships-storage' | null;
  readonly columns: ReadonlyMap<string, string>; // headerKey(file header) -> canonical stored header
}
export function specFor(category: string, sourceFile: string): AllowlistSpec | null { /* table lookup */ }
export function isNewDataFile(sourceFile: string): boolean { /* name-based family test */ }
export function projectRow(raw: Readonly<Record<string, string | undefined>>, spec: AllowlistSpec) {
  const out: Record<string, string | undefined> = {};
  for (const key of Object.keys(raw)) {
    const canonical = spec.columns.get(headerKey(key));
    if (canonical !== undefined && !(canonical in out)) out[canonical] = clamp(raw[key]);
  }
  return out;
}
```

### Pattern 2: presence facts for pane files from every category, with a parsed-row count

Change `root.presenceFiles.push` guard to `PRESENCE_CATEGORIES.has(...) || isNewDataFile(sourceFile)`. For allowlisted files record `rowCount = stored rows` and a new optional `parsedRowCount` on `DatasetFile` (non-indexed, no Dexie bump, the `files` precedent `[VERIFIED: db.ts:206-214]`). Then `skipped ⇔ parsedRowCount > 0 && rowCount === 0`, `no-rows ⇔ seen && parsedRowCount === 0`, `not-in-export ⇔ not seen`. This needs no second storage field and keeps `isPresent`'s third rule (rows settle it last) valid. The existing `MAX_PRESENCE_FILES = 500` cap per account still bounds it.

### Pattern 3: pane facts on `ClassifyResult` (UI-SPEC A3)

Add an optional `newDataPanes?: Partial<Record<'heat' | 'warships-storage', { fileCount: number; rowCount: number }>>` to `ClassifyResult` (`worker-messages.ts:35-105`; optional, like `accounts` and `rootCount`, so hand-built results and v1.0 replays keep compiling). Compute it by **one pure function** over the flattened presence list, `newDataPaneFacts(files)`, called from both `finalResult` (import, `ingest.worker.ts:1294-1312`) and `resultFromMeta` (replay, `:738-762`), exactly as `accountSummariesOf` is shared, so `done`, `duplicate` and `cache-status` cannot drift. The pane file sets are:
- HEAT pane: `HEAT_Account_Statistics`, `HEAT_Battle_Types_Statistics`, `HEAT_Account_Storage`, `HEAT_Session_Geolocation` (the four cards). **Not** `HEAT_Game_Sessions` (Playtime) and **not** `HEAT_Device_Info` (no card).
- Warships pane: `WOWS_Crews`, `WOWS_Account_Storage`.

A pane is present when `fileCount >= 1`; the headline is the summed **stored** `rowCount`; a present pane with 0 stored rows is the muted `empty` row (UI-SPEC Surface 2). A legacy cache whose `meta.files` lacks an Activity_History fact shows the pane only if another pane file was recorded (Pitfall 6).

### Pattern 4: two Device-info-style data channels and one shared card/table

Add `DataQuery` members `{ channel: 'heat' }` and `{ channel: 'warships-storage' }` and matching `DataResult`s; add two `DATA_FILES` entries (names = the pane file keys, categories = `['activity_history','player_statistics']` for HEAT, `['player_statistics']` for Warships); add two `case`s to `answerDataQuery`. `isDataQuery` and `DATA_CHANNELS` need no further change because both derive from `DATA_FILES` keys `[VERIFIED: data-queries.ts:188,223-225]`. Builders take `AccountRowGroup[]` per file and resolve columns **per group from that group's own first row** (CR-01), as `headerKeyedTable` does `[VERIFIED: device-info-aggregate.ts:295-357]`. Because stored rows already use canonical headers, a divergent-header account is already normalised by the projection, which removes most of CR-01's hazard for these files. View cells carry `account` (the owning group's root) and never a nickname. Do **not** copy Device info's `MAX_DEVICE_ROWS = 200` truncation: UI-SPEC bans a "more rows" line (Recorded Choice 4); use a high structural bound instead (Open Question 8).

### Pattern 5: PaneId design that keeps the PANE_IDS-iterating specs green (UI-SPEC Surface 2)

`PANE_IDS` is a fixed nine-tuple that `PaneId`, `PANE_TITLES` (`Record<PaneId,string>`) and `PANE_SECTION` (`Record<PaneId, NavId|null>`) derive from `[VERIFIED: selection-state.ts:71-108; ui-copy.ts:3311-3321]`. Seven unit/e2e files iterate `PANE_IDS` and click `list-row-<id>` for each: `zero-network.spec.ts:468`, `master-detail-nav.spec.ts:360`, `mobile-sweep.spec.ts:190-191`, `identity-privacy.spec.ts:252`, `multi-account.spec.ts:815,952`, `import-flow.spec.ts`, plus `selection-state.test.ts:106,121,147,401,461`.
**Recommendation:** keep `PANE_IDS` as the nine always-present panes and add `OPTIONAL_PANE_IDS = ['heat','warships-storage'] as const` plus `PANE_ORDER` (the eleven in UI-SPEC order, optional ones after `vehicles`). `PaneId = ((typeof PANE_IDS)[number]) | ((typeof OPTIONAL_PANE_IDS)[number])`. `paneEntries(result)` walks `PANE_ORDER` and omits an optional pane whose facts are absent; for any export without the files (every existing fixture) it returns exactly the nine entries, so `selection-state.test.ts:147` and all loops keep passing unedited. `stepSelection(current, direction)` must take the rendered ordering (`order = PANE_IDS` default) so `j/k` skips absent rows. `PANE_SECTION['heat']` and `['warships-storage']` are `null` (no single folder), and the two panes render through a thin shell that reuses `DashboardSection`'s title, provenance and combined-caption look (`DashboardSection` requires a `folder` and `SectionCounts`; either give it an optional `provenance` override or add a small sibling; do not fake a folder). The alternative of growing `PANE_IDS` to eleven forces every iterating spec to filter to rendered rows or to use a fixture with both optional panes (Pitfall 9).

### Pattern 6: game filter extension (D-05, D-06, D-07)

`GAME_FILTER_TOKENS` is `['WOT', 'WOTB', 'WOWS']` `[VERIFIED: game-filter-state.ts:52]`. Change to `['WOT','WOTB','WOWS','WOTC','HEAT']` (UI-SPEC order, which differs from D-05's prose "HEAT, WOTC"; a tuple edit if the user prefers D-05's order). Behavioural consequences, all derived from reading `filterChips`/`resolveGameFilter`/`filterToTitle` in full `[VERIFIED: game-filter-state.ts:93-181]`:
- `isFilterable` is membership in the tuple, so HEAT/WOTC become filterable everywhere with no other code change; chips, `resolveGameFilter` and `filterChips` follow.
- `filterToTitle('HEAT'|'WOTC')` stays `null` (default branch), so opening Vehicles with those filters asks the worker for its default title. `filterAfterTitleChange` stays unchanged.
- A HEAT-only or WOTC-only export renders no chip row (`filterable.size + other.size >= 2` fails). HEAT with WOT gives `['WOT','HEAT']`; HEAT with WOTC gives `['WOTC','HEAT']`.
- **Pinned tests that flip** (`game-filter-state.test.ts`): `:59-63` (`['WOT','HEAT']` now `['WOT','HEAT']`), `:65-68` (`['HEAT','WOTC']` is no longer null), `:113` (`GAME_FILTER_TOKENS` equality), and the `:163` HEAT title case stays valid. The comment block at the top of `game-filter-state.ts:25-31` ("Why HEAT and WOTC are not tokens here") and `Playtime.svelte`'s comment at `:354-356` become false and must be rewritten with the code.
- Copy: `GAME_NAMES` is `{ WOT:'WoT', WOTB:'WoT Blitz', WOWS:'Warships', WOWP:'Warplanes' }` and `GAME_ORDER` is `['WOT','WOTB','WOWS','WOWP']` `[VERIFIED: ui-copy.ts:2990-2998]`. Add `WOTC:'WoT Console'`, `HEAT:'HEAT'`. Side effect: `formatGames` (the Logins "Games" cell) will now print `WoT Console` instead of `WOTC`; unknown-token ordering means HEAT/WOTC sort after `WOWP` ascending unless `GAME_ORDER` is extended. Decide the order deliberately and update `login-copy.test.ts` if it pins it (its pinned cases use `WOXC`/`WOXA` `[VERIFIED: grep]`, so likely unaffected).
- **D-06 "keeps its last title"** is not what the code does on a remount: `PlayerStats` re-asks with `title: filterToTitle(gameFilter)` (null for HEAT/WOTC) on mount, so the title falls back to the worker default, not the user's last Vehicles choice `[VERIFIED: PlayerStats.svelte:252-262]`. To honour D-06 and UI-SPEC Surface 5 ("the last Vehicles choice, else the worker's first-title-with-rows"), lift a second stamped cell `vehicleTitle` into `Dashboard.svelte` (same pattern as `gameChoice` `[VERIFIED: Dashboard.svelte:134-141]`) and ask with `filterToTitle(gameFilter) ?? lastTitle` (Open Question 6). The note itself only needs `gameFilter ∈ {HEAT, WOTC}` and the applied `view.title`.

### Pattern 7: Warplanes account statistics inside Vehicles (D-02, GAMES-03)

The vehicle snapshot already contains all four WOWP files (`VEHICLE_FILE_NAMES` is built from `TITLE_FILES` `[VERIFIED: vehicle-aggregate.ts:150-169]`), so no reader change. Extend `VehicleView` (currently ends `wowp20: Warplanes20Note | null; allBattlesOnly; columns; rows` `[VERIFIED: vehicle-shared.ts:248-260]`) with `wowpAccount: WowpAccountBlock | null`, non-null only for the Warplanes title: one entry per account that has a row in either account file (one account contributes once, 19 preferred, exactly the rule `buildHeader` uses `[VERIFIED: vehicle-aggregate.ts:1018-1048]`), plus a `skipped` file name when the file is present, parsed rows exist, and nothing matched the allowlist. A title absent from an account yields no entry (no error, no placeholder). `buildHeader` reads only battles and expiry and ignores `NAME`; the new block adds the other allowlisted, non-identifying columns once the header re-read fixes them. Re-read `WOWP_20_Plane_Statistics.csv` first (Blocking Gap): if it now has a vehicle identifier, the "note, not table" rule (`buildWowp20Note`) should change.

### Pattern 8: footer and Overview (UI-SPEC Surface 6, A5)

`unsupportedEntries(result)` is `result.categories.filter(entry => entry.status !== 'supported')` `[VERIFIED: dashboard-status.ts:220-223]`; the list headline, the footer detail and the Overview chip all read it. Nothing in this phase changes any category's status, so no footer edit is needed. Overview: add the two ids to `OVERVIEW_CARD_IDS` conditionally (a card exists only when the pane entry exists); `overviewChips` counts `absent` only for `reason === 'no-export'`, and absent optional panes are not entries at all, so they are in neither count, as the UI-SPEC requires `[VERIFIED: overview-model.ts:70-94]`. `overview-model.test.ts:97-107` pins "the seven data panes" and flips (or keep `OVERVIEW_CARD_IDS` at seven and add the optional ids through a separate derived list).

### Pattern 9: the single global reveal (UI-SPEC A4) is NOT shared today

`revealed` is `let revealed = $state(false);` **inside `LoginHistory.svelte`** `[VERIFIED: LoginHistory.svelte:143]`, reset by `maskStateFor({ importedAt: maskStamp, revealed }, wanted)` in that component's dataset effect `[VERIFIED: LoginHistory.svelte:185-205; login-state.ts:178-184]`. Only one pane is mounted at a time (`Dashboard.svelte` `{#if}` chain), so the reveal also dies when the user leaves Login history. D-04's "single global reveal" therefore requires lifting. **Recommendation:** add a stamped cell `revealChoice: { revealed: boolean; stamp: string | null }` to `Dashboard.svelte` (the `gameChoice` pattern), resolve it with `maskStateFor`-style stamp logic as a pure read, pass `revealed` and `onRevealChange` to `LoginHistory` and to the HEAT pane, and keep each pane's own announcement region. This changes `LoginHistory`'s props (its source-shape unit tests and `login-history.spec.ts` need a look) but no behaviour; the reveal then survives a pane switch within one dataset and resets on a new dataset. The UI-SPEC fallback (a per-pane toggle starting masked) is acceptable if the lift is judged too invasive; either way no address is clear by default. The address string reaches the main thread unmasked and is masked at render by `maskIp`/`displayIp` exactly as in Logins `[VERIFIED: login-model.ts:83-95]`; no address may reach an attribute, `title`, `aria-label`, test id or `console`.

### Pattern 10: tables, windowing and ordering

`windowRange(scrollTop, viewportPx, total, overscan = 6)` with constant `ROW_PX = 40` is pure and returns `{ first, last, padTopPx, padBottomPx }` `[VERIFIED: windowing.ts:80-113]`. `VehicleTable` and `LoginTable` measure the scroller `clientHeight` once at mount, which is why `Dashboard.svelte` does not mount pane content on the phone's list screen (`detailMounted`) `[VERIFIED: Dashboard.svelte:144-152]`; the new table must not be mounted there either. Use plain `<table>` rows up to 500 and `windowRange` above, one component, one row-height constant. Order: the Dexie read groups accounts in first-seen order (zip entry order), **not** identity-header (D-16) order `[VERIFIED: db.ts:887-905]`, but UI-SPEC wants identity-header order. Sort groups on the main thread by `accountTagsOf(result.accounts)` index (stable, file order within an account); do not thread the order through `RowsSnapshot` (Open Question 9). Any `{#each}` over rows that repeat across accounts is index-keyed; every new keyed `{#each}` needs a row in the AUDITED table of `tests/unit/import/multi-account-keys.test.ts` (it scans component files) `[VERIFIED: multi-account-keys.test.ts:1-80, 355-400]`.

### Anti-Patterns to Avoid

- **A growing deny-list.** The whole point of D-08 is the opposite: a column absent from the spec cannot be stored.
- **Reading the file's header text into stored keys.** Keys are canonical spec strings.
- **Deciding `skipped` per row** (a ragged row would count as skipped).
- **Promoting a folder to make a pane appear.** All target files are already in supported folders.
- **Fabricating column names for the crews/storage allowlists from the invented fixture headers.**
- **A second status derivation for the list rows.** One `newDataPaneFacts` feeds `done`, `duplicate`, `cache-status`, the list, Overview and the detail header.
- **Bumping `PLAYTIME_VERSION` reflexively** (Pattern 11 / Open Question 2).

### Pattern 11: PLAYTIME_VERSION and the stored per-game aggregate

`PLAYTIME_VERSION = 3` `[VERIFIED: playtime-shared.ts:64]`. `buildPlaytimeFromSources` returns `{ ...rankAggregates(...), ...buildGameScopes(...) }` and `buildGameScopes` creates `groups` keyed by `session.game` for **every** token with a usable session, then `games = [...groups.keys()].sort().slice(0, MAX_SPLIT_VALUES)` and one `rankAggregates` scope per game `[VERIFIED: playtime-aggregate.ts:608-698]`. `sessionFileNameGame` accepts any `^([A-Za-z0-9_]{1,24})_game_sessions\.csv$` `[VERIFIED: playtime-aggregate.ts:216,239-244]`. So `HEAT_Game_Sessions.csv` and `WOTC_Game_Sessions.csv` already produce `byGame` entries today, and the fixture literals say so: `byGame` has `HEAT: { seconds: 7_200, sessions: 2, days: 2 }`, `WOTC: { seconds: 3_600, sessions: 1, days: 1 }` and `games: ['HEAT', 'WOT', 'WOTB', 'WOTC', 'WOWS']` `[VERIFIED: multi-account-fixtures.ts:262-275]`. The worker validates the incoming token with `isGameToken` (`/^[A-Z0-9_]{1,24}$/`) so `HEAT`/`WOTC` are already accepted `[VERIFIED: playtime-shared.ts:113,125-127]`; the existing test asks `askPlaytime(30, 'WOTC')` against an export with no WOTC and gets `no-game-sessions` `[VERIFIED: playtime-multi-account.test.ts:445-460]`.
**Conclusion:** the aggregate shape does not change, so a version bump forces a rebuild for no new content. A bump would break only the pinned `expect(PLAYTIME_VERSION).toBe(3)` at `ingest-worker.test.ts:2059-2070`. The other `meta.playtime.v` comparisons read the constant and follow it. Recommendation: first write the test that asks the worker for `HEAT` and `WOTC` against the three-account fixture and asserts the stored `byGame` figures (they should already pass); keep `PLAYTIME_VERSION` at 3 unless that test or a real change to aggregation says otherwise, and flag the D-05 wording to the user (Open Question 2).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Header normalisation | A new trim/case function | `headerKey` from `csv-columns.ts` | Every aggregator matches through it |
| Per-account row grouping | A new map | `AccountRowGroup` and `readRowsByFile` | CR-01: a key must not cross accounts |
| Folder/file classification | New regexes in several places | One `isNewDataFile`/`specFor` in the allowlist module | The inflate filter, the choke point, presence and the readers must agree |
| Windowing | A virtual-list component | `windowRange` + `ROW_PX` | Pure and already unit-tested |
| Account chips | New markup | `AccountTag.svelte` + `accountTagsOf` | Inert by construction (no ID/nickname attribute) |
| IP masking | A new mask | `maskIp`/`displayIp` and the `MASK_*` copy | One formatter, one vocabulary |
| Pane status ladder | A second derivation | `formatSectionStatus('empty', ...)`, `DEVICE_TABLE_NOT_IN_EXPORT`, `formatDeviceNoRows`, `DEVICE_NOT_REPORTED` | Reused verbatim per UI-SPEC |
| Test harness | A new worker harness | `tests/helpers/worker-harness.ts` (`installWorkerScope`, `ingestExport`, `postRequest`, `waitForMessage`, `deleteActiveDatabase`) | Used by `device-info-worker.test.ts` |

**Key insight:** every strip, grouping, masking and windowing rule already exists as a function. The risks are calling them with the wrong scope (folder instead of file, one account instead of a group) and forgetting a consumer (presence for Activity_History, the ten `PANE_IDS` loops).

## Runtime State Inventory

This phase changes the stored row shape for existing files and adds optional fields, so the five categories are answered explicitly.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | Every existing v1.1 cache holds the HEAT/WOTC/WOWP/WoWS rows with **all** columns (WOWP account rows with `NAME`); `meta.files` lacks Activity_History facts | Code edit for new imports; **data narrowing** for returning caches (Open Question 3): an idempotent in-place projection run beside `purgeUnsupportedCategoryRows` in `handleCheckCache` (`ingest.worker.ts:677`), no Dexie bump |
| Live service config | None. No server, no hosted state | None |
| OS-registered state | None | None |
| Secrets/env vars | None. CSP `connect-src 'self'` and the ESLint network ban are untouched | None |
| Build artifacts | None (no package, no geo asset touched) | None |

**Canonical question:** after every file is updated, what still holds the old shape? Only IndexedDB caches written before the allowlist. The narrowing step plus read-time use of canonical headers make them safe to render; the at-rest cleanup is the only open item.

## Common Pitfalls

### Pitfall 1: Treating "unknown folder, stored raw" as true
**What goes wrong:** the plan builds a folder promotion and a raw-store replacement that has nothing to replace; the real hazard (already-stored unfiltered rows in supported folders) goes unplanned.
**Why:** CONTEXT's code-context bullet predates Phase 9 D-18. **Avoid:** plan the projection and the legacy narrowing. **Warning sign:** a task that edits `SUPPORTED` or `KNOWN_DEFERRED`.

### Pitfall 2: Allowlist narrower than the builder's vocabulary
**What goes wrong:** a WOWP column the vehicle table already shows turns into "not in export" after import.
**Avoid:** per-file test `allowlist ⊇ ALL_FIELDS headers present in the file`, run on the synthetic WOWP fixtures (`PLAYER_STATS_SAMPLE_FILES` already carries all four) `[VERIFIED: player-stats-fixtures.ts:658-684]`.

### Pitfall 3: Per-row skipped detection
A ragged row has missing keys; if the file-level match is not decided first, the file is reported skipped and its rows dropped. **Avoid:** file-level match (Pattern 1 rule 5).

### Pitfall 4: Missing presence facts for Activity_History
`PRESENCE_CATEGORIES` omits it. Without Pattern 2 the geolocation card says "Not in this export" for a file that is there, and the HEAT row can be hidden. **Warning sign:** the `heat` channel answers `not-in-export` for `HEAT_Session_Geolocation.csv` in a fixture that contains it.

### Pitfall 5: The playtime bump that changes nothing
See Pattern 11. Bumping makes every returning user rebuild once and breaks a pinned test for no new data.

### Pitfall 6: Legacy caches and pane presence
A cache written before this phase has presence facts for the Player_statistics HEAT/WoWS files but not for `HEAT_Session_Geolocation.csv`. The HEAT row appears (other files recorded) while the geolocation card relies on `isPresent`'s row fallback, which works only because the legacy rows are still raw. After the narrowing step the rows are projected, so the fallback still answers `ready`. Add a test with a hand-written v1.1-shaped meta.

### Pitfall 7: Iterating `PANE_IDS` in specs
Design (B) in Pattern 5 keeps them green; design (A) breaks `zero-network`, `master-detail-nav`, `mobile-sweep`, `identity-privacy`, `multi-account` and `import-flow`. Whichever is chosen, `mobile-sweep.spec.ts:190` asserts `[...PANE_IDS]` equals the keys of `PANE_EXPECTATIONS`.

### Pitfall 8: Geolocation precision
If `HEAT_Session_Geolocation.csv` carries latitude, longitude, city or postal columns, storing or showing them is a location disclosure beyond Logins' country level (city is an explicit opt-in there). **Avoid:** allowlist country-level and masked-address columns only until the user decides (Open Question 4).

### Pitfall 9: The zero-network loop needs the files
`zero-network.spec.ts:468-470` opens every pane of `buildRealShapeThreeAccountExport()`. The real-shape builder today carries HEAT and WOTC **session** files but no pane files, so `list-row-heat` would not exist. Add synthetic HEAT and WoWS files to that builder (EU root: `HEAT_*`; RU root: `WOWS_Crews`, `WOWS_Account_Storage`, `WOWP_19`) and loop `OPTIONAL_PANE_IDS` in the same test, which adds **zero** listed tests.

### Pitfall 10: Header-keyed fixtures that do not match reality
The new synthetic fixtures must use the header names captured in Wave 0, quote-all cells and a bare-CR file per family (Phase 5 note `[CITED: 05-RESEARCH.md:171]`), plus one planted canary per file.

### Pitfall 11: Log leakage
`console.error('[csv-parse] skipped row', ...)` logs category/file/line, never a cell `[VERIFIED: csv-parse.ts:300-320]`. The new builders must log the error object only, never a row (T-06-01/T-05-20 rule).

### Pitfall 12: Keyed-each audit
A new component with `{#each rows as row (row.something)}` fails `multi-account-keys.test.ts` by name. Use `(index)` or add an AUDITED row with a reason.

## Code Examples

### The current filter tuple (the extension point)
```ts
// Source: src/lib/shell/game-filter-state.ts:52 [VERIFIED]
export const GAME_FILTER_TOKENS = ['WOT', 'WOTB', 'WOWS'] as const;
// Phase 11: ['WOT', 'WOTB', 'WOWS', 'WOTC', 'HEAT'] as const   (UI-SPEC order)
```

### Stamped shell cell pattern to reuse for the lifted reveal and the last title
```ts
// Source: src/lib/shell/Dashboard.svelte:134-141 [VERIFIED]
let gameChoice = $state<GameFilterChoice>({ token: null, stamp: null });
const gameFilter = $derived(resolveGameFilter(gameChoice, datasetStamp(result)));
function setGameFilter(token: string | null): void {
  gameChoice = { token, stamp: datasetStamp(result) };
}
```

### The data-query seam to extend
```ts
// Source: src/lib/worker/data-queries.ts:84-110 (shape) [VERIFIED]
export const DATA_FILES: Readonly<Record<Exclude<DataQuery['channel'], 'logins'>, ChannelFiles>> = {
  premium: { names: new Set([PREMIUM_FILE]), categories: [CATEGORY_FINANCIAL] },
  /* ... */
  'device-info': { names: new Set(DEVICE_SOURCES.map((source) => DEVICE_FILE_KEYS[source])), categories: [DEVICE_INFO_CATEGORY] },
};
// Phase 11 adds: heat: { names: new Set([...HEAT pane file keys]), categories: ['activity_history', 'player_statistics'] }
//                'warships-storage': { names: new Set(['wows_crews.csv', 'wows_account_storage.csv']), categories: ['player_statistics'] }
```

### Windowing call shape
```ts
// Source: src/lib/core/windowing.ts:80-86 [VERIFIED]
export function windowRange(scrollTop: number, viewportPx: number, total: number, overscan: number = OVERSCAN_ROWS): WindowRange
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Deny-list strip of three columns for every file | Per-file allowlist for new files (D-08) | Phase 11 | Stored row shape is spec-defined |
| Unknown folders stored raw | Unknown folders counted, never stored | Phase 9 D-18 | CONTEXT's "stored raw" bullet is stale |
| `PANE_IDS` = all rows always | Optional rows present only with data (UI-SPEC A2) | Phase 11 | Needs `PANE_ORDER` + rendered-ids stepping |

**Deprecated/outdated in the inputs:** CONTEXT "e2e budget: 258 of 262" (see CI Budget); CONTEXT "unknown/stored raw"; UI-SPEC "global reveal" implied shared (it is not).

## CI Budget (e2e) and the three limits

Measured this session: `playwright test --list` printed **`Total: 260 tests in 29 files`** `[VERIFIED: tool output this session]`. The CONTEXT figure (258 of 262) predates Phase 10, which raised the limits. Current state:

| Limit | Where | Value |
|---|---|---|
| G, Playwright `globalTimeout` | `playwright.config.ts:222` `globalTimeout: 31 * 60 * 1000,` `[GREP]` | 31 min (1860 s) |
| W, shell wrapper | `.github/workflows/ci.yml:236` `run: pnpm exec timeout 33m playwright test` `[GREP]` | 33 min |
| J, job | `.github/workflows/ci.yml:110` `timeout-minutes: 41` `[GREP]` | 41 min |
| Pinned in | `tests/unit/guards/ci-budget.test.ts:536-538` `toBe(1860)`, `toBe(1980)`, `toBe(2460)`, and `:545` `toBeLessThanOrEqual(264)` `[VERIFIED]` | |
| Comment pin | `.github/workflows/ci.yml:188` ``Playwright's own `globalTimeout` (31 min)`` must name the same G (`ci-budget.test.ts:571-598`) `[GREP + VERIFIED]` | |

Rule `[VERIFIED: ci-budget.test.ts:529-546]`: all three move together, W = G + 2 min and J = W + 8 min; E = 330 + 5·(N − 86 − 5 − 5 − 5 − 2 − 2) + 120 + 90 + 13 + 32 + 49 for N ≥ 260; required G ≥ 1.3·E. N = 264 gives E = 1429 s and a floor of 1857.7 s (passes), N = 265 gives 1434 s and 1864.2 s (fails 1860). So **up to four new listed tests need no raise** (260 → 264). A raise needs G = 32 min, W = 34 min, J = 42 min, an appended "Raised from ..." paragraph in `playwright.config.ts`, `ci.yml` and `ci-budget.test.ts` comments, the three pins, the `projectedE2eSeconds` worked cases, and the `(N min)` sentence at `ci.yml:188`.

**Recommended spend (three listed tests, ceiling intact):** (1) one spec for the HEAT pane (states, canary absent from the DOM, mask toggle, per-account tags, row hidden when absent); (2) one for the Warships pane plus the Warplanes block and the no-vehicle-table note; (3) one for the HEAT/WOTC chips (visibility matrix, Playtime narrowing, phone wrap). Extend, do not add: the zero-network Phase 5/9 test, `multi-account.spec.ts`'s existing flows and `vehicle-stats.spec.ts`. If a large-table windowing proof needs its own import it is a priced block; add it to the budget with a measured allowance like `MULTI_ACCOUNT_SCALE_SECONDS`.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (Node env, no DOM, `tests/unit/**/*.test.ts`) and Playwright (`chromium`, `chromium-mobile`) |
| Config file | `vitest.config.ts`, `playwright.config.ts` |
| Quick run command | `pnpm exec vitest run tests/unit/import/new-data-worker.test.ts` (per file) |
| Full suite command | `pnpm run test:unit && pnpm exec playwright test` (the project `test_command`); also `pnpm run check`, `pnpm run lint`, `pnpm run build` |

`[VERIFIED: package.json scripts, .planning/config.json]`. Component tests are **source-shape guards** (no DOM in Vitest): they read the `.svelte` file and assert test ids, ARIA and absence of tokens, as `device-info-blocks.test.ts` does `[VERIFIED: device-info-blocks.test.ts:1-66]`. Rendered-DOM claims (canary absent from the page) need an e2e. Chromium may fail to launch in sandboxed agent environments `[CITED: STATE.md 04-15 note]`; run e2e on the user's machine or CI.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PRIV-01 | Per spec file: planted email/ID/IP/coordinate/overflow/proto/BOM variants absent from `db.rows` and from the channel view JSON; allowlisted canonical columns present | unit (real worker + fake IndexedDB) | `pnpm exec vitest run tests/unit/import/new-data-allowlist.test.ts` | ❌ Wave 0 |
| PRIV-01 | Family file with no spec stores nothing, in any folder | unit | same file | ❌ Wave 0 |
| PRIV-01 | WOWP allowlist ⊇ vehicle builder vocabulary; `NAME` absent from stored WOWP account rows | unit | `pnpm exec vitest run tests/unit/vehicles/vehicle-stats.test.ts` (+ new cases) | ✅ extend |
| PRIV-01 | Legacy raw rows are narrowed on check-cache; second run is a no-op | unit | `tests/unit/import/new-data-narrow.test.ts` | ❌ Wave 0 |
| PRIV-01 | Canary absent from rendered HEAT and Warships panes | e2e | `pnpm exec playwright test new-data-panes` | ❌ Wave 0 |
| PRIV-02 | Zero requests, one worker, no CSP violation while opening each new pane | e2e (extend existing) | `pnpm exec playwright test guards/zero-network` | ✅ extend |
| GAMES-01 | `heat` channel states: ready, not-in-export, no-rows, skipped; per-account rows; masked address cell | unit | `tests/unit/import/new-data-worker.test.ts` | ❌ Wave 0 |
| GAMES-01 | List row/Overview card present only with files; counts equal stored rows | unit | `tests/unit/shell/selection-state.test.ts`, `overview-model.test.ts` (extend) | ✅ extend |
| GAMES-02 | `GAME_FILTER_TOKENS` extended; chip matrix; HEAT/WOTC `no-game-sessions` vs ready; stored `byGame` figures equal fixture literals | unit | `tests/unit/shell/game-filter-state.test.ts`, `tests/unit/playtime/playtime-multi-account.test.ts` | ✅ edit pins |
| GAMES-02 | Chips visible and Playtime narrows in the browser; 6 chips wrap at 375 px | e2e | `pnpm exec playwright test shell/new-data-panes` | ❌ Wave 0 |
| GAMES-03 | Warplanes account block per account; absent account yields nothing; skipped line; no `NAME` anywhere | unit + e2e | `tests/unit/vehicles/vehicle-stats.test.ts`; `tests/e2e/vehicles/vehicle-stats.spec.ts` | ✅ extend |
| GAMES-03 / D-06 | No-vehicle-table note with filter HEAT/WOTC; filter not cleared; last title kept | unit (state) + e2e | `tests/unit/shell/game-filter-state.test.ts` | ✅ extend |
| GAMES-04 | `warships-storage` channel rows account-tagged in identity-header order | unit + e2e | `tests/unit/import/new-data-worker.test.ts` | ❌ Wave 0 |
| D-11 | >500 rows windowed; DOM node count bounded; no per-row SVG | unit (`windowRange`) + e2e node count | `tests/unit/vehicles/vehicle-model.test.ts` (re-exports `windowRange`) + a new-data table source guard; node-count spec in new-data-panes | ❌ Wave 0 |
| Footer (SC5) | `unsupportedEntries` unchanged for a fixture holding every new file | unit | `tests/unit/shell/dashboard-status.test.ts` (extend) | ✅ extend |
| Budget | Listed tests ≤ 264 or all three limits raised together | unit guard | `pnpm exec vitest run tests/unit/guards/ci-budget.test.ts` | ✅ |

### Sampling Rate
- **Per task commit:** the touched file's Vitest file (about 10 s).
- **Per wave merge:** `pnpm run test:unit && pnpm run check && pnpm run lint`.
- **Phase gate:** full unit suite, `pnpm run build`, `playwright test --list` count against the budget, then the e2e suite on a machine that can launch Chromium, before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] Header capture output (Blocking Gap) committed as names-only data, e.g. `tests/fixtures/new-data-fixtures.ts` constants.
- [ ] `tests/fixtures/new-data-fixtures.ts`: synthetic HEAT, WOWS crews/storage, WOWP, WOTC files with the captured headers, one canary per file, a drifted-header copy per file, a header-only copy per file, and a generator for a >500-row (and a few-thousand-row) table.
- [ ] Extend `tests/fixtures/multi-account-fixtures.ts` `buildRealShapeThreeAccountExport` with the pane files (Pitfall 9) without changing existing literals (`MA_EXPECTED_PLAYTIME`, `SAMPLE_EXPECTED_COUNTS`-style counts will change if the sample export gains files: prefer adding to the multi-account builder only).
- [ ] `tests/unit/import/new-data-allowlist.test.ts`, `new-data-worker.test.ts`, `new-data-narrow.test.ts`, `tests/unit/new-data/*` (aggregate, state, blocks source guards), `tests/e2e/shell/new-data-panes.spec.ts`.
- [ ] Update pinned tests listed in Pattern 6, Pattern 8 and Pitfall 7 together with the code that makes them false.

## Security Domain

`security_enforcement` is enabled (`security_asvs_level: 1`, block on high) `[VERIFIED: .planning/config.json]`.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication / V3 Session | no | no accounts, no backend |
| V4 Access Control | no | single-user, local |
| V5 Input Validation | **yes** | Allowlist projection by canonical header; length clamp on every stored cell; `isDataQuery` strict predicate for new channels; file names printed only via a constant label table |
| V6 Cryptography | no | none added (hash is existing `digestFile`) |
| V7 Error handling and logging | yes | Fixed error sentences in the UI; `data-error` carries the error NAME only; never log a row |
| V8 Data protection | **yes** | Minimise at rest (allowlist, legacy narrowing), mask IPs by default, no address in attributes or logs |
| V14 Configuration | yes | No new network path; ESLint network ban and CSP `connect-src 'self'` unchanged |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Hostile header (`__proto__`, huge name, BOM, padding, case) reaching a stored key | Tampering | Output keys are spec constants; `headerKey` match; `Map`-based resolution |
| PII column (email, ID, coordinates) in a new file | Information disclosure | Not on the spec, so never stored; per-header canary test |
| Misfiled family file in another folder | Information disclosure | Name-based family rule, no spec means store nothing |
| Surplus cells (`__parsed_extra`) | Information disclosure | Dropped by projection |
| Hostile zip entry name in a card caption | Spoofing/XSS | Captions come from a label table keyed by record type (T-08-01 pattern); unknown names are never printed |
| Oversized table / row flood | DoS | Per-table structural bound, windowing, `MAX_PRESENCE_FILES` |
| Address in DOM attribute/title/log | Information disclosure | Mask at render; assert absence in e2e markup |
| Hostile `game` token on the playtime query | Tampering | Existing `isGameToken` validation, value never echoed |
| Residual: an allowlisted column whose cell value contains PII | Information disclosure | Accepted residual, same class as T-bog-07; keep allowlists to numeric/enumerated columns where possible; clamp length |

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | build, tests | ✓ | v26.12.0 | — |
| pnpm | scripts | ✓ | 12.6.0 | — |
| vitest, playwright, eslint, prettier, tsc, svelte-check | validation | ✓ (`node_modules/.bin`) | — | — |
| Python 3 | header capture script | ✓ | 3.15.0 | — |
| Chromium for Playwright | e2e | not probed; may not launch in a sandbox `[CITED: STATE.md]` | — | run e2e on the user's machine/CI |
| Real export zip content read | header allowlists | ✗ (classifier denial) | — | Wave 0 human checkpoint (script above) |
| Web search | — | ✗ (model error this session) | — | — |

**Missing dependencies with no fallback:** none technical; the header capture needs the user.
**Missing with fallback:** Chromium in sandboxes (run on host/CI).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | HEAT_Session_Geolocation may carry coordinates, city or postal columns | Allowlist Proposal, Pitfall 8 | If it only has country and IP, the policy is stricter than needed (harmless); if it has coordinates and the user wants them, the policy blocks a feature |
| A2 | HEAT account/battle-type files resemble the WOTB shapes (`BATTLES_COUNT`, `TYPE`, ...) | Allowlist Proposal | Allowlist rewritten after header capture |
| A3 | WOWP account files carry `NAME` in 2026 | Allowlist Proposal | `NAME` is excluded either way, so harmless |
| A4 | Candidate PII column names for the canary test exist in some real file | Allowlist Proposal | None: they are canary headers, not claims |
| A5 | The 2026 `WOWP_20_Plane_Statistics.csv` may now carry a vehicle identifier (size evidence only) | Blocking Gap, Pattern 7 | If it does, the "note not table" rule is outdated; if not, no change |
| A6 | Real HEAT/Warships files are small (sizes up to 4.3 KB), so real-data windowing never triggers | File Inventory | Windowing still required by D-11 and tested synthetically |
| A7 | The pre-existing at-rest rows are an accepted-residual class if not narrowed | Runtime State Inventory | Privacy finding in review if left unaddressed |
| A8 | Chromium cannot launch in the agent sandbox | Validation | Verification must be delegated to the user's machine |
| A9 | Main-thread stable sort by tag order gives identity-header order | Pattern 10 | Cosmetic ordering difference only |

## Open Questions (RESOLVED)

> Resolved at plan-phase 2026-10-19: Q1 header capture by D-12 and plan 11-02 (Wave 0 checkpoint); Q2 PLAYTIME_VERSION by D-13 (no bump, test-first); Q3 legacy rows by D-14; Q7 un-specced family files store nothing by D-15; Q8 row cap not applied per UI-SPEC Recorded Choice 4; Q10 chip order per UI-SPEC (WoT Console, then HEAT). Remaining questions are settled in the plan must_haves as recorded assumptions.

1. **BLOCKER: headers of the HEAT, WOWS crews/storage, WOWP (2026) and WOTC files.**
   - Known: file paths, sizes, folders (verified); sessions header (cited from Phase 9); 2021 WOWP shapes (cited).
   - Unknown: every other header, delimiter, row counts, whether WOWP_20 plane has an identifier.
   - Recommendation: Wave 0 `checkpoint:human-action` running the script in "Blocking Gap" (or the user adds a Bash permission rule for it). Block the allowlist, label-map, column-kind and fixture tasks on it; everything in Patterns 2-6, 8-10 can be planned and built meanwhile.

2. **Is the `PLAYTIME_VERSION` bump in D-05 still wanted?**
   - Known: HEAT and WOTC scopes already exist in v3 aggregates; a bump changes no content.
   - Recommendation: add the verifying test first; keep v3 unless it fails; surface the conflict with the locked D-05 text to the user. If the user insists, it is one constant plus the pin at `ingest-worker.test.ts:2059-2070`.

3. **Narrow already-stored rows of the new files on check-cache?**
   - Known: existing caches hold these files unfiltered (WOWP account rows with `NAME`).
   - Recommendation: yes, an idempotent `narrowStoredNewDataRows()` in the same entry as `purgeUnsupportedCategoryRows`, using the same projection, no Dexie bump. Alternative (document as residual until re-import) is weaker for PRIV-01 and should need explicit user acceptance.

4. **Geolocation precision policy.** Recommendation: country-level and a masked address only; drop coordinates, city and postal columns; revisit with the user once the real columns are known.

5. **Lift the reveal to the shell (A4)?** Recommendation: yes, with the stamped-cell pattern (Pattern 9); fallback to a per-pane toggle if the `LoginHistory` prop change is judged too invasive.

6. **Remember the last Vehicles title for D-06?** Recommendation: a second stamped shell cell and `filterToTitle(gameFilter) ?? lastTitle` on the first ask.

7. **`HEAT_Device_Info.csv` and other family files without a pane.** Recommendation: store nothing (family fail-closed), count them; offer Device info support for HEAT as a later enhancement. Needs the user's confirmation since it removes data currently at rest.

8. **Row bound per table.** Recommendation: a structural cap in the worker (for example 50,000 rows per table) with a one-line caption when it bites, which needs a small UI-SPEC amendment because the contract bans "more rows" lines for Device-info-style truncation.

9. **Account ordering in new panes.** Recommendation: sort on the main thread by tag order.

10. **Chip order.** UI-SPEC says WoT Console then HEAT; D-05 prose says HEAT, WOTC. Recommendation: UI-SPEC order (already approved); it is a tuple edit if overruled.

11. **Session files of HEAT/WOTC allowlisted to `STARTED_AT`,`FINISHED_AT`,`IP`?** Recommendation: yes (they are in the new-game family and the header is verified); do not extend to WOT/WOTB/WOWS session files in this phase.

## Sources

### Primary (HIGH confidence)
- This repository, files opened with Read this session: `src/lib/worker/{categories,csv-columns}.ts`, `ingest.worker.ts` (85-215, 290-440, 660-1349), `db.ts` (30-430, 760-1069), `data-queries.ts` (1-330), `csv-parse.ts` (233-330), `src/lib/shell/{game-filter-state,selection-state,dashboard-status,overview-model,Dashboard,DashboardSection,GameFilter}.*`, `src/lib/core/{windowing,types/worker-messages}.ts`, `src/lib/features/{device-info/*,playtime/{playtime-aggregate,playtime-shared},vehicles/{vehicle-aggregate,vehicle-shared,PlayerStats},logins/{LoginHistory,login-state}}`, `src/lib/ui-copy.ts` (selected ranges), `tests/unit/{guards/ci-budget,shell/game-filter-state,import/device-info-worker,import/multi-account-keys,device-info/device-info-blocks}.test.ts`, `tests/e2e/guards/zero-network.spec.ts`, `tests/e2e/_support/helpers.ts`, `tests/fixtures/{multi-account-fixtures,player-stats-fixtures}.ts`.
- `python3 -I zipfile` entry-name and size listing of the user's `2026-10-14.zip` (names relabelled; nothing extracted or copied).
- `playwright test --list` output (260 tests in 29 files).

### Secondary (MEDIUM confidence)
- `.planning/phases/09-multi-account-import-account-identity/09-RESEARCH.md` (real-sample headers for sessions, User_Info, Game_Forums).
- `.planning/milestones/v1.0-phases/05-vehicle-stats-financial-dashboards/05-RESEARCH.md` (2021 sample headers for WOWP/WOWS/WOT/WOTB).

### Tertiary (LOW confidence)
- Training-knowledge analogies for HEAT column shapes (tagged `[ASSUMED]`).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH, no new dependencies.
- Architecture: MEDIUM-HIGH, built on read code; the pane/PaneId and reveal-lift choices are recommendations.
- Allowlist contents: **LOW**, blocked on headers.
- Pitfalls: HIGH for code-derived ones, MEDIUM for fixture/legacy ones.
- CI budget: HIGH (measured count and pinned constants).

**Research date:** 2026-10-19
**Valid until:** 30 days for code facts, but the Blocking Gap must be closed before the allowlist tasks are planned.

**Project constraints honoured (from CLAUDE.md/AGENTS.md):** Svelte 5 runes, Vite, pnpm; no router and no new dependency; zero network after load (CSP `connect-src 'self'`, ESLint network ban, one sanctioned city request); dependency minimalism and hand-rolled tables; Web Worker pipeline with `Papa.parse({ worker: false })`; chart/table aggregation never one SVG node per row; Chrome-first, phone-width usable; TypeScript ^6; no `Co-Authored-By` trailer in commits (the commit is the orchestrator's; nothing was committed here).
