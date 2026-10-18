# Phase 10: Merged Dashboard Across Accounts - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-18
**Phase:** 10-Merged Dashboard Across Accounts
**Areas discussed:** Game filter shape, Overlap & double-count, Rows: vehicles & source account, Finance totals & scale checks, plus follow-ups (caption, tag identity, Overview, storage)

---

## Game filter shape

| Option | Description | Selected |
|--------|-------------|----------|
| One shared filter | State shared by Playtime and Vehicles | ✓ |
| Per-pane control | Each pane keeps own selection | |

| Option | Description | Selected |
|--------|-------------|----------|
| Filter narrows everything, split stays | All keeps GAME split | ✓ |
| Filter replaces GAME split | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Filter drives the title switcher | No second widget on Vehicles | ✓ |
| Keep switcher independent | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Vehicles falls back to first title with rows on All | Existing worker rule | ✓ |
| Shared All plus local Vehicles title | | |

| Option | Description | Selected |
|--------|-------------|----------|
| In each pane header, shared, session-only | | ✓ |
| In the list-pane column | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Only WoT, WoTB, WoWS; HEAT/WOTC in All only | | ✓ |
| Offer every token present | | |

**User's choice:** all recommended options.

---

## Overlap & double-count

| Option | Description | Selected |
|--------|-------------|----------|
| Merge globally, any game | Union of wall-clock | ✓ |
| Merge only within a game | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Merged interval = one session | | ✓ |
| Sessions = raw rows, hours = union | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse v1.0 merge, add hand-computed 2-account fixture | | ✓ |
| Re-audit merge rules | | |

**User's choice:** all recommended options.

---

## Rows: vehicles & source account

| Option | Description | Selected |
|--------|-------------|----------|
| Two rows, one per account | | ✓ |
| One summed row per vehicle | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Short account tag chip, full ID in detail | | ✓ |
| Dedicated Account column | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Searchable text only, no sort control | | ✓ |
| Add sort-by-account | | |

**User's choice:** all recommended options.

---

## Finance totals & scale checks

| Option | Description | Selected |
|--------|-------------|----------|
| Logins: no card, rows carry tag | | ✓ |
| Per-account summary card | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Sum per currency, rows carry tag, split in detail | | ✓ |
| Sum per currency, no per-row account | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Synthetic 3-account fixture, unit + one e2e with node-count and time assertions | | ✓ |
| Unit tests only | | |

**User's choice:** all recommended options.

---

## Follow-up gray areas

| Topic | Selected |
|-------|----------|
| Caption: keep, reworded "All N accounts" | ✓ |
| Tag identity: letters A/B/C by header order | ✓ |
| Overview: leave as Phase 9 | ✓ |
| Storage: non-indexed, no Dexie bump unless measured | ✓ |

## Claude's Discretion

- Visual treatment of chips, copy wording, fixture thresholds, location of filter state.

## Deferred Ideas

- Per-account cards/picker, Overview totals, sort-by-account, HEAT/WOTC filter choices (Phase 11), cross-account duplicate account-level files (Phase 12).
