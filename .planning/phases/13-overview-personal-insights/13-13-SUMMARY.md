---
phase: 13-overview-personal-insights
plan: 13
subsystem: testing
tags: [svelte, playwright, vitest, overview, cleanup]
status: complete

requires:
  - phase: 13-overview-personal-insights
    provides: the insights page (13-09, 13-12) whose test ids replace the retired chips and cards
provides:
  - the old Overview model, chip copy, intro and earliest-created copy deleted
  - Account row root-count cases asserted on the list row (selection-state.test.ts)
  - five browser specs rewritten against the insights page, listed count unchanged
  - a scale-aware offScaleText helper in master-detail-nav.spec.ts
affects: [13-14, 13-15]

actuals:
  tokens: 21000
  tasks: 2
  commits: 2
plan_head_before: d55fb88fb022eea1d64276cc7caf46faf0435200
plan_head_after: 04ae6dc5c959cb92b3d5bf6120800254dceb547c

tech-stack:
  added: []
  patterns:
    - "offScaleText(page, scale): the Overview page is measured against the union of both scales (it shows the list pane beside it); every other pane against the shared 14/18/26/30 scale alone"

key-files:
  created: []
  modified:
    - src/lib/ui-copy.ts
    - tests/unit/shell/ui-copy.test.ts
    - tests/unit/shell/selection-state.test.ts
    - tests/unit/import/promoted-folders.test.ts
    - tests/e2e/shell/master-detail-nav.spec.ts
    - tests/e2e/shell/dashboard.spec.ts
    - tests/e2e/shell/account-timeline-perks.spec.ts
    - tests/e2e/shell/device-info.spec.ts
    - tests/e2e/shell/multi-account.spec.ts
  deleted:
    - src/lib/shell/overview-model.ts
    - tests/unit/shell/overview-model.test.ts

key-decisions:
  - "No Account tile (13-RESEARCH Open Question 8): the Account list row and the identity header keep the multi-account facts."
  - "The type-scale helper builds on the union from 13-12 rather than replacing it: Overview call sites keep the union, the non-Overview panes and the phone screens are tightened to the shared scale."
  - "earliestCreated stays exported from identity-model.ts with its own tests although nothing in src reads it any more (the plan said keep it)."

requirements-completed: [INSIGHT-03, INSIGHT-07]

duration: 25min
completed: 2026-10-23
---

# Phase 13 Plan 13: Retire the old Overview and repair its tests Summary

**The Phase 8 Overview model, chip copy and card tests are deleted, and five browser specs now read the insights page; the full suite is green at 268 listed tests, the same count as before.**

## Accomplishments

- Deleted `overview-model.ts` and its 650-line test file, plus `formatChipWithData`, `formatChipAbsent`, `formatChipUnsupported`, `OVERVIEW_INTRO` and `formatEarliestCreated` and their copy tests. Kept `formatOpenSectionLink`, `ROW_HEADLINE_NONE`, `OVERVIEW_ROW_SUMMARY`, `IDENTITY_CREATED_LABEL`, `formatAccountCount`, `formatCreatedDate` and `earliestCreated`.
- Rewrote the six red e2e tests (master-detail-nav landing, dashboard markup, device-info populated, account-timeline-perks, multi-account (a) and (b)) with no `test(...)` added or removed.
- Closed WINDOWS ledger entry 25 (the six deliberately red assertions) as fixed.

## Where each deleted Account-card case now lives (T-13-38)

