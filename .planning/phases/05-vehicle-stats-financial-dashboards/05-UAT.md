---
status: complete
phase: 05-vehicle-stats-financial-dashboards
source: 05-VERIFICATION.md (re-verification at f4f9b23, after gap-closure plans 05-17/18/19)
started: 2026-10-02T11:07:15Z
updated: 2026-10-02T21:21:35Z
---

## Current Test

[testing complete]

## Tests

### 1. Real export parses (physical shape check)
expected: Real export reaches ready state on Financial_data, Payment_history, Player_statistics with no unexpected unsupported/error banner.
result: pass
note: "Verified by headless drive of the built app with a real export (kept outside the repo); all cards ready."

### 2. Vehicle table figures are correct
expected: Win rate, avg damage, frags, XP match the export's numbers for known vehicles; totals equal account totals.
result: pass
note: "Vehicle totals and a spot-checked vehicle row match the export CSV (no real figures recorded here)."

### 3. Premium time chart buckets by real purchase date
expected: Premium-per-month chart buckets on the real purchase date (CURR_PREMIUM), so months and the largest month match a hand count of the export's own date column, not the bulk-migration CREATED stamp.
result: pass
note: "Re-verified by headless drive of the rebuilt app with the real export; matches the expected figures in this test (no real figures recorded here)."
previous_result: issue
reported: "Chart buckets on CREATED (a bulk-migration timestamp shared by many rows) instead of CURR_PREMIUM, collapsing many purchases into a few months (real-file comparison; figures not recorded here)"
severity: major
fixed_by: "05-18 — premiumDateColumn picks CURR_PREMIUM when any cell yields a month, decided once per file (D-20)"

### 4. Virtual currency totals and Other currencies
expected: Every currency's deposits/withdrawals reflect all its rows. A currency whose rows are all TYPE=income shows them as deposits, not 0.
result: pass
note: "Re-verified by headless drive of the rebuilt app with the real export; matches the expected figures in this test (no real figures recorded here)."
previous_result: issue
reported: "Other currencies shows 'UAH Deposited 0 · Withdrawn 0 · 5 operations' (TYPE=income counted as an operation but added to neither total, contradicting locked decision D-18)"
severity: major
fixed_by: "05-17 — income now routes down the deposit path (locked D-18); inOps + outOps == ops holds exactly"

### 5. Visual quality at 1280px and 375px
expected: Flow bars, small multiples and vehicle table clean at desktop and phone width.
result: pass
note: "User: pass. Observed internal horizontal scroll in Vehicles table and Hours per day chart (scroll containers, not page overflow); deferred to Phase 7 phone polish."

### 6. Real-money spend block
expected: Per-currency paid totals and failed/new counts match Orders.csv.
result: pass
note: "Per-currency paid totals and failed/new counts match Orders.csv (no real figures recorded here)."

### 7. Identity header region label
expected: Header does not present a regional/geographic code as if it were a game realm.
result: pass
note: "Re-verified by headless drive of the rebuilt app with the real export; matches the expected figures in this test (no real figures recorded here)."
previous_result: issue
reported: "Header shows 'Region (per export) 30' - value is Account_Info.REGION, a numeric regional code (city a city), not a game realm"
severity: cosmetic
fixed_by: "05-19 — IDENTITY_REGION_LABEL is now 'Location code (per export)'; value unchanged, never mapped"

### 8. UI review findings (05-UI-REVIEW.md, 15/24)
expected: Phase 5 UI meets 05-UI-SPEC.md: controls in a row, chart zero line/hairlines per palette, text >= 14px, no content spilling its card at 375px, charts sized consistently.
result: pass
previous_result: issue
reported: "UI re-audit scored 15/24; user asked to fix findings now (synthetic audit plus real-archive captures)"
note: "Re-verified by headless drive of the rebuilt app with a real export (kept outside the repo): controls in a row at 1280 and wrapped at 375, 0 text nodes under 14px, battle-type table in its own scroller with no page overflow at 375, chart zero line #5f6368 and hairline #dadce0, currency chart widths near-equal. No real figures recorded here."
fixed_by: "05-20, 05-21, 05-22"

## Summary

total: 8
passed: 8
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

- gap_id: G-05-3
  truth: "Premium-per-month chart uses the real grant date (CURR_PREMIUM in real exports)"
  status: resolved
  fixed_by: "05-18 — premiumDateColumn picks CURR_PREMIUM once per file when any cell yields a month (D-20). Closed in code, CONDITIONAL on the real column being second-precision ISO (recorded as INC-17-19-WR-02): if it is not, G-05-3 reproduces exactly with a green CI."
  reason: "User reported: premium chart month buckets and largest month differ from the real purchase dates (figures not recorded here)"
  severity: major
  test: 3
  root_cause: "buildPremium in src/lib/worker/finance.ts reads CREATED for the month bucket; in real exports CREATED==UPDATED is a bulk-migration timestamp and CURR_PREMIUM holds the grant datetime. tests/fixtures/finance-fixtures.ts PREMIUM_HEADER encodes the opposite (CURR_PREMIUM='ru.wot.gold', CREATED real) so tests pass."
  artifacts:
    - path: "src/lib/worker/finance.ts"
      issue: "resolveColumns(['PREMIUM','CREATED']) and month from CREATED; doc comment says CURR_PREMIUM names the currency"
    - path: "tests/fixtures/finance-fixtures.ts"
      issue: "fixture has wrong column semantics and lacks real value shapes"
  missing:
    - "Bucket on CURR_PREMIUM when it parses as a timestamp, fall back to CREATED"
    - "Real-shaped fixture rows: CURR_PREMIUM datetime, CREATED==UPDATED bulk date, 'deposit WOT premium_plus N sec', '29 days 07:08:31', 'withdrawal ... 0 sec'"
    - "Update e2e/unit expectations and doc comments"
  debug_session: ""

