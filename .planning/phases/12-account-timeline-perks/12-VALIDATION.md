---
phase: "12"
slug: "account-timeline-perks"
status: validated
nyquist_compliant: false
wave_0_complete: true
created: "2026-10-20"
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Source: `12-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (Node env, no DOM, `tests/unit/**/*.test.ts`) and Playwright (`chromium`, `chromium-mobile`) |
| **Config file** | `vitest.config.ts`, `playwright.config.ts` |
| **Quick run command** | `pnpm exec vitest run <touched test file>` |
| **Full suite command** | `pnpm run test:unit && pnpm run check && pnpm run lint && pnpm exec playwright test` |
| **Estimated runtime** | unit ~10 s; full e2e several minutes (needs a machine that can launch Chromium) |

---

## Sampling Rate

- **After every task commit:** the touched file's Vitest file (about 10 s)
- **After every plan wave:** `pnpm run test:unit && pnpm run check && pnpm run lint`
- **Before `/gsd-verify-work`:** full unit suite, `pnpm run build`, `pnpm exec playwright test --list` count against the CI budget, then the e2e suite
- **Max feedback latency:** ~15 s per task

---

## Per-Task Verification Map

Task IDs are assigned by the planner; each row names the behaviour the plan's tasks must prove.

| Requirement | Secure behavior | Test type | Automated command | File exists |
|-------------|-----------------|-----------|-------------------|-------------|
| PRIV-01 (D-03) | Per spec file (nine): canary in non-allowlisted columns and an email planted in every allowlisted cell are absent from `db.rows` and `db.meta`; allowlisted values present | unit (real worker + fake IndexedDB) | `pnpm exec vitest run tests/unit/import/new-data-allowlist.test.ts` | extend |
| PRIV-01 | Unlisted file inside a promoted folder stores nothing; misfiled name in the wrong category stores nothing | unit | same file | extend |
| PRIV-01 (D-02) | `Game_Forums` stays unsupported and counted only; forum email/IP canaries absent after import and after legacy purge | unit | `pnpm exec vitest run tests/unit/import/multi-account-import.test.ts tests/unit/import/multi-account-lifecycle.test.ts` | exists, keep green + new guard |
| PRIV-01 (D-14 pattern) | Legacy raw rows narrowed or deleted on check-cache; second run is a no-op | unit | `pnpm exec vitest run tests/unit/import/new-data-narrow.test.ts` | extend |
| TIMELINE-01 | Kind mapping, Language/Country split, newest-first order, undated last, tie-break chain | unit (pure builder) | `pnpm exec vitest run tests/unit/account-timeline/timeline-aggregate.test.ts` | Wave 0 |
| TIMELINE-01/02, D-10/D-11 | Merge only on equality of every allowlisted column, only the three named files, occurrence-indexed | unit | same | Wave 0 |
| TIMELINE-01/02 | `account-timeline` channel states per file: ready / not-in-export / no-rows / skipped | unit (worker) | `pnpm exec vitest run tests/unit/import/account-timeline-worker.test.ts` | Wave 0 |
| TIMELINE-02, PERKS-02 | `address` and `code` kinds masked in the view contract; `maskCode` truth table | unit | `pnpm exec vitest run tests/unit/new-data/code-mask.test.ts tests/unit/geo/ip.test.ts` | Wave 0 / exists |
| PERKS-01..03 | `perks` channel: four cards in fixed order, each with its own state | unit | `pnpm exec vitest run tests/unit/import/perks-worker.test.ts` | Wave 0 |
| D-05, D-09 | List rows and Overview cards only when files exist; footer loses the six folders and keeps `Game_Forums` | unit | `tests/unit/shell/selection-state.test.ts`, `overview-model.test.ts`, `dashboard-status.test.ts`, `list-pane-optional.test.ts` | extend |
| UI copy | Every UI-SPEC string pinned; label maps complete | unit | `pnpm exec vitest run tests/unit/shell/ui-copy.test.ts` | extend |
| Header script | Never prints a cell value, code-shaped token, or `Account_Info` / `Game_Forums` content | unit | `pnpm exec vitest run tests/unit/guards/header-capture-script-12.test.ts` | Wave 0 |
| PRIV-02, D-15 | Zero requests, one worker, no CSP violation while opening both panes | e2e | `pnpm exec playwright test guards/zero-network` | exists, extend |
| PRIV-01 rendered | Planted email absent from text and markup of both panes; code and IP masked until the single reveal | e2e | `pnpm exec playwright test shell/account-timeline-perks` | Wave 0 |
| SCALE-01, D-15 | Large merged timeline windowed; DOM node count bounded; no per-row SVG | e2e + unit | same spec | Wave 0 |
| Layout | 375px: no horizontal page scroll, 44px targets | e2e | same spec | Wave 0 |
| Budget | Listed tests within the ceiling, or all three CI limits raised together | unit guard | `pnpm exec vitest run tests/unit/guards/ci-budget.test.ts` | exists, edit pins |

*Status values to be tracked at execution: pending, green, red, flaky.*

---

## Wave 0 Requirements

- [x] `header_capture_12.py` + `tests/unit/guards/header-capture-script-12.test.ts`; the human-action checkpoint; `12-HEADERS.txt`, `12-HEADERS.md`; names-only additions to `tests/fixtures/new-data-headers.ts`
- [x] `tests/fixtures/new-data-fixtures.ts` additions: one synthetic file per spec key (captured headers, canary columns, email in every allowlisted cell, drifted-header, header-only and bare-CR copies) and a generator for a few-thousand-row merged timeline
- [x] New unit files: `timeline-aggregate.test.ts`, `account-timeline-worker.test.ts`, `perks-worker.test.ts`, `code-mask.test.ts`
- [x] `tests/e2e/shell/account-timeline-perks.spec.ts` (and the zero-network extension)
- [x] Migrate every `Bans` unknown-folder stand-in in the same task as the `categories.ts` change

---

## Manual-Only Verifications

| Behavior | Requirement | Why manual | Test instructions |
|----------|-------------|------------|-------------------|
| Header capture on the user's real export | PRIV-01, D-04 | The real export is private and never committed; only the user can run the script | User runs `header_capture_12.py` on their own zip and supplies column and file names only |
| Visual read of both panes at 375px and 480px | UI-SPEC | Readability is not machine-checkable | Open both panes on a synthetic multi-account fixture and confirm legibility. Done 2026-10-21 in UAT: pass |
| Language and Country chips list entries on the real export | TIMELINE-01 | The real `NAME` tokens are not in the capture | Open the Account timeline on the real export. Done in UAT: pass |

---

## Known Gaps (escalated, implementation fixes needed)

`tests/unit/account-timeline/phase12-gap-fill.test.ts` holds faithful tests for each defect, marked `it.fails` so the suite stays green. Each turns red once the fix lands; remove the marker then.

| Gap | Defect | Fix |
|-----|--------|-----|
| G1 (WR-01) | `\N` shown literally in coupon dates and name-history parts | Add `\N` to the not-reported tokens in `cellOf` (`new-data-aggregate.ts`) |
| G2 (WR-01b) | Ban `EXPIRED_AT` stored but never shown | Map it as a secondary part in `TIMELINE_ENTRY_MAP.bans`, or show an Ongoing word |
| G3 (WR-02) | Unplaced language/country rows dropped, file still `ready`, pane reads "Showing all 0 entries" | Mark such a file `skipped` or add a fallback entry (`timeline-aggregate.ts`) |
| G4 (IN-02) | "Showing all 1 entries"; the merge-note count (rows removed, not entries) is untested | Singular case in `ui-copy.ts`; pane-level test |
| G5 (IN-03) | All-email-dropped rows build a `ready` card with no columns | Treat as `skipped` in `buildCard` |
| G7 (WR-04) | Email guard misses `user@localhost`, full-width at-sign, trailing dot; `TIMELINE_ABOUT` overclaims | Widen the guard in `new-data-allowlist.ts`; soften the copy |

Out of scope, not tested: G6 (`PLAYER_ANSWER` value shape), G8 (Entry column clipping), G9 (dead timeline mask code), G10 (fractional-second sort).

---

## Validation Sign-Off

- [x] All tasks have an automated verify or a Wave 0 dependency
- [x] Sampling continuity: no 3 consecutive tasks without an automated verify
- [x] Wave 0 covers all missing references
- [x] No watch-mode flags
- [x] Feedback latency under 15 s per task
- [ ] `nyquist_compliant: true` set in frontmatter once the above hold

**Approval:** validated with known gaps, 2026-10-21 (`nyquist_compliant` stays false until G1-G5 and G7 are fixed)

## Validation Audit 2026-10-21

| Metric | Count |
|---|---|
| Gaps found | 11 |
| Resolved | 1 |
| Escalated | 6 |
