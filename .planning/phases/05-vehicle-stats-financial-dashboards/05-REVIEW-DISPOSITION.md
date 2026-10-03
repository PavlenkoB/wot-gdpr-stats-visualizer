---
phase: 05
review: 05-REVIEW.md
titles: json
findings:
  - id: WR-01
    severity: warning
    disposition: open
    title: "Bar-chart node budget is not a valid upper bound for currency charts; the comment asserts the opposite"
  - id: WR-02
    severity: warning
    disposition: open
    title: "`CurrencyBlock.svelte` converts transported unit strings with bare `BigInt()`, and the guard comments claim a safety property it does not have"
  - id: WR-03
    severity: warning
    disposition: open
    title: "`navScrollLeftFor` does not implement its own \"left edge wins for an over-wide link\" rule"
  - id: INC-17-19-WR-01
    severity: warning
    disposition: open
    title: "`oracleCurrency` routes by threshold only, so a 9th charted currency lands in the app's `others` but in no oracle list (`CHART_MAX` is 8, `SCALE_CODES` 6, so nothing exercises it today)"
  - id: INC-17-19-WR-02
    severity: warning
    disposition: open
    title: "`ISO_TIMESTAMP_RE` requires seconds, so a `CURR_PREMIUM` written without them silently falls back to bulk `CREATED` — G-05-3 unchanged — while the oracle's `readDate` accepts it, so the two sides disagree and CI stays green"
  - id: INC-17-19-IN-01
    severity: info
    disposition: open
    title: "Invariant test uses `toBeGreaterThanOrEqual(7)` where the fixtures pin exactly 7; a `return` inside the `for` loop exits the whole test, not the iteration"
  - id: INC-17-19-IN-02
    severity: info
    disposition: open
    title: "05-17 browser caption hard-codes `inUnits: 600_000_000n` rather than deriving it from the fixture key, so the literal and the key can drift apart silently"
open: 7
total: 7
recorded: 2026-10-02T10:12:06.415Z
# The four INC-17-19-* rows come from 05-REVIEW-INCREMENTAL-17-19.md (plans 05-17/18/19, diff 12e4539..HEAD).
# They are ID-prefixed because that review reused WR-01/WR-02 for DIFFERENT defects, and this
# ledger's reuse rule would silently drop the earlier rows above. The three WR-0N rows remain the
# canonical 05-REVIEW.md findings for plans 05-01..05-16.
---

# Phase 05: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| WR-01 | warning | open | - |
| WR-02 | warning | open | - |
| WR-03 | warning | open | - |
| INC-17-19-WR-01 | warning | open | 05-REVIEW-INCREMENTAL-17-19.md (oracle fidelity, not the app) |
| INC-17-19-WR-02 | warning | open | 05-REVIEW-INCREMENTAL-17-19.md (timestamp shape; the real zip is the human check) |
| INC-17-19-IN-01 | info | open | 05-REVIEW-INCREMENTAL-17-19.md |
| INC-17-19-IN-02 | info | open | 05-REVIEW-INCREMENTAL-17-19.md |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.
