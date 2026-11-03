# Phase 11: New Game Data - Context

**Gathered:** 2026-10-19
**Status:** Ready for planning

<domain>
## Phase Boundary

The user sees the games and records the dashboard used to ignore: HEAT, WoT Console (WOTC), World of Warplanes (WOWP 19 and 20) account and plane stats, and WoWS crews and account storage. Requirements: GAMES-01, GAMES-02, GAMES-03, GAMES-04, PRIV-01, PRIV-02.

In scope: HEAT and WOTC as game-filter choices and in Playtime; a HEAT pane; Warplanes account and plane stats in Vehicles; a WoWS crews and storage pane; fail-closed column allowlists with a per-header unit test; zero-network assertion extended to every new pane; "Not yet supported" footer shrinks as folders gain a pane.

Out of scope: account timeline and perks (Phase 12), filtering Finance or Logins by game, per-account picker, new Overview totals.

</domain>

<decisions>
## Implementation Decisions

### Where new data lives
- **D-01:** HEAT gets its own list row ("HEAT") in the master-detail shell, shown only when the export holds HEAT data. Battle types, account stats, storage and geolocation live in that pane. — **Reversibility:** reversible — **Reversibility rationale:** a list entry and a component; no storage or schema.
- **D-02:** WoWP account stats and plane stats go inside Vehicles under the existing Warplanes title (the Vehicles-local fourth title). A title absent from an account shows an empty state, never an error.
- **D-03:** WoWS crews and account storage get their own list row ("Warships crews & storage"), not Vehicles blocks. Every row carries the account tag chip (Phase 10 D-10).
- **D-04:** HEAT pane layout and geolocation handling were not discussed; default: stacked cards in the pane, geolocation addresses reuse the existing masking and single global reveal, and HEAT addresses do not feed the Logins map or country list. Planner may refine; any IP shown must stay masked until the global reveal.

### Game filter extension
- **D-05:** HEAT and WOTC are appended to `GAME_FILTER_TOKENS` (the Phase 10 D-05 extension point). Playtime narrows for them like any other game: extend the stored per-game aggregates (`byGame`, `games`) and bump `PLAYTIME_VERSION` so lazy rebuilds agree with import-time aggregates. A chip shows only when that game has sessions in the data. — **Reversibility:** costly — **Reversibility rationale:** a stored aggregate version bump; reverting forces another rebuild and the pinned playtime version test encodes the number.
- **D-06:** With the filter on HEAT or WOTC, Vehicles keeps its last title and shows a one-line note that this game has no vehicle table (same pattern as Warplanes being Vehicles-local). The shared filter is not cleared by Vehicles.
- **D-07:** The filter stays on Playtime and Vehicles only. Finance and Logins do not react to it (Phase 10 D-02 stands).

### Privacy and parsing
- **D-08:** Every new category uses a per-file column allowlist: only named columns are stored; any other column, including unknown or drifted ones, is dropped before storage. One unit test per file header plants a synthetic email and asserts it reaches neither IndexedDB nor any rendered pane (PRIV-01). — **Reversibility:** costly — **Reversibility rationale:** allowlists define the stored row shape; widening later needs a cache rebuild.
- **D-09:** If a file's headers match none of its allowlist, import still succeeds and the pane shows an empty state, with the file named in the pane's provenance line so the user can see it was skipped. No import-summary warning and no import failure.
- **D-10:** Research inspects the real export's column headers only, never cell values, as Phase 9 did, before the allowlists are fixed. Fixtures stay synthetic; the real zip is never committed.
- **D-11:** Zero-network assertions (Playwright) are extended to every new pane (PRIV-02). Any table over a few thousand rows is windowed or aggregated; no per-row SVG nodes.

### Amendments recorded at plan-phase (2026-10-19)
- **D-12:** Real HEAT / WOTC / WOWP / WoWS crews+storage headers could not be read during research (permission block). Plans carry a Wave 0 `checkpoint:human-action`: the user runs the values-free header-capture script from `11-RESEARCH.md` and supplies names only; allowlist and fixture tasks depend on it. Everything independent of header names is planned in full.
- **D-13 (amends D-05):** No `PLAYTIME_VERSION` bump up front. Add HEAT and WOTC to `GAME_FILTER_TOKENS`, write a test proving per-game scopes build for them, and bump only if that test fails. Chip order follows the UI-SPEC (WoT Console, then HEAT).
- **D-14:** Previously stored rows are narrowed in place by an idempotent step next to `purgeUnsupportedCategoryRows`, so existing caches stop holding non-allowlisted columns.
- **D-15:** Allowlists are enforced at the supported-folder row-storing choke point (beside `reduceBlobRow`); a family file with no spec stores nothing. The prior "unknown folders stored raw" wording is stale: unknown folders are counted, not stored.

