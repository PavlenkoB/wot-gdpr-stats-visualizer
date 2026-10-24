---
phase: "13"
slug: "overview-personal-insights"
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-10-23"
audited: "2026-10-24"
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Source: `13-RESEARCH.md` § Validation Architecture.
>
> **Audited 2026-10-23 (Nyquist audit).** The map below was rewritten from the
> plan-time draft (which used the plans' `D-nn` decision ids) to the eight
> requirement ids of `REQUIREMENTS.md` (`INSIGHT-01`..`INSIGHT-08`), and every
> row was re-checked against a file that exists and runs today. The audit added
> three test files and closed four coverage gaps; four open implementation
> defects from `13-REVIEW.md` remain and are listed under **Known Gaps**.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (unit, `vitest.config.ts`, `tests/unit/**/*.test.ts`) and Playwright (e2e, `playwright.config.ts`) |
| **Config file** | `vitest.config.ts`, `playwright.config.ts` |
| **Quick run command** | `pnpm run test:unit -- tests/unit/overview` |
| **Full suite command** | `pnpm run test:unit && pnpm exec playwright test` |
| **Estimated runtime** | unit ~15 s (159 files); e2e ~2.3 min (273 listed tests, 33 files) — MEASURED 2026-10-23 |

---

## Sampling Rate

- **After every task commit:** Run the quick run command for the touched area
- **After every plan wave:** `pnpm run test:unit`
- **Before `/gsd-verify-work`:** Full unit suite, then `pnpm exec playwright test --list` counted against the CI budget, then the e2e suite
- **Max feedback latency:** ~2 s for the Overview unit area; ~15 s for the whole unit suite

---

## Per-Requirement Verification Map

The eight requirement ids are the ones `REQUIREMENTS.md` carries. Every row's
command was run (re-run 2026-10-24 on the final tree) and every one is **green**.

| Requirement | Secure behaviour | Test type | Automated command | Status |
|-------------|------------------|-----------|-------------------|--------|
| INSIGHT-01 | One `overview` channel, field-less: a smuggled `title` / `battleType` / `game` / any other key is rejected; a malformed query answers `invalid query` | unit (real worker) | `pnpm run test:unit -- tests/unit/import/overview-worker.test.ts` | green |
| INSIGHT-01 | The answer comes from ONE snapshot: the dataset's own `importedAt` and the rows behind it; a second ask is served from the memo (one entry); a stale aggregate is rebuilt and written back; a cleared dataset answers null | unit (real worker) | same file | green |
| INSIGHT-01 | An overview ask beside a currency ask settles both, each on its own channel (no supersede across channels) | unit | `pnpm run test:unit -- tests/unit/import/query-client.test.ts` | green |
| INSIGHT-01 | **No row is read or computed on the main thread**: the page's own runtime import closure reaches no row reader (`overview-aggregate`, `overview-account-stats`, `overview-records`, `overview-tanks`, `overview-totals`, `overview-time`), no worker file, no Dexie and no database | unit (import-graph guard) | `pnpm run test:unit -- tests/unit/overview/overview-main-thread-guard.test.ts` | green (added by this audit) |
| INSIGHT-02 | Lifetime figures SUM across account folders: battles, credits, orders, the tank fleet | unit (pure builders against the oracle) | `pnpm run test:unit -- tests/unit/overview/overview-totals.test.ts tests/unit/overview/overview-tanks.test.ts` | green |
| INSIGHT-02 | "Logged in" is the UNION of the session intervals across accounts and games (the oracle's 53,700 s, not the 55,500 s the parts add to) | unit | `pnpm run test:unit -- tests/unit/overview/overview-time.test.ts` | green |
| INSIGHT-02 | A record takes the MAXIMUM, and the record's tank comes from the account that holds it; the earlier account wins a tie; one account alone still works | unit | `pnpm run test:unit -- tests/unit/overview/overview-records.test.ts` | green |
| INSIGHT-02 | The small-sample guard holds: 29 battles give no rate and 30 do; a missing wins column gives no wins and no rate; the class tile states its coverage | unit | `pnpm run test:unit -- tests/unit/overview/overview-totals.test.ts` | green |
| INSIGHT-03 | The bento is five groups in order — Pinned, Time, Tanks, Records, Totals — in three tile sizes (two heroes, three features, eleven metrics) | unit | `pnpm run test:unit -- tests/unit/overview/overview-definitions.test.ts` | green |
| INSIGHT-03 | The fill rule is the sketch's own, proved by a differential test against the sketch's source, plus an exhaustive enumeration that no hero or metric is widened and no hole is made worse | unit (oracle) | `pnpm run test:unit -- tests/unit/overview/overview-grid.test.ts` | green |
| INSIGHT-03 | Columns follow the PANE width, not the viewport: four at 880 px and above, two at 480 px and above, one below; no two tiles overlap; DOM order is reading order | e2e | `pnpm exec playwright test tests/e2e/shell/overview-insights.spec.ts` | green |
| INSIGHT-03 | Absent data is ONE dashed row per group, naming the tiles and the source they need — never a zero | unit + e2e | same file, plus `tests/unit/overview/overview-layout.test.ts` | green |
| INSIGHT-04 | Every tile expands IN PLACE: the wrapper's x, y and width do not move, the element identity survives, and no sibling grows | e2e | `pnpm exec playwright test tests/e2e/shell/overview-insights.spec.ts` | green |
| INSIGHT-04 | The expanded tile carries "How it is computed", "Reads" and an "Open {Section}" link, and the link selects the pane and moves focus into it | e2e | same file | green |
| INSIGHT-04 | The grid is fully keyboard operable: exactly one tabbable tile, arrows and Home/End move it, `P` pins and announces, `Escape` closes an open tile and keeps focus on it | e2e | same file | green |
| INSIGHT-04 | Reduced motion applies the state at once and never calls the transition API; forced colours keep the group dot, the legend swatch and the star outlined | e2e | same file | green |
| INSIGHT-05 | Pins are tile ids under ONE localStorage key, read and written in try/catch (a throwing storage falls back to the defaults), validated on read (unknown ids, non-strings, duplicates and prototype keys are dropped) | unit | `pnpm run test:unit -- tests/unit/overview/overview-pins.test.ts` | green |
| INSIGHT-05 | The defaults are Logged in and Most-played tank; a read NEVER writes; the write happens only on an explicit pin action, and no other file under `src/` calls it | unit | same file, plus `tests/unit/overview/overview-components-guard.test.ts` | green |
| INSIGHT-06 | The committed table is the maintainer's: 1,035 rows, a hash of its own rows, unique ids and keys, under 120 KB, and the same per-row rules the generator applies | unit | `pnpm run test:unit -- tests/unit/overview/vehicle-table.test.ts` | green |
| INSIGHT-06 | The generator fails CLOSED: a bad id, tag, nation, name, type, tier, duplicate id or key, an empty payload or an oversized payload aborts the run and writes nothing; the key never reaches a message, the output or a log | unit | same file | green |
| INSIGHT-06 | The table is worker-only and inlined: no dynamic import anywhere, and exactly one module under `src/` names a tank-table module in an import specifier; the application key appears in no source file and in no built output | unit (guard) | `pnpm run test:unit -- tests/unit/guards/vehicle-table-guard.test.ts` | green |
| INSIGHT-06 | Real tanks resolve through the committed table: the class tile appears and states its coverage, and the tank name is the table's | e2e | `pnpm exec playwright test tests/e2e/shell/overview-insights.spec.ts` | green |
| INSIGHT-07 | The reply carries counts, durations and resolved names only: a closed key-and-string vocabulary walk over every worker reply and every omit variant, with a negative control proving the walker is not vacuous | unit (real worker) | `pnpm run test:unit -- tests/unit/import/data-query-worker.test.ts` | green |
| INSIGHT-07 | No order amount, chat text, clan name or account name reaches the page: the planted canaries are absent from every reply AND from every Totals/Records tile, and the DOM holds neither the canaries nor the identity nickname | unit + e2e | `pnpm run test:unit -- tests/unit/import/data-query-worker.test.ts tests/unit/overview/overview-totals.test.ts tests/unit/overview/overview-records.test.ts`, `pnpm exec playwright test tests/e2e/shell/overview-insights.spec.ts` | green |
| INSIGHT-07 | The zero-network assertion covers the Overview: the page expands a tile, closes it with Escape, pins and unpins, follows an Open link and returns, with no request after the load | e2e | `pnpm exec playwright test tests/e2e/guards/zero-network.spec.ts` | green |
| INSIGHT-08 | Tiles are declared PER GAME — a shared list and a WoT list — and a second game's list is accepted without touching the grid | unit | `pnpm run test:unit -- tests/unit/overview/overview-definitions.test.ts` | green |
| INSIGHT-08 | The "Wargaming life" list shows the logged-in time of every game present, is READ-ONLY (no control in it) and is INDEPENDENT of the shared game filter (the page's import closure never reaches the filter) | unit + unit (guard) | `pnpm run test:unit -- tests/unit/overview/overview-time.test.ts tests/unit/overview/overview-main-thread-guard.test.ts` | green (guard added by this audit) |

---

## Wave 0 Requirements

All of the plan-time Wave 0 items exist and run today.

- [x] `tests/fixtures/overview-fixtures.ts` — the synthetic two-account export, the seven-option absence matrix, the canary contract and the hostile tank name
- [x] `tests/helpers/overview-oracle.ts` — the hand-derived answer key (imports nothing)
- [x] `tests/helpers/overview-inputs.ts` — the archive read through the production parser
- [x] `tests/unit/overview/overview-definitions.test.ts`, `overview-grid.test.ts`, `overview-layout.test.ts`, `overview-pins.test.ts`, `overview-copy.test.ts`, `overview-format.test.ts`, `overview-dom.test.ts`, `overview-motion.test.ts`, `overview-nav.test.ts`, `overview-time.test.ts`, `overview-totals.test.ts`, `overview-tanks.test.ts`, `overview-records.test.ts`, `overview-account-stats.test.ts`, `overview-heat.test.ts`, `overview-fixtures.test.ts`, `vehicle-table.test.ts`, `vehicle-lookup.test.ts`, `overview-components-guard.test.ts`
- [x] `tests/unit/guards/vehicle-table-guard.test.ts`
- [x] `tests/unit/import/overview-worker.test.ts` — the field-less channel, the one-snapshot answer, the memo and the stale rebuild
- [x] `tests/unit/overview/overview-main-thread-guard.test.ts` — **added by this audit**: the main-thread boundary of the page
- [x] `tests/unit/overview/phase13-review-findings.test.ts` — **added by this audit**: the faithful tests for the open review findings (WR-03, WR-05, WR-06), marked `it.fails`
- [x] `tests/e2e/shell/overview-insights.spec.ts` — the seven browser proofs
- [x] `tests/e2e/shell/overview-insights-gaps.spec.ts` — **added by this audit**: the WR-01 browser gap spec, marked `test.fail()`
- [x] The zero-network spec's Overview stage
- [x] The CI budget reconciled with the measured count — 273 listed tests, exactly the 32 / 34 / 42 min ceiling, no limit moved

---

## Manual-Only Verifications

Two behaviours cannot be machine-checked and are recorded as the human items of
`13-UAT.md`.

| Behavior | Requirement | Why manual | Test instructions |
|----------|-------------|------------|-------------------|
| The FEEL of the expand-in-place and the pin motion: the expanded tile grows downward in its own column with no neighbour jump, the 0.26 s transition reads as smooth, the pin moves the tile into the Pinned group without flicker, reduced motion applies the change at once | INSIGHT-04 | Motion feel is not machine-checkable. The GEOMETRY is checked (the wrapper's x, y and width do not move, no sibling grows, the reduced-motion path never calls the transition API) — the feel of the same movement is not | Open the Overview in a real Chrome window at 1040 px, expand a tile and pin one, and watch. UAT item 1 |
| The LOOK of the Overview at 1040, 880, 479 and 340 px: the tile type scale, group dots and hairlines, the dashed absent rows, the value-scale legend, the star hit area and the attribution footer | INSIGHT-03 | Legibility is not machine-checkable. The COUNTS are checked (four / two / one columns, no overlap, a 44 px star, no sideways scroll) — how the result reads is not | Open the Overview at each of the four widths with a full export and with the synthetic oracle archive. UAT item 2 |

Two further items are manual by nature but are NOT open gaps:

| Behavior | Requirement | Why manual | Test instructions |
|----------|-------------|------------|-------------------|
| The Wargaming Terms-of-Use reading before the tank table was committed | INSIGHT-06 | A legal reading needs a person | Recorded as passed in the 13-15 SUMMARY |
| The generator run with the maintainer's own key against the live API | INSIGHT-06 | The key is the maintainer's and the API is not called in CI | `pnpm run vehicles:table` on the maintainer's machine; `pnpm run vehicles:table:check` proves the committed file is current offline |

---

## Resolved Gaps and Standing Decisions

The four defects the first audit pinned with expected-fail tests were fixed by the review
fix pass (`13-REVIEW-FIX.md`). Each fix removed its `it.fails` / `test.fail()` marker in the
same commit, so each test is now an ordinary regression test and runs green.

| Gap | Defect | Regression test | Fix commit |
|-----|--------|-----------------|------------|
| WR-01 | A rapid second pin lost the first while a view transition was pending | `tests/e2e/shell/overview-insights-gaps.spec.ts` | `7a3afc0` |
| WR-03 | Win rate divided wins of one account subset by battles of another | `tests/unit/overview/phase13-review-findings.test.ts` | `3de2e2b` |
| WR-04 | "best of N accounts" counted every folder, not the contributing accounts | `tests/unit/overview/overview-records.test.ts` (three new cases) | `2933b05` |
| WR-05 | Credits pick matched "wot" as a substring | `tests/unit/overview/phase13-review-findings.test.ts` | `f072001` |
| WR-06 | Generator trusted the API's `page_total` | `tests/unit/overview/phase13-review-findings.test.ts` | `969b6f3` |

The seven Info findings were also addressed (six fixed, `3dfba5e` to `d06deca`). IN-06
(`readApplicationId`) and IN-07 (name validator) have unit tests; IN-04 is asserted inside
the existing "(privacy and states)" e2e test.

Two items are standing decisions, not coverage gaps, and nothing here silently closes them:

| Item | Why it is not tested or fixed |
|------|-------------------------------|
| WR-02 | An explicit empty pin set reads back as the defaults. The approved 13-UI-SPEC says "if nothing valid remains, the defaults apply", and plan 13-06 recorded it as deliberate with tests asserting it. Reversing it needs the spec amended first, or the UI to refuse unpinning the last pin. |
| IN-05 | Telling "recorded but not in the table" from "cell empty" needs a new field on the dmg/xp/kills tiles, which changes the closed vocabulary of the overview reply (a privacy-review decision). "Vehicle not recorded" is approved D-09 copy. |

---

## Validation Sign-Off

- [x] All eight requirements have an automated verify that runs and is green
- [x] Sampling continuity: no 3 consecutive tasks without an automated verify
- [x] Wave 0 covers all missing references
- [x] No watch-mode flags
- [x] Feedback latency under 15 s for the unit suite
- [x] `nyquist_compliant: true` — every requirement has an automated verify that runs green, and the four implementation defects the first audit recorded are fixed. Two behaviours stay manual by nature (motion feel, look at four widths) and are the human items of `13-UAT.md`.

**Approval:** validated and compliant, 2026-10-24. The two manual-only items remain open in `13-UAT.md`; WR-02 and IN-05 are standing decisions.

## Validation Audit 2026-10-23

| Metric | Count |
|---|---|
| Gaps found | 0 |
| Resolved | 4 |
| Escalated | 0 |
