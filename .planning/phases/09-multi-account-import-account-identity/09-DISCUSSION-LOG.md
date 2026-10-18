# Phase 9: Multi-account Import & Account Identity - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-16
**Phase:** 9-Multi-account Import & Account Identity
**Areas discussed:** Account-root detection, Stored shape & provenance, Interim pane behaviour, Identity header for N accounts

---

## Account-root detection

| Option | Description | Selected |
|--------|-------------|----------|
| Recognised category beneath | Folder is an account if it directly holds ≥1 recognised category; name not checked | ✓ |
| Digits-only name AND category | Stricter; rejects renamed roots | |
| Category beneath, digits preferred | Accept any name, note non-numeric | |

**User's choice:** Recognised category beneath.

| Option | Description | Selected |
|--------|-------------|----------|
| Fail with generic banner | Account folders beside a stray unknown folder stay rejected (SC4) | ✓ |
| Import, list it as unknown | Lenient; contradicts SC4 | |

**User's choice:** Fail with generic banner.

| Option | Description | Selected |
|--------|-------------|----------|
| Accept, wrapper stays transparent | Multi-root under `personal_data_export/` | ✓ |
| Only unwrapped multi-root | Wrapped multi-root fails | |

**User's choice:** Accept, wrapper stays transparent.

| Option | Description | Selected |
|--------|-------------|----------|
| Reject: generic banner | Rootless category beside account roots | ✓ |
| Treat rootless as its own '' account | Weakens fail-closed | |

**User's choice:** Reject.

**Notes:** After the user supplied the real zip, found loose `Readme_en.pdf` / `Readme_ru.pdf` beside the account folders (no wrapper). Chosen: ignore any top-level file (over a `Readme_*.pdf` allow-list).

---

## Stored shape & provenance

| Option | Description | Selected |
|--------|-------------|----------|
| Non-indexed `account` field | No Dexie bump; v1.0 caches survive | ✓ |
| Indexed `account`, Dexie v3 | Wipes caches unless a lossless upgrader is written | |

**User's choice:** Non-indexed `account` field.

| Option | Description | Selected |
|--------|-------------|----------|
| accounts[] on the meta record | Legacy top-level fields kept | ✓ |
| Separate accounts table | Needs a bump; overkill for ≤3 accounts | |

**User's choice:** accounts[] on meta.

---

## Interim pane behaviour

| Option | Description | Selected |
|--------|-------------|----------|
| All accounts' rows, labelled | "N accounts combined" caption; correctness is Phase 10 | ✓ |
| Primary account only, labelled | Hides other accounts' data | |
| Gate panes until Phase 10 | Fails the spirit of SC2 | |

**User's choice:** All accounts' rows, labelled.

| Option | Description | Selected |
|--------|-------------|----------|
| One aggregate over all accounts | Existing aggregators, playtime already merges overlaps | ✓ |
| Per-account aggregates in accounts[] | Cannot merge overlaps exactly; Phase 10 re-aggregates anyway | |

**User's choice:** One aggregate over all accounts.

---

## Identity header for N accounts

| Option | Description | Selected |
|--------|-------------|----------|
| Stacked list of account rows | All visible, v1.0 look for one account | ✓ |
| Summary line + disclosure | Hides what SC1 requires listed | |

**User's choice:** Stacked list.

| Option | Description | Selected |
|--------|-------------|----------|
| Session files | Game token from `*_Game_Sessions.csv` with rows; years from min/max session start | ✓ |
| Any game-named file or category | Blends unreliable sources | |

**User's choice:** Session files.

| Option | Description | Selected |
|--------|-------------|----------|
| First activity year ascending | Reads as a migration timeline | ✓ |
| Account ID ascending | | |
| Zip folder order | | |

**User's choice:** First activity year ascending.

| Option | Description | Selected |
|--------|-------------|----------|
| Every token with sessions, friendly names | WOT, WOTB, WOWS, WOTC, HEAT; unknown shown raw | ✓ |
| Only WoT, WoTB, WoWS | Hides HEAT and Console play | |

**User's choice:** Every token with sessions.

---

## Claude's Discretion

- Visual styling of account rows; caption wording; synthetic fixture design; where the per-account parse loop lives; how the account list crosses the worker message contract.

## Deferred Ideas

- Merged correctness, game filter, overlap counting, source-account column (Phase 10).
- Cross-account duplicate account-level files (Phase 12).
- HEAT/WOTC panes and WOWP/WOWS statistics (Phase 11).
