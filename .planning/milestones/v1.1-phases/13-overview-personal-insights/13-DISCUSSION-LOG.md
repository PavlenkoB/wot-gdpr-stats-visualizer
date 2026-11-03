# Phase 13: Overview personal insights - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-23
**Phase:** 13-Overview personal insights
**Areas discussed:** Data path and computation home, Multi-account and game scope rules, Tank-name table sourcing, Open design decisions

---

## Data path and computation home

| Option | Description | Selected |
|--------|-------------|----------|
| New 'overview' worker channel | One channel answers all tiles from one Dexie snapshot; memoised; cannot supersede an open pane | ✓ |
| Reuse existing channel queries | Derive from playtime, vehicles and finance results; supersede risk and missing fields | |
| Main-thread from stored rows | Simplest; breaks the worker pipeline rule | |

**User's choice:** New 'overview' worker channel.

Follow-ups: old status chips and section cards are replaced, tiles link into panes (chosen over keeping a strip or "you decide"); skeleton tiles then fill (chosen over blocking until ready).

---

## Multi-account and game scope rules

| Option | Description | Selected |
|--------|-------------|----------|
| Largest account per game, with a note | Never sum; name the account used | |
| Newest export wins | Use the newest account | |
| Sum across accounts, flag overlap | Add all accounts, warn about possible double count | ✓ (clarified) |

**User's choice:** Sum across accounts.
**Notes:** The first overlap question was unclear to the user. After a worked example they explained: several accounts inside one zip are summed, and a fresh zip replaces everything and counts from zero. That matches the single-active-dataset model, so two exports are never added together and no overlap flag is needed. This amends the spike rule.

Game scope: WoT insights plus a per-game logged-in time strip, independent of the shared game filter (chosen over following the filter or WoT-only).

---

## Tank-name table sourcing

| Option | Description | Selected |
|--------|-------------|----------|
| Commit the generated table | Script with the maintainer's key; file committed; ToS check first | ✓ |
| Generate in CI with a secret | Fresh each build; build-time network call and a secret | |
| Tag-derived names first, table later | No class or tier at launch | |

**User's choice:** Commit the generated table. At runtime it is inlined in the worker chunk and refreshed by script (chosen over a separate lazy asset that would need a zero-network exception).

---

## Open design decisions

| Question | Choice |
|----------|--------|
| Phone layout | Single column (over optional two-up) |
| Default pins | Logged in + Most-played tank |
| Fifth group name | Totals |
| Chart colour | Heat scale green to amber (over teal) |
| Pin storage | localStorage, per browser (over session-only or IndexedDB) |

---

## Claude's Discretion

Tile list and rule copy, location of the insight model and its tests, accessibility details, e2e budget reconciliation.

## Deferred Ideas

WoWS and Blitz insights, phone two-up, dark mode, low-sample and error states, privacy toggle, locale formatting, lighter game switcher, expand chevron, synthetic data generator for the sketches, auto-refreshing the tank table.