- gap_id: G-05-4
  truth: "Currency operations with TYPE=income are counted into totals or flagged excluded, never silently zero"
  status: resolved
  fixed_by: "05-17 — income routes down the deposit path per locked D-18. inOps + outOps == ops now holds exactly, pinned in unit and browser tests."
  reason: "User reported: UAH shows Deposited 0 / Withdrawn 0 over 5 operations"
  severity: major
  test: 4
  root_cause: "buildCurrency in src/lib/worker/finance.ts accepts TYPE income but adds it to NEITHER inUnits nor outUnits (the if/else-if only handles withdrawal and deposit; a comment there cites D-18 for this). Locked decision D-18 in 05-CONTEXT.md says deposit AND income count as up. Code contradicts its own decision; the hand answer key/fixtures agree with the code, so no test catches it."
  artifacts:
    - path: "src/lib/worker/finance.ts"
      issue: "unhandled TYPE value counted as op, contributes 0"
    - path: "tests/fixtures/finance-fixtures.ts"
      issue: "no income row"
  missing:
    - "Per D-18, count income as up: add to bucket/month inUnits and inOps; fix the misleading comment"
    - "Update hand answer key / oracle and unit + e2e expectations; fixtures need an income row; a real income-only currency has a handful of rows"
  debug_session: ""

- gap_id: G-05-7
  truth: "Identity header does not present a regional code as a game realm"
  status: resolved
  fixed_by: "05-19 — IDENTITY_REGION_LABEL is now 'Location code (per export)'; the value is unchanged and still never mapped. Phase 3 copy contract amended."
  reason: "User reported: 'Region (per export) 30'"
  severity: cosmetic
  test: 7
  root_cause: "Identity header shows Account_Info.REGION verbatim under label 'Region (per export)'; in the real export it is a numeric regional code (with CITY a city), not a realm."
  artifacts:
    - path: "src/lib/components"
      issue: "identity header region field (locate via data-testid identity-region)"
  missing:
    - "Hide, relabel or derive realm from COUNTRY_CODE/server instead; decide with user"
  debug_session: ""

- gap_id: G-05-8
  truth: "Vehicle controls (Game, Battle type, Search) render as a row per UI-SPEC"
  status: resolved
  resolved_by: "05-20"
  resolved_at: 2026-10-03
  reason: "UI-REVIEW: .controls renders as a ~215px right-aligned column"
  severity: minor
  test: 8
  root_cause: "PlayerStats.svelte:924-930 .controls sets display:flex without flex-direction; a bare div { flex-direction: column } reset at :810-816 wins on specificity/order."
  artifacts:
    - path: "src/lib/components/PlayerStats.svelte"
      issue: ".controls missing flex-direction: row"
  missing:
    - "flex-direction: row (wrap on narrow widths) on .controls"
  debug_session: ""

- gap_id: G-05-9
  truth: "Chart zero line and hairlines use the contract palette; charts in one card share a width; one-sided currency charts do not waste half the plot"
  status: resolved
  resolved_by: "05-21 (colour, axis split), 05-22 (width)"
  resolved_at: 2026-10-03
  reason: "UI-REVIEW + real-archive captures: zero line rgb(218,220,224) 1.37:1, hairline #e8eaed off-palette; charts narrower than card with differing widths; symmetric scale wastes the empty half for almost-all-deposit currencies"
  severity: minor
  test: 8
  root_cause: "MonthlyBarChart.svelte:337-343 hard-codes faint colours; chart width is derived from month count rather than the card; diverging scale is symmetric by design."
  artifacts:
    - path: "src/lib/components/MonthlyBarChart.svelte"
      issue: "colours, width, symmetric y-scale"
  missing:
    - "Zero line #5f6368 (6.05:1), hairline #dadce0"
    - "Decide with oracle/tests: consistent chart width (fill card, scroll when many months) and an asymmetric scale only if it keeps cross-chart honesty (D-16 'own scale' copy already says charts are not comparable); update unit/e2e geometry assertions"
  debug_session: ""

- gap_id: G-05-10
  truth: "No text under the 14px floor and no content spilling its card at 375px"
  status: resolved
  resolved_by: "05-20"
  resolved_at: 2026-10-03
  reason: "UI-REVIEW: 36 text nodes <14px at 1440 (37 at 375); battle-type summary table 316px in a 293px box with no scroller, 'Damage dealt' spills (also seen in real-archive capture)"
  severity: minor
  test: 8
  root_cause: "Small font sizes in PlayerStats.svelte:884,:1096, BattleTypeSummary.svelte:170,:232, VehicleTable.svelte:543 and a 13px phone media query at VehicleTable.svelte:590-593; battle-type table has no overflow-x container."
  artifacts:
    - path: "src/lib/components/BattleTypeSummary.svelte"
      issue: "table not contained at 375px; sub-14px text"
    - path: "src/lib/components/PlayerStats.svelte"
      issue: "sub-14px text"
    - path: "src/lib/components/VehicleTable.svelte"
      issue: "sub-14px text, 13px phone media query"
  missing:
    - "14px floor; drop 13px query; wrap battle-type table in overflow-x:auto; min-width:0 (keyboard focusable)"
  debug_session: ""

## Deferred Follow-Ups

- test: 5
  idea: "Vehicles table and Hours per day chart show horizontal scrolling at phone width (internal scroll containers); revisit in Phase 7 phone polish"
  deferred_at: 2026-10-02
