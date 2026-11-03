# Phase 10: Merged Dashboard Across Accounts - Context

**Gathered:** 2026-10-18
**Status:** Ready for planning

<domain>
## Phase Boundary

With several accounts loaded, the user reads their whole history as one: combined playtime, finance, vehicles and login history, filterable by game, without double-counting and without losing which account a row came from. Requirements: ACCOUNT-04, ACCOUNT-06, ACCOUNT-07, SCALE-01.

In scope: a shared game filter (WoT, WoTB, WoWS) on Playtime and Vehicles; cross-account overlap merging in Playtime; per-account vehicle rows and per-row account tags; Logins and Payments rows carrying the account tag; per-currency finance totals across accounts; the large three-account fixture (54,000-row `Virtual_Currencies`) with node-count and zero-network proof.

Out of scope: HEAT / WOTC / WOWP / WoWS-crew panes and their filter choices (Phase 11), timeline and perks (Phase 12), an account picker or per-account view (rejected: merge-only), FX conversion, new Overview totals.

Phase 9 already guarantees: every stored row carries a non-indexed `account`; `accounts[]` on meta; panes read all accounts with an interim "N accounts combined" caption; `readRowsByFile` per-account grouping (CR-01 gap closure 09-07).

</domain>

<decisions>
## Implementation Decisions

### Game filter
- **D-01:** One shared game filter for Playtime and Vehicles. Choices: All games, WoT, WoTB, WoWS. State is shell-level component state (no route, no storage), shared by both panes, session-only: reset on reload and on a new import. — **Reversibility:** reversible — **Reversibility rationale:** component state and a chip row; no storage or schema.
- **D-02:** The filter renders as the same chip row inside each pane's header (not in the master/list column), so it does not appear on panes it does not affect (Finance, Logins, Device info).
- **D-03:** On Playtime the filter narrows everything: tiles, calendar heatmap, weekday-by-hour grid, session durations. "All games" keeps the existing `GAME` split view. One game shows that game's own totals. The filter does not replace the `GAME` splitter.
- **D-04:** On Vehicles the shared filter drives the existing WoT / WoTB / WoWS title switcher (no second widget). Vehicles has no "All games" view because stat shapes differ per title: with the filter on All, Vehicles falls back to the existing worker rule (first title that has rows, else WoT); changing the title on Vehicles sets the shared filter.
- **D-05:** Only WoT, WoTB and WoWS are filter choices in Phase 10. HEAT and WOTC sessions count in "All games" only. Build the choice list from the game tokens present in the data so Phase 11 extends it without rework. — **Reversibility:** reversible — **Reversibility rationale:** a list of tokens; Phase 11 adds entries.

### Overlap and double-counting
- **D-06:** Overlap is merged globally across accounts and games: wall-clock time is counted once. Hours are the union of intervals. Under a game filter, only that game's intervals are unioned, so "All" total hours can be less than the sum of per-game totals; this is expected and should be explained in the pane's about text.
- **D-07 (amended at plan-phase 2026-10-18):** Sessions and active days keep v1.0 counting: sessions = usable rows (contained and zero-length included), active days by session start day. Only hours dedupe overlap (union of intervals). The original wording ("merged interval = one session") was withdrawn because it changes every single-account number and contradicts D-08's reuse of the v1.0 hand fixture.
- **D-08:** No change to the v1.0 merge rules. Reuse the existing merge, and prove it with a hand-computed two-account fixture (overlapping, touching and disjoint sessions) whose expected hours, sessions and active days are written in the test. Planner/research checks the merge is correct when sessions arrive from different accounts (same-start ties, ordering independent of account order).

