---
status: complete
phase: 07-mobile-layout-public-deploy
source: 07-01-SUMMARY.md, 07-02-SUMMARY.md, 07-03-SUMMARY.md, 07-04-SUMMARY.md, 07-05-SUMMARY.md, 07-06-SUMMARY.md, 07-07-SUMMARY.md
started: 2026-10-05T19:57:56.737Z
updated: 2026-10-06T13:00:00.000Z
---

## Current Test

[testing complete]

## Tests

### 1. Pages preconditions confirmed
expected: Settings > Pages shows Source: GitHub Actions and repo visibility is what you intend (public for free Pages) — or you consciously defer. (07-01 D7, 07-06 D4)
result: skipped
reason: "Deferred: keeping repo non-public until everything is done (user: skip)."

### 2. First deploy dispatch and live URL
expected: After merge to main: Deploy workflow dispatch passes preflight, build, gate, deploy, smoke; live URL /wot-gdpr-stats-visualizer/ loads, import works. (07-02 D5, 07-06 D4)
result: skipped
reason: "Deferred: not deployed until repo goes public (user: skip)."


### 3. Pinned tooltips readable on a real 375px phone
expected: Tap a cell/bar/day/country: tooltip pins, fits the card, readable; tap another moves it; tap outside dismisses. (07-03 D9, 07-04 D6)
result: pass


### 4. Map tap targets and screen reader announcements
expected: Small countries tappable with a thumb; a real screen reader speaks the pin and dismiss announcements. (07-04 D6, 07-03 D9)
result: pass


### 5. Focal point in first 812px at 375px
expected: Identity header and nav are above the fold; count tiles / login table / map are reachable by sensible scrolling; no sideways page scroll. (07-05 D6)
result: pass

### 6. City opt-in on a real phone
expected: Load city-level detail (~12 MB) completes on a phone without crashing; city locations appear in login table. (07-06 D4)
result: pass
note: "Works on phone after `pnpm run geo:city -- --download` + rebuild (user: looks good)."
