---
phase: 08-master-detail-ui-redesign
plan: 10
subsystem: testing
tags: [playwright, e2e, master-detail, privacy, zero-network, csp]
status: complete

requires:
  - phase: 08-master-detail-ui-redesign
    provides: "the master-detail shell, openSection/waitForImported helpers and the R1-R10 rules (08-02 to 08-07), and the migration approach from 08-08 and 08-09"
provides:
  - "tests/e2e/shell/identity-privacy.spec.ts: 5 listed tests, the full leak scan runs on the landing view and on every pane in PANE_IDS"
  - "tests/e2e/guards/zero-network.spec.ts: 5 listed tests, every flow opens the pane that owns its blocks before interacting"
affects: [08-11, 08-12, 08-13, 08-14, 08-15, 08-16, 08-17, 08-18]

actuals:
  tokens: 6500
  tasks: 2
  commits: 2
plan_head_before: 87d27b2dad0a5e9a9d1da7fb1f9c22edd3828e8c
plan_head_after: 129cc32f629dca4f993db3081e0a412a17765c10
commits: 2

tech-stack:
  added: []
  patterns:
    - "A privacy read that was one page-wide scan becomes a loop over PANE_IDS inside named test.step blocks, so a failure names the leaking pane"
    - "A flow that waited on several blocks at once opens each owning pane in the order the flow uses it and waits on that block's own data-state"

key-files:
  created: []
  modified:
    - tests/e2e/shell/identity-privacy.spec.ts
    - tests/e2e/guards/zero-network.spec.ts

key-decisions:
  - "scanEveryPane keeps the landing-view scan and then loops all eight PANE_IDS (muted panes included); the nickname-exactly-once check is made on the rendered text of every pane on top of the existing exactly-once-in-markup check"
  - "The (c) overflow canary is checked in each pane's markup and in the IndexedDB dump, not only once on the landing view"
  - "zero-network request, worker, origin and CSP-violation assertions are untouched; the replace flow re-opens vehicles, finance and payments after landing on Overview so all four Phase 5 blocks are still proven to answer after the re-ingest"

requirements-completed: []

coverage:
  - id: D1
    description: "Identity privacy across every pane: neither the email domain nor the birth date appears in text, markup, aria snapshot, console or IndexedDB for any of the eight panes, in a fresh import, a return visit and the three header-shape variants; the nickname appears exactly once in every pane"
    verification:
      - kind: e2e
        ref: "tests/e2e/shell/identity-privacy.spec.ts#(a),(b),(c)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Zero network after the baseline, one same-origin worker and zero CSP violations through the baseline test, the 5,000-session playtime flow, every Phase 5 flow and every Phase 6 flow, with the CSP meta tag test unchanged"
    verification:
      - kind: e2e
        ref: "tests/e2e/guards/zero-network.spec.ts#all 5"
        status: pass
    human_judgment: false
---

# Phase 8 Plan 10: Migrate the core-value gates to the master-detail shell Summary

**The identity-privacy and zero-network specs (10 listed tests, none added) now prove their claims across all eight panes of the master-detail shell: the leak scan runs on every pane opened in turn, and every network/CSP flow opens the pane that owns its blocks before driving it, with no request, worker or CSP assertion touched.**

## Performance

- **Duration:** about 6 min (2026-10-07T22:40Z to 22:46Z)
- **Tasks:** 2 (1 tracer, 1 auto)
- **Files:** 2 modified

## Accomplishments

- **Tracer (Task 1, identity-privacy).** Added the spec-local `scanEveryPane(page, consoleMessages, nickname, extraNeedle?)`. It runs the existing `expectNoSensitiveLeak` on the landing view and then, for each id in `PANE_IDS` (imported, never retyped), calls `openSection` and repeats the scan inside a `test.step` named after the pane. On every pane it also asserts the nickname occurs exactly once in `document.body.innerText` (D-21), on top of the existing exactly-once check in the markup. `(a)`, `(b)` (after the reload, which lands on Overview) and the three `(c)` variants use it; `(c)` passes its overflow canary so each pane's markup and the IndexedDB dump are checked for it. The muted panes of the variant exports open fine and were scanned too.
- **zero-network (Task 2).** The playtime flow calls `waitForImported` then `openSection('playtime')` before awaiting the `playtime` state. The Phase 5 flow opens `vehicles` (player-stats: battle-type and title sweeps, sort, search, column picker), then `finance` (premium and currency: charts by pointer and keyboard, monthly tables), then `payments` (spend breakdown); after the confirmed replace it lands on Overview, so it re-opens the three panes and waits for all four blocks. The Phase 6 flow opens `login-history` after each of its two imports, keeping the `city-optin` idle and `city-progress` absent assertions. The baseline reads, `requests.slice(baselineCount)` assertions, single-worker assertion, origin check and `__cspViolations` read are textually unchanged; no request appeared when panes were opened.

## Task Commits

1. **Task 1 (tracer): identity-privacy scans every pane** - `cca54e2` (test)
2. **Task 2: zero-network opens each pane before its flow** - `129cc32` (test)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. The throwaway Playwright config (outside the repo) was used for every e2e run because the installed browsers do not match the pinned version; the repo's `playwright.config.ts` was not touched.

## Verification

- `pnpm exec playwright test -c <throwaway config> --project=chromium tests/e2e/guards/zero-network.spec.ts tests/e2e/shell/identity-privacy.spec.ts` - 10 passed
- `playwright test --project=chromium tests/e2e/guards --list` - `Total: 5 tests in 1 file`; identity-privacy lists 5
- `grep -c scanEveryPane identity-privacy.spec.ts` - 5; `grep -c openSection zero-network.spec.ts` - 10
- `git diff -U0` on zero-network shows no removed `requests.slice` or `workerUrls` line
- `pnpm run check` - 0 errors, 0 warnings; `pnpm run lint` (prettier and eslint) - clean

## Known Stubs

None.

## Threat Flags

None. T-08-31 is mitigated: `scanEveryPane` opens all eight panes from `PANE_IDS` and scans each. T-08-32 is mitigated: each flow opens its pane first and the baseline, same-origin, single-worker and CSP-violation assertions are kept verbatim.

## Next Phase Readiness

Ready for 08-11.

## Self-Check: PASSED

- Both spec files present; commits `cca54e2` and `129cc32` found in `git log`; `git rev-list --count 87d27b2..HEAD` is 2 before the SUMMARY commit.
