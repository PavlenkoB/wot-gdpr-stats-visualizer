# Phase 9 — Code Review Disposition

**Source:** `09-REVIEW.md` (2026-10-17, standard depth, 15 files)
**Counts:** critical 1 · warning 3 · info 6 · total 10
**Status of report:** `issues_found`

The code-review gate is advisory and never blocks execution. Every finding is recorded
here with its disposition so a triaged finding is distinguishable from a forgotten one.

| ID | Severity | Disposition | Note |
|----|----------|-------------|------|
| CR-01 | critical | **open** | Merged readers (`readRowsByFile` consumers: vehicles, finance, device-info) resolve field keys off the first merged row. Two accounts with different CSV headers in one bucket make the second account's cells read as "missing" — a false "not in export" claim. `db.ts:746-773` documents the opposite. Real bug, user-visible; not fixable by this phase's close-out alone. |
| WR-01 | warning | **open** | `db.ts:683` counts `meta.accounts?.length ?? 1` (0 for `[]`) while `accountsOfMeta` treats `[]` as legacy and returns 1. Rebuild and `resultFromMeta` disagree about an empty accounts list. |
| WR-02 | warning | **open** | `MAX_ACCOUNT_ROOTS`'s "one linear pass" docstring overstates the cost model — `foldersAt` re-runs `prepare()` per root (bounded by the constant 32). Documentation, not behaviour. |
| WR-03 | warning | **open** | `classify.ts:1092` `root as string` cast where TypeScript already narrows; contradicts the module's stated "an error, not a cast" rule. |
| IN-01 | info | **open** | `toAccountSummary` is not tolerant of a stored `AccountMeta` missing `games`; `identity-model.ts:118` then throws and the dashboard blanks. |
| IN-02 | info | **open** | The D-11 combined caption is on the six section panes but not on `paneEntries` / `overviewCards`, which show the same summed counts. |
| IN-03 | info | **open** | `recomputeStatusCounts` (worker) and `statusCountsOf` (classifier) are two tallies that diverge on an unreachable input. |
| IN-04 | info | **open** | `ci.yml:180-183` comment still says `globalTimeout` is "27 min"; the value is 30. |
| IN-05 | info | **open** | `accounts?` reachability is documented in three places. |
| IN-06 | info | **open** | The multi-account e2e scans only the Vehicles pane for repeated keys. |

## Gate outcome

Advisory gate, `onError: skip`. Execution continued. **CR-01 is a genuine product bug and is
surfaced to the user before phase completion** — it is not closed by this report. Gap closure
runs through `/gsd-plan-phase 9 --gaps`, not through this file.