### Rows, source account, vehicles
- **D-09:** Vehicles with the same id in two accounts stay as two rows, one per account. "Combines the accounts' stats" is delivered by combined tiles and summaries (battle-type summary sums per code across accounts), not by collapsing vehicle rows. The Phase 9 index-keyed `{#each}` blocks stay index-keyed.
- **D-10:** Every listed row (vehicles, logins, payments) shows a short account tag chip: a letter A / B / C assigned in identity-header order (first activity ascending, the Phase 9 D-16 order). The header rows show their letter as the legend. The row detail / accessible name exposes the full account ID and nickname. Tags are hidden entirely on a single-account dataset. Chip must keep the 44px touch floor and the 480px phone block.
- **D-11:** Account is searchable text only: the existing search matches the tag and account ID. No sort-by-account, no account picker, no new session table. Aggregated Playtime buckets stay aggregates.
- **D-12:** The Phase 9 caption is kept and reworded "All N accounts combined"-style (exact copy is Claude's discretion). Hidden for one account.

### Logins and finance
- **D-13:** Logins: one table and one country map across accounts. No per-account record card (the identity header already lists accounts). Each login row carries the account tag. IPs stay masked until the single global reveal; city-level detail stays an explicit opt-in that fetches nothing until asked. Country list counts cover all accounts.
- **D-14:** Finance and Payments: same-currency amounts sum across accounts (exact decimal), never converted or blended. Payments rows carry the account tag; any per-account split of a total lives in detail only, not as extra headline figures.
- **D-15:** Overview card keeps its Phase 9 shape (headline "N accounts"); no combined totals added there.

### Decisions recorded at plan-phase (2026-10-18)
- **D-18:** A login row is one distinct IP and may carry several accounts: render one account chip per account on that row, first column wide enough for two chips (UI-SPEC amended by the planner).
- **D-19:** Approved: the nickname appears as visually-hidden text content in tagged rows (text only, never in an attribute, title or aria-label). This relaxes v1.0 D-21 for rows; the privacy e2e assertion is restated accordingly.
- **D-20:** Vehicles header with several accounts sums lifetime battles and shows an expiry only when exactly one account contributes.
- **D-21:** Playtime filter reaches the worker through stored per-game aggregates (`byGame`, `games`, `PLAYTIME_VERSION` 2 to 3) and an optional validated `game` on the query; Vehicles maps the filter to its existing `title` ask. See 10-RESEARCH.md.

### Storage and scale
- **D-16:** Stay with the non-indexed `account` field and in-memory filtering, no Dexie bump (Phase 9 D-07). Research may recommend an indexed key plus lossless upgrader only if the large fixture measures a freeze. — **Reversibility:** costly — **Reversibility rationale:** an indexed key needs a `version(3)` Dexie bump and a lossless upgrader; the pinned `db.test.ts` version test encodes version 2.
- **D-17:** SCALE-01 proof: a generated synthetic three-account fixture including a 54,000-row `Virtual_Currencies` file. Unit tests assert aggregation outputs; one browser e2e imports it and asserts rendered DOM node counts stay bounded by buckets or windows (not rows), a generous import-to-first-render time cap, and zero network requests through the merged flows. e2e budget is at 258 of 262 ceiling after Phase 9; new specs must raise or reconcile the three CI limits together.

### Claude's Discretion
- Exact visual treatment of the filter chip row and the account tag chip within the Day 10 master-detail shell and sketch findings.
- Exact caption and about-text wording (including the "All total can be smaller than the sum of games" explanation).
- Fixture design details and node-count thresholds.
- Where the shared filter state lives in the shell (`selection-state.ts` vs a sibling module).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements and roadmap
- `.planning/ROADMAP.md` §Phase 10 and §Planning Notes: goal, five success criteria, UI conventions, e2e budget
- `.planning/REQUIREMENTS.md`: ACCOUNT-04, ACCOUNT-06, ACCOUNT-07, SCALE-01
- `.planning/PROJECT.md`: core value, zero-network, hand-rolled charts, no new dependencies

### Prior decisions that bind this phase
- `.planning/phases/09-multi-account-import-account-identity/09-CONTEXT.md`: D-07 non-indexed `account`, D-09 single aggregates, D-11 caption, D-12 reader keying, D-13..D-17 identity header and ordering
- `.planning/phases/09-multi-account-import-account-identity/09-RESEARCH.md` §Reader scoping: table of what each reader leaves for Phase 10 (vehicle merge, finance per-currency totals, logins account record, battle-type summing); open questions 2, 3, 8
- `.planning/phases/09-multi-account-import-account-identity/09-10-SUMMARY.md`: account-count semantics and the published accounts list
- `.planning/phases/09-multi-account-import-account-identity/09-REVIEW.md` and `09-REVIEW-DISPOSITION.md`: CR-01 and anything left open
- `.claude/skills/sketch-findings-wot-gdpr-stats-visualizer/SKILL.md`: master-detail shell, 480px phone block, 44px floor

### Code
- `src/lib/features/playtime/playtime-aggregate.ts`, `playtime-model.ts`, `playtime-shared.ts`, `playtime-state.ts`: interval merge, `GAME` split, `sessionFileGame`
- `src/lib/features/vehicles/vehicle-aggregate.ts`, `vehicle-shared.ts`, `vehicle-state.ts`, `vehicle-model.ts`: title selection, `buildSummary`
- `src/lib/features/finance/finance-aggregate.ts`: currency/year/game/card maps
- `src/lib/features/logins/login-aggregate.ts`, `login-model.ts`, `map-model.ts`: `buildLogins` single-account record
- `src/lib/worker/db.ts`, `data-queries.ts`: `readSessionRowData`, `readRowsByFile`, per-account grouping
- `src/lib/shell/selection-state.ts`, `IdentityHeader.svelte`, `identity-model.ts`, `overview-model.ts`: shared selection state and account ordering
- `src/lib/ui-copy.ts`: `GAME_NAMES`, `formatGameName`
- `tests/unit/import/db.test.ts`, `tests/fixtures/export-fixtures.ts`: pinned Dexie version, multi-account fixtures

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Playtime aggregation already merges overlapping intervals and splits by `GAME` (derived from the session file name via `sessionFileGame`); the filter is a pre-aggregation selection on game, not a new engine.
- Vehicles already selects a title (WoT / WoTB / WoWS) with a worker fallback; the shared filter feeds that selection.
- `accounts[]` on meta with D-16 ordering gives the stable A/B/C tag assignment.
- `decimal.ts` for exact per-currency summing; `windowing.ts` for windowed tables.

### Established Patterns
- Non-indexed meta/row fields, no Dexie bump; lazy `v`-keyed aggregate rebuild must agree with the import-time aggregate.
- Selection as component state, never a route; one 480px phone block; 44px touch floor; hand-rolled SVG/CSS grid.
- Worker-only Dexie access; main thread receives derived, PII-free objects; IPs masked until the single global reveal.

### Integration Points
- Game filter value must reach the worker queries for Playtime and Vehicles (the stored `playtime` aggregate is all-games; a filtered view needs a recompute or per-game aggregates).
- `buildLogins` takes one account record today; row model needs an account field instead.
- Row models for vehicles, logins and payments gain an account tag; the tag list comes from `accounts[]` order.

</code_context>

<specifics>
## Specific Ideas

- Hand-computed two-account fixture with overlap, touching and disjoint sessions, expected values written into the test (explicit success criterion).
- Large fixture is generated, not the real sample (the real `2026-10-14.zip` is the user's own data and must not be committed).

</specifics>

<deferred>
## Deferred Ideas

- Per-account summary cards on Logins and a per-account picker: rejected for v1.1 (merge-only).
- Combined headline totals on the Overview card.
- Sort-by-account control.
- HEAT / WOTC filter choices and panes: Phase 11.
- Cross-account duplicate account-level files (Subscriptions, External_Services_History, Language_And_Country_History): Phase 12.

</deferred>

---

*Phase: 10-Merged Dashboard Across Accounts*
*Context gathered: 2026-10-18*