| Deleted card case | Covered now by |
| --- | --- |
| three accounts: title is the count | selection-state.test.ts "three accounts: the headline is the count ..." (row headline `formatAccountCount(3)`, summary `ACCOUNT_ROW_MULTI_SUMMARY`) |
| two accounts is already multi, one is v1.0 | "two accounts is already the multi wording", "one account is unchanged" |
| earliest date / minimum / unparseable dates | NO row equivalent: the Overview no longer shows any date. `earliestCreated` keeps its own identity-model tests. The date line was a card-only fact and the retired card text is gone by design (D-03). |
| no creation date of one account shown as the export's | the insights page shows no date; asserted by the rewritten landing test (no SAMPLE_CREATED_DATE) |
| no nickname and no per-account region reaches the card | "no nickname is read into the row", "no single account's REGION is presented as the dataset's" (row) plus the e2e overview root assertions for nickname and both regions (multi-account (a)) |
| an UNAVAILABLE account card keeps the row wording | added: "an UNAVAILABLE Account row keeps the muted wording, multi or not" |
| every other card unchanged by account count | "every other row is unchanged by the account count" |
| rootCount 2 beside one account: multi row | added: "rootCount 2 beside one account: the multi row, never the legacy region" |
| rootCount 2 and empty published list | added: "rootCount 2 and an empty published list: zero accounts" |
| rootCount 1 / no rootCount keep v1.0 | added: two cases of the same names |
| the overviewChips cases (withData / absent / empty arithmetic) | retired with the chips; `paneEntries` muted/reason cases already in selection-state.test.ts; the unsupported count is `unsupportedEntries(result).length` in promoted-folders.test.ts |
| optional-pane cards (HEAT, Warships, Perks, timeline, Device info) | their list rows are asserted in selection-state.test.ts "paneEntries: the two optional panes" and, in the browser, account-timeline-perks and device-info |

## Task Commits

1. Task 1 (delete old model and copy, move assertions): `97511e7`
2. Task 2 (five browser specs, scale-aware helper): `04ae6dc`

## Listed e2e count

`pnpm exec playwright test --list` printed `Total: 268 tests in 32 files` before the plan (measured on a clean checkout of HEAD) and the same line after. The full run: 268 passed, 0 failed. Unit: 157 files, 4,732 passed, 9 expected fail. `check`, `lint` and `build` exit 0.

## Deviations from Plan

**1. [Rule 3 - Blocking] Task 1 cannot be verified green on its own commit.** `tests/unit/guards/ci-budget.test.ts` runs `playwright test --list`, which compiles every spec, so deleting the chip formatters from `ui-copy.ts` breaks that unit test until `master-detail-nav.spec.ts` is rewritten. The two tasks were therefore executed together and committed in order; the Task 1 commit alone fails three ci-budget cases, the Task 2 commit restores the whole suite.

**2. [Plan wording] The scale-aware helper keeps the union as its default.** The plan asked for the Overview alone against 12/14/26/32/56 and other panes against 14/18/26/30. The check is page-wide and the list pane stays beside the Overview, so the Overview call sites use the union (as 13-12 left it) and the explicit tightening is applied to the non-Overview pane loop and the two phone screens (`BASE_SCALE`). 26px is not in `OVERVIEW_SCALE_PX`; it is covered by the union.

**3. [Plan wording] The multi-account-keys.test.ts reason string** the plan said to reword (OVERVIEW_CARD_IDS) no longer exists; 13-12 had already replaced those rows. Nothing to change there.

**4. [Gate] The old-selector grep gate counts any `ov-card-` string**, so the "no card on the page" absence assertions I first added to master-detail-nav and account-timeline-perks were removed; overview-insights.spec.ts (excluded from the gate) already asserts the old ids are absent.

## Known Stubs

None.

## Threat Flags

None. The privacy assertions survive: the overview root is asserted free of the nickname, the region, the creation date (landing test), all four multi-account nickname/region literals (multi-account (a)), and the untrusted folder name and any `b` element (dashboard markup test). T-13-37 and T-13-38 mitigated.

## Self-Check: PASSED

- `src/lib/shell/overview-model.ts` and `tests/unit/shell/overview-model.test.ts`: absent
- commits 97511e7 and 04ae6dc are ancestors of HEAD
- `grep -rEl 'ov-(chip|card|open)-' tests --exclude=overview-insights.spec.ts` prints 0 files