### Claude's Discretion
- Exact copy, chip and card visuals within the Day 10 shell and sketch findings.
- HEAT pane card order and whether geolocation sits in its own card.
- Allowlist contents once headers are inspected.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements and roadmap
- `.planning/ROADMAP.md` §Phase 11 and §Planning Notes (fail-closed classification, unverified headers, e2e budget, UI conventions)
- `.planning/REQUIREMENTS.md`: GAMES-01..04, PRIV-01, PRIV-02
- `.planning/PROJECT.md`: core value, zero-network, hand-rolled charts, no new dependencies

### Prior decisions that bind this phase
- `.planning/phases/10-merged-dashboard-across-accounts/10-CONTEXT.md`: D-01..D-05 game filter and its extension point, D-10 account tag chip, D-16 non-indexed `account`, D-17 scale proof, D-21 per-game aggregates
- `.planning/phases/09-multi-account-import-account-identity/09-CONTEXT.md` and `09-RESEARCH.md` §Real Sample Shape: real folder names, unknown categories stored raw today, Game_Forums EMAIL question
- `.claude/skills/sketch-findings-wot-gdpr-stats-visualizer/SKILL.md`: master-detail shell, 480px phone block, 44px floor

### Code
- `src/lib/worker/categories.ts`: `SUPPORTED` / `KNOWN_DEFERRED` classification
- `src/lib/worker/csv-columns.ts`, `classify.ts`, `ingest.worker.ts`, `db.ts`, `data-queries.ts`: parse, strip and storage paths
- `src/lib/shell/game-filter-state.ts`, `GameFilter.svelte`, `selection-state.ts`, `UnsupportedBlock.svelte`, `AccountTag.svelte`: filter tokens, shell wiring, footer
- `src/lib/features/playtime/*`, `src/lib/features/vehicles/*`, `src/lib/features/logins/*`: aggregation, title switcher, IP masking
- `src/lib/ui-copy.ts`: `GAME_NAMES` (HEAT, WOTC, WOWP already named), copy tables
- `tests/fixtures/*`: synthetic fixture builders (`multi-account-fixtures.ts`)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `GAME_FILTER_TOKENS` is the documented extension point; chips, panel and empty-game copy follow without markup change.
- Vehicles title select already carries Warplanes; `filterAfterTitleChange` leaves the shared filter alone for it.
- `AccountTag.svelte` and `accounts[]` ordering for row tags; `decimal.ts`, `windowing.ts` for exact sums and windowed tables.
- Device info pane (quick task 261012-bog) is the template for promoting a folder from unsupported to a pane.

### Established Patterns
- Promote a folder via `SUPPORTED`; cache replay re-derives status from stored names, so no Dexie bump for status.
- Worker-only Dexie access; main thread receives PII-free derived objects; IPs masked until one global reveal.
- Non-indexed `account` on rows; lazy `v`-keyed aggregate rebuild must agree with import-time aggregate.

### Integration Points
- HEAT and WOTC session files already feed Playtime under All games; per-game aggregates need those tokens.
- New categories currently unknown/stored raw: allowlist parsing must replace raw storage for them.
- e2e budget: 258 of 262 spec ceiling; new specs must raise or reconcile the three CI limits together.

</code_context>

<specifics>
## Specific Ideas

- Real sample (user's `2026-10-14.zip`): HEAT rows in account 234567890, WOTC and WoWS/WoWP in 1234567. Header inspection only.

</specifics>

<deferred>
## Deferred Ideas

- Filtering Finance or Logins by game.
- HEAT geolocation on the Logins map.
- Game_Forums `EMAIL` handling and other unknown categories (Phase 12 decision on strip vs masked store).

</deferred>

---

*Phase: 11-New Game Data*
*Context gathered: 2026-10-19*
