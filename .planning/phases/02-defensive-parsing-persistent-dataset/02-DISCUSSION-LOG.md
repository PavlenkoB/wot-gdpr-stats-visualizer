# Phase 2: Defensive Parsing & Persistent Dataset - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-28
**Phase:** 2-Defensive Parsing & Persistent Dataset
**Areas discussed:** Parse scope by tier, Return-visit experience, Import UX for drops, Clear-data control

---

## Parse scope by tier

| Option | Description | Selected |
|--------|-------------|----------|
| Supported-only (4 folders) | Only Activity_history, Player_statistics, User_Info, Payment_history parsed into rows; known-deferred/unknown stay at Phase 1's file-count classification | |
| All detected folders | Every category folder gets CSVs parsed into row counts, including known-deferred and unknown; requires the mojibake fix now | ✓ |
| You decide | | |

**User's choice:** All detected folders.

| Option | Description | Selected |
|--------|-------------|----------|
| Full row content, generic shape | Every row parsed and stored (header-keyed, untyped) even for folders no v1 dashboard reads | |
| Row counts only | CSVs parsed just far enough to count rows; row content discarded | |
| You decide | | ✓ |

**User's choice:** You decide. **Notes:** Claude's recommendation (recorded in CONTEXT.md D-02): full row content in a generic shape, since row-counts-only would force a re-upload later if a future phase needs that content (no zip bytes retained).

| Option | Description | Selected |
|--------|-------------|----------|
| Skip row, keep going | Malformed row dropped, logged to console.error, rest of file/category/export continues | ✓ |
| Fail the whole file | Malformed row fails that CSV file entirely; siblings and other categories still import | |
| You decide | | |

**User's choice:** Skip row, keep going.

| Option | Description | Selected |
|--------|-------------|----------|
| Console-only | Skipped rows logged to console.error only, nothing on screen | |
| Visible skip count | Results view shows e.g. "3 rows skipped" per affected category | ✓ |
| You decide | | |

**User's choice:** Visible skip count.

| Option | Description | Selected |
|--------|-------------|----------|
| Row count replaces file count | Badge shows "Activity_history — 1,204 rows" only | |
| Show both | Badge shows "Activity_history — 3 files, 1,204 rows" | ✓ |
| You decide | | |

**User's choice:** Show both.

| Option | Description | Selected |
|--------|-------------|----------|
| No cap, import everything | Relies on navigator.storage.persist() + browser quota; failures route through existing error path | ✓ |
| Warn above a threshold | Shows a non-blocking warning above some size threshold | |
| You decide | | |

**User's choice:** No cap, import everything.

**Notes:** User repeatedly chose "More questions" to go deeper on this area (6 questions total) before moving on.

---

## Return-visit experience

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-load results view | Page load checks IndexedDB; if cached, immediately shows results view populated from cache — no drop/click needed | ✓ |
| Landing state + explicit open | Shows "You have a cached export — Open / Import a different one" before results render | |
| You decide | | |

**User's choice:** Asked "what recommend and why, repeat question" first. Claude recommended auto-load (Phase 3's SC4 already locks this behavior in; a throwaway interim screen adds no privacy benefit). Re-asked with recommendation inline — **user selected auto-load results view (recommended)**.

| Option | Description | Selected |
|--------|-------------|----------|
| Brief loading spinner | Short spinner/skeleton covers the gap before swapping to results or dropzone | ✓ |
| Show dropzone first, then swap | Dropzone renders immediately, swaps if cache found — risks a flash | |
| You decide | | |

**User's choice:** Asked "what you recommend?" — Claude recommended the spinner (avoids flash of wrong state, consistent with Phase 1's D-10 floor philosophy). User selected the recommended option.

| Option | Description | Selected |
|--------|-------------|----------|
| Persisted, always shown | Skip counts stored per category in IndexedDB, always shown on the results view | ✓ |
| One-time only | Skip counts shown only right after the import that produced them | |
| You decide | | |

**User's choice:** Asked "what you recomend? in every questin show what you recomend" — Claude recommended persisted/always-shown (cheap to store, stays honest about completeness) and noted it would include a recommendation in every subsequent question. User selected the recommended option.

| Option | Description | Selected |
|--------|-------------|----------|
| Show import timestamp | "Imported on [date]" line near the summary/badges | ✓ |
| Don't show it | No timestamp stored or displayed | |
| You decide | | |

**User's choice:** Show import timestamp (recommended).

---

## Import UX for drops

