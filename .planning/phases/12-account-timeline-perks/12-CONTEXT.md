# Phase 12: Account Timeline & Perks - Context

**Gathered:** 2026-10-20
**Status:** Ready for planning

<domain>
## Phase Boundary

The user can read the account's history and entitlements: what it was called, where it was linked, where it was registered, what was enforced against it, and what it received. Requirements: TIMELINE-01, TIMELINE-02, PERKS-01, PERKS-02, PERKS-03.

In scope: an "Account timeline" pane (name history, external-services history, language/country history, bans, authorized third parties); a "Perks" pane (subscriptions, personal coupons, bonus-code usage, surveys); per-file column allowlists with a per-header PII unit test; cross-account dedupe of identical account-level rows; zero-network assertions extended to both panes; closing the raw-storage hole for `Game_Forums`.

Out of scope: a forums pane, filtering the new panes by game, an account picker, new Overview totals, FX or any other new capability.

</domain>

<decisions>
## Implementation Decisions

### Email policy (resolves the PRIV-01 vs TIMELINE-01 open decision)
- **D-01:** Emails are stripped at import and never stored. Email columns are excluded from every Phase 12 allowlist by construction, so the timeline shows that an entry existed (date, kind, service, value other than the address) but never the address. There is no reveal path and nothing to mask. PRIV-01 is satisfied outright and TIMELINE-01's "masked" is met in the strictest form. — **Reversibility:** costly — **Reversibility rationale:** the allowlist defines the stored row shape; storing emails later needs a cache rebuild and a new masking and reveal story.
- **D-02:** `Game_Forums/WOT_Forum_User_Info.csv` (header has `EMAIL`, `IP_ADDRESS`, `BDAY_*`) gets an allowlist that stores no columns this phase: the file is counted as present, nothing from it is stored, and no pane is added. Planner verifies the current behaviour first: Phase 11 D-15 says unknown folders are counted, not stored, while the Phase 9 research said they were stored raw. If D-15 already holds, the work is a test that plants a synthetic email in a forum fixture and asserts it reaches neither IndexedDB nor any pane, plus an in-place narrowing of caches that already hold the raw rows (the Phase 11 D-14 pattern). — **Reversibility:** reversible — **Reversibility rationale:** an empty allowlist entry and a test; a forums pane could add columns later with a rebuild.
- **D-03:** Every Phase 12 category (names, services, language/country, bans, authorized third parties, subscriptions, personal coupons, bonus codes, surveys) uses the Phase 11 mechanism: a per-file column allowlist enforced at the supported-folder row-storing choke point beside `reduceBlobRow`, one unit test per file header that plants a synthetic email and asserts it reaches neither IndexedDB nor any rendered pane (PRIV-01), and a header that matches none of its allowlist still imports successfully and shows an empty state with the file named in the pane's provenance line (Phase 11 D-09). Previously stored raw rows are narrowed in place by an idempotent step (Phase 11 D-14).
- **D-04:** Research reads the real export's column headers only, never cell values, using the values-free header-capture script pattern from Phase 11 (`11-RESEARCH.md`). Headers for these folders are not yet verified, so plans carry a Wave 0 `checkpoint:human-action` where the user runs the script and supplies names only; allowlist and fixture tasks depend on it. Fixtures stay synthetic; the real zip is never committed.

### Panes and layout
- **D-05:** Two new rows in the master-detail list: "Account timeline" and "Perks". Each row shows only when the export holds data for it, as for HEAT. Every row in both panes carries the account tag chip (Phase 10 D-10), hidden on a single-account dataset. — **Reversibility:** reversible — **Reversibility rationale:** list entries and components; no storage or schema.
- **D-06:** Account timeline is one merged, date-ordered list. Each entry has a kind badge (Name, Service, Language, Country, Ban, Third party), the value, the date and the account tag. A kind chip row may narrow the list (same chip-row pattern as the game filter); this is a pane-local control, not shared state. Name, service and language/country history entries all appear in this one chronology.
- **D-07:** Bans and Authorized_Third_Parties are dated entries in the same timeline, so one chronology also answers "what was enforced against it". IPs inside them are masked until the global reveal.
- **D-08:** Perks is stacked cards in a fixed order: Subscriptions, Personal coupons, Bonus codes, Surveys. Each card has its own empty state and shows the account tag per row. A card whose file is absent shows an empty state, never an error.
- **D-09:** The "Not yet supported" footer shrinks as these folders gain a pane (the Phase 11 behaviour); `Game_Forums` stays listed as not shown.

### Cross-account duplicates
- **D-10:** Subscriptions, External_Services_History and Language_And_Country_History repeat per account (identical byte sizes in the real sample). Rows identical across accounts collapse into one entry that carries every contributing account's tag chip (one chip per account, as a login row does, Phase 10 D-18). Rows that differ in any stored column stay separate. — **Reversibility:** reversible — **Reversibility rationale:** a read-time grouping; storage stays per account.
- **D-11:** "Identical" means every allowlisted column is equal. No looser key, so deduping can never hide a real difference.
- **D-12:** Storage stays per account with the non-indexed `account` field and no Dexie bump (Phase 9 D-07, Phase 10 D-16); dedupe happens when the pane model is built. Planner may choose where (reader or model) provided the lazy `v`-keyed aggregate rule holds.

