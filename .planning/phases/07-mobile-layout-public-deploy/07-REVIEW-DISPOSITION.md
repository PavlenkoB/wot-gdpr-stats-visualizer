---
phase: 07
review: 07-REVIEW.md
titles: json
findings:
  - id: WR-01
    severity: warning
    disposition: open
    title: "At 480px and below the nav link's accessible name gains a stray space (\"Payment_history , not in this export\")"
  - id: WR-02
    severity: warning
    disposition: open
    title: "Touch opens the tooltip on `pointerdown`, so every pan or scroll that starts on a chart pins, announces, then silently dismisses"
  - id: WR-03
    severity: warning
    disposition: open
    title: "\"main only\" is enforced only by a check inside the workflow file; the README calls the real control optional"
  - id: WR-04
    severity: warning
    disposition: open
    title: "Self-hosted runner plus a bare `pull_request` trigger becomes remote code execution on the owner's machine once the repository is public"
  - id: WR-05
    severity: warning
    disposition: open
    title: "The smoke job's deadlines are ordered so that its own timeout can fire before Playwright's, leaving no diagnostics"
  - id: IN-01
    severity: info
    disposition: open
    title: "A touch pin released or unmounted by a non-touch input can leave \"Tooltip pinned.\" in the live region and silence the next pin"
  - id: IN-02
    severity: info
    disposition: open
    title: "`ci.yml` comments contradict the numbers they sit next to"
  - id: IN-03
    severity: info
    disposition: open
    title: "README states stale counts and an understated Node requirement"
  - id: IN-04
    severity: info
    disposition: open
    title: "`dismissIfStale` runs the dismissal path on every scroll and resize even when no tooltip is open"
  - id: IN-05
    severity: info
    disposition: open
    title: "`VITE_BASE` is neither validated at build time nor pinned in the e2e config"
  - id: IN-06
    severity: info
    disposition: open
    title: "The phone-width `main` padding is declared twice and one copy is dead"
  - id: IN-07
    severity: info
    disposition: open
    title: "The city-dataset cache key ignores the generator, and the rollback note is imprecise"
  - id: IN-08
    severity: info
    disposition: open
    title: "Several touch specs assume a viewport layout and fail by bounding-box luck"
  - id: IN-09
    severity: info
    disposition: open
    title: "The CSP comment and shared-origin note undersell what `connect-src 'self'` allows on a Pages host"
  - id: IN-10
    severity: info
    disposition: open
    title: "`dist-artifact.spec.ts` defaults the base to `/` while the gate config defaults to the Pages subpath"
  - id: IN-11
    severity: info
    disposition: open
    title: "The comments claim the cache key and the download \"cannot name different months\"; they can"
open: 16
total: 16
recorded: 2026-10-05T18:14:36.014Z
---

# Phase 07: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| WR-01 | warning | open | - |
| WR-02 | warning | open | - |
| WR-03 | warning | open | - |
| WR-04 | warning | open | - |
| WR-05 | warning | open | - |
| IN-01 | info | open | - |
| IN-02 | info | open | - |
| IN-03 | info | open | - |
| IN-04 | info | open | - |
| IN-05 | info | open | - |
| IN-06 | info | open | - |
| IN-07 | info | open | - |
| IN-08 | info | open | - |
| IN-09 | info | open | - |
| IN-10 | info | open | - |
| IN-11 | info | open | - |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.