| Option | Description | Selected |
|--------|-------------|----------|
| Per-category detail | Status text names the current category, e.g. "Parsing Player_statistics (3/8)..." | ✓ |
| Generic stage text only | Keeps Phase 1's simple "Parsing..." text | |
| You decide | | |

**User's choice:** Per-category detail (recommended) — matches SC1's "progress advancing per category" wording.

| Option | Description | Selected |
|--------|-------------|----------|
| "Already loaded" banner | Brief inline message before showing existing results | ✓ |
| Silent, just show results | No message, just re-shows results | |
| You decide | | |

**User's choice:** "Already loaded" banner (recommended).

| Option | Description | Selected |
|--------|-------------|----------|
| Warn before replacing | Confirm step before wiping the old dataset for a different zip drop | ✓ |
| Silent replace, no warning | Immediately replaces, consistent with Phase 1's D-14 philosophy | |
| You decide | | |

**User's choice:** Warn before replacing (recommended) — this is now a genuinely destructive action, unlike Phase 1 when nothing was persisted.

| Option | Description | Selected |
|--------|-------------|----------|
| In-app inline confirm | Styled panel consistent with the app's own UI | ✓ |
| Native browser confirm() | Plain OS-level dialog | |
| You decide | | |

**User's choice:** In-app inline confirm (recommended).

| Option | Description | Selected |
|--------|-------------|----------|
| Just shows dropzone | Cached data stays untouched; view-state reset only | |
| Also clears cached data | "Start over" becomes equivalent to "Clear my cached data" | ✓ |
| You decide | | |

**User's choice:** Also clears cached data. **Notes:** User explicitly rejected Claude's recommendation (just show dropzone, keep Start-over as a pure view reset) in favor of converging Start-over with data clearing.

| Option | Description | Selected |
|--------|-------------|----------|
| Same inline confirm | "Start over" shows the same confirm panel as replace-warning | ✓ |
| No confirm, immediate | Wipes immediately with no confirm | |
| You decide | | |

**User's choice:** Same inline confirm (recommended) — consistency across every action that deletes the cached dataset.

---

## Clear-data control

| Option | Description | Selected |
|--------|-------------|----------|
| Same button | One control replaces both "Start over" and a separate clear button | |
| Two separate buttons | "Start over" and a distinct "Clear my cached data" control both exist, same underlying wipe | ✓ |
| You decide | | |

**User's choice:** Two separate buttons. **Notes:** User explicitly rejected Claude's recommendation (single shared button) in favor of two distinct controls.

| Option | Description | Selected |
|--------|-------------|----------|
| Persistent header/footer control | Visible on both dropzone and results view | ✓ |
| Results view only | Only appears alongside results, next to Start over | |
| You decide | | |

**User's choice:** Persistent header/footer control (recommended) — DATA-02 requires discoverability across app states.

| Option | Description | Selected |
|--------|-------------|----------|
| Hidden when nothing cached | Control only renders once a dataset exists | ✓ |
| Always visible, disabled when empty | Greyed out with nothing to clear | |
| You decide | | |

**User's choice:** Hidden when nothing cached (recommended).

| Option | Description | Selected |
|--------|-------------|----------|
| Silent, just empty dropzone | No message after confirming a clear | |
| Brief acknowledgment | Short-lived "Cached data cleared" message | ✓ |
| You decide | | |

**User's choice:** Brief acknowledgment. **Notes:** User rejected Claude's silent-transition recommendation in favor of explicit feedback — consistent with the pattern of choosing more explicit UX throughout this session.

| Option | Description | Selected |
|--------|-------------|----------|
| Spell out consequence | Confirm copy states what's lost and that re-upload will be needed | ✓ |
| Short question only | Bare "Clear your cached data?" | |
| You decide | | |

**User's choice:** Spell out consequence (recommended) — matches the explicit/safety-conscious direction chosen throughout.

| Option | Description | Selected |
|--------|-------------|----------|
| Same copy for both | "Start over" and "Clear my cached data" share the identical confirm panel and wording | ✓ |
| Different wording per button | Each button's confirm is framed differently despite doing the same thing | |
| You decide | | |

**User's choice:** Same copy for both (recommended).

---

## Claude's Discretion

- Row storage shape for known-deferred/unknown folders (full generic row content recommended over counts-only)
- Exact Dexie/IndexedDB schema layout (table-per-known-CSV vs. generic shape) — storage engine itself already locked in PROJECT.md
- Whether the duplicate-detection hash is computed from raw file bytes or unzipped content
- Visual styling of the persistent clear-data control, progress text, and badges (icons, spacing, typography) — no design system referenced yet

## Deferred Ideas

None — discussion stayed within Phase 2 scope.
