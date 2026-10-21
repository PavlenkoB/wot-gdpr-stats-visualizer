# Phase 12: Account Timeline & Perks - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-20
**Phase:** 12-Account Timeline & Perks
**Areas discussed:** Email policy, Pane structure & timeline layout, Cross-account duplicates, Codes & IP reveal rules

---

## Email policy

| Option | Description | Selected |
|--------|-------------|----------|
| Strip at import (Recommended) | Email columns never stored; timeline shows an entry existed, not the address | ✓ |
| Store, render masked | Keep value in IndexedDB, masked, no reveal | |
| Strip, keep a derived hint | Never store the address, keep e.g. the domain | |

**User's choice:** Strip at import.

### Game_Forums EMAIL (left open in Phase 11)

| Option | Description | Selected |
|--------|-------------|----------|
| Allowlist now, no pane (Recommended) | Empty allowlist; file counted, nothing stored | ✓ |
| Close all unknown folders | Verify and test count-only for every unknown folder | |
| Leave as is | Keep deferred | |

**User's choice:** Allowlist now, no pane.
**Notes:** Planner must verify whether Phase 11 D-15 already stops raw storage of unknown folders (the Phase 9 research said they were stored raw).

---

## Pane structure & timeline layout

| Option | Description | Selected |
|--------|-------------|----------|
| Two rows (Recommended) | "Account timeline" and "Perks" | ✓ |
| One row per category | Nine list rows | |
| Three rows | Timeline, Bans & third parties, Perks | |

**User's choice:** Two rows.

| Option | Description | Selected |
|--------|-------------|----------|
| One merged list (Recommended) | Single date-ordered list with kind badges | ✓ |
| Three sections | Separate blocks per kind | |
| Merged list + sections toggle | Both, with a switch | |

**User's choice:** One merged list.

| Option | Description | Selected |
|--------|-------------|----------|
| In the same timeline (Recommended) | Bans and third parties are dated entries | ✓ |
| Separate cards under the timeline | Own cards in the same pane | |

**User's choice:** In the same timeline.

| Option | Description | Selected |
|--------|-------------|----------|
| Stacked cards (Recommended) | One card per perk kind, fixed order | ✓ |
| Single list with kind badges | Merged list | |

**User's choice:** Stacked cards.

---

## Cross-account duplicates

| Option | Description | Selected |
|--------|-------------|----------|
| Dedupe identical rows (Recommended) | Collapse identical rows, show every account's chip | ✓ |
| Show per account | Each account's copy listed | |
| Show once, first account only | Keep only the first account's file | |

**User's choice:** Dedupe identical rows.

| Option | Description | Selected |
|--------|-------------|----------|
| All allowlisted columns equal (Recommended) | Conservative key | ✓ |
| Date + kind + value only | Looser key | |

**User's choice:** All allowlisted columns equal.

---

## Codes & IP reveal rules

| Option | Description | Selected |
|--------|-------------|----------|
| Same global reveal as IPs (Recommended) | One control unmasks IPs and codes | ✓ |
| Separate codes reveal | Second control for codes | |
| Never reveal codes | Masked form only | |

**User's choice:** Same global reveal as IPs.

---

## Claude's Discretion

- Masked form for codes and IPs, copy and visuals, survey row contents once headers are known, where dedupe lives, e2e budget reconciliation.

## Deferred Ideas

- Forums pane; filtering new panes by game; separate codes reveal; non-reversible email hint on entries; sort-by-account and account picker.