### Codes and IP reveal
- **D-13:** Coupon codes, bonus codes and the user IP in bonus-code usage are masked by default and unmasked only by the existing single global reveal (`reveal-state.ts`) that already governs IPs in Logins and HEAT. No new control and no per-pane reveal. — **Reversibility:** reversible — **Reversibility rationale:** one shared reveal state; a separate control could be added later.
- **D-14:** Bans, authorized-third-party and any other IPs follow the same rule: masked until the global reveal, never revealed individually.
- **D-15:** Zero-network Playwright assertions are extended to both new panes (PRIV-02). A planted synthetic email never appears in clear text on any page. Any table over a few thousand rows is windowed or aggregated; no per-row SVG nodes (SCALE-01 binds).

### Claude's Discretion
- Masked form for codes and IPs (shape and how many characters show), within the existing IP masking pattern.
- Exact copy, badge colours, card visuals and kind-chip order within the Day 10 shell and sketch findings.
- What survey rows show once headers are known, provided the allowlist holds and no free text outside it is stored.
- Where dedupe lives (reader vs pane model).
- e2e budget: the three CI limits (258 spec ceiling history) must be raised or reconciled together if new specs push past them.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements and roadmap
- `.planning/ROADMAP.md` §Phase 12 and §Planning Notes (the open PRIV-01 vs TIMELINE-01 decision, now closed by D-01)
- `.planning/REQUIREMENTS.md`: TIMELINE-01, TIMELINE-02, PERKS-01..03, PRIV-01, PRIV-02, SCALE-01
- `.planning/PROJECT.md`: core value, zero-network, hand-rolled charts, no new dependencies

### Prior decisions that bind this phase
- `.planning/phases/11-new-game-data/11-CONTEXT.md`: D-08..D-11 column allowlist and empty-state mechanism, D-14 in-place narrowing, D-15 choke point, D-01/D-03 pane-row pattern
- `.planning/phases/11-new-game-data/11-RESEARCH.md`: values-free header-capture script and the Wave 0 human-action pattern
- `.planning/phases/10-merged-dashboard-across-accounts/10-CONTEXT.md`: D-10 account tag chip, D-13 IP masking and single reveal, D-16 non-indexed `account`, D-18 several chips per row
- `.planning/phases/09-multi-account-import-account-identity/09-CONTEXT.md` and `09-RESEARCH.md` §Real Sample Shape: real folder names, per-account duplicates, `Game_Forums` EMAIL (Open Question 1)
- `.claude/skills/sketch-findings-wot-gdpr-stats-visualizer/SKILL.md`: master-detail shell, 480px phone block, 44px floor

### Code
- `src/lib/worker/categories.ts`: `SUPPORTED` / `KNOWN_DEFERRED` classification
- `src/lib/worker/csv-columns.ts`, `classify.ts`, `ingest.worker.ts`, `db.ts`, `data-queries.ts`: parse, strip and storage paths (allowlist choke point, `narrowStoredNewDataRows`, `reduceBlobRow`)
- `src/lib/shell/selection-state.ts`, `UnsupportedBlock.svelte`, `AccountTag.svelte`, `reveal-state.ts`, `Dashboard.svelte`, `ListPane.svelte`, `DetailPane.svelte`: shell wiring, footer, tag chip, global reveal
- `src/lib/features/logins/*`: IP masking and several-accounts-per-row pattern
- `src/lib/ui-copy.ts`: copy tables
- `tests/fixtures/multi-account-fixtures.ts`: synthetic fixture builders; `tests/e2e/guards/zero-network.spec.ts`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Phase 11 new-game panes (HEAT, WoWS crews & storage) are the template for a promoted folder with allowlist, provenance line and empty state.
- `AccountTag.svelte` and `accounts[]` ordering for tags; `windowing.ts` for large tables; the Device info pane (quick task 261012-bog) for a simple folder-to-pane promotion.
- `reveal-state.ts` single global reveal already used for IPs.

### Established Patterns
- Promote a folder via `SUPPORTED`; cache replay re-derives status from stored names, so no Dexie bump for status.
- Worker-only Dexie access; main thread receives PII-free derived objects; IPs masked until one global reveal.
- Non-indexed `account` on rows; lazy `v`-keyed aggregate rebuild must agree with import-time aggregate.

### Integration Points
- The new folders (`Account_Name_History`, `External_Services_History`, `Language_And_Country_History`, `Bans`, `Authorized_Third_Parties`, `Subscriptions`, `Personal_Coupons`, `Bonus_Codes`, `Surveys`) are unknown today; each moves to `SUPPORTED` with a spec.
- e2e budget: new specs must raise or reconcile the three CI limits together.

</code_context>

<specifics>
## Specific Ideas

- Real sample (user's `2026-10-14.zip`): account 234567890 holds Authorized_Third_Parties, Bans, Bonus_Codes, Personal_Coupons, Subscriptions, Surveys, Game_Forums plus `Account_Name_History.csv`, `External_Services_History.csv`, `Language_And_Country_History.csv`; account 345678901 has Subscriptions and the two history files; account 1234567 has Bonus_Codes only. Header inspection only; the zip is never committed.

</specifics>

<deferred>
## Deferred Ideas

- A forums pane and storing any `Game_Forums` column.
- Filtering the new panes by game.
- A separate reveal control for codes.
- Showing a non-reversible email hint (e.g. domain) on timeline entries.
- Sort-by-account and an account picker (already rejected for v1.1).

</deferred>

---

*Phase: 12-Account Timeline & Perks*
*Context gathered: 2026-10-20*
