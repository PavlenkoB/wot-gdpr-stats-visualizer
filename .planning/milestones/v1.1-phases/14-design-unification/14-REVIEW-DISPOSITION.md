---
phase: 14
review: 14-REVIEW.md
titles: json
findings:
  - id: WR-01
    severity: warning
    disposition: open
    title: "The phone-bar title is truncated for the longest pane title after the 18px to 26px change"
  - id: WR-02
    severity: warning
    disposition: open
    title: "\"Defined once\" for the clip pattern holds only by name; 17 copies of the visually-hidden block remain and the guard cannot see them"
  - id: WR-03
    severity: warning
    disposition: open
    title: "`overview-title.test.ts` asserts arithmetic on its own constants rather than the compiled behaviour"
  - id: WR-04
    severity: warning
    disposition: open
    title: "The token guards have blind spots that the \"no colour literal / no unknown token\" claim depends on"
  - id: IN-01
    severity: info
    disposition: open
    title: "Stale comments (one new, plus the four already listed)"
  - id: IN-02
    severity: info
    disposition: open
    title: "A new comment in `CityOptIn.svelte` states a specificity fact that is false"
  - id: IN-03
    severity: info
    disposition: open
    title: "Dead CSS: `.btn`, `.t-body-strong` and the `numeral` hook"
  - id: IN-04
    severity: info
    disposition: open
    title: "`OverviewTile` hard-codes the label line height that the token layer owns"
  - id: IN-05
    severity: info
    disposition: open
    title: "Adjacent heat steps sit 1.13 to 1.17 apart in contrast"
open: 9
total: 9
recorded: 2026-10-27T22:35:51.728Z
---

# Phase 14: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| WR-01 | warning | open | - |
| WR-02 | warning | open | - |
| WR-03 | warning | open | - |
| WR-04 | warning | open | - |
| IN-01 | info | open | - |
| IN-02 | info | open | - |
| IN-03 | info | open | - |
| IN-04 | info | open | - |
| IN-05 | info | open | - |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
