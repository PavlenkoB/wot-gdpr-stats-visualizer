---
phase: "14"
slug: "design-unification"
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-10-25"
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Source: `14-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 5.0.2 (unit/guards), Playwright ^1.63 (e2e) |
| **Config file** | `vitest.config.ts`, `playwright.config.ts` |
| **Quick run command** | `npx vitest run tests/unit/guards/phase5-layout-guards.test.ts tests/unit/guards/phase8-ui-review-guards.test.ts tests/unit/charts/contrast.test.ts tests/unit/guards/ci-budget.test.ts` |
| **Full suite command** | `pnpm test:unit && pnpm lint && pnpm check && pnpm run build` (e2e: `pnpm test:e2e` at the phase gate) |
| **Estimated runtime** | ~2 s quick, ~12 s full unit, ~1474 s e2e |

---

## Sampling Rate

- **After every task commit:** Run the quick run command
- **After every plan wave:** Run `pnpm test:unit`, `pnpm lint`, `pnpm check`, `pnpm run build`
- **Before `/gsd-verify-work`:** Full unit suite green, `pnpm test:e2e` green (273 listed tests, no new e2e), screenshot UAT signed off, `grep -rn -- "--ramp-" src tests` returns nothing, `14-OVERVIEW-PIXEL-EVIDENCE.md` shows `BYTE-EQUAL` (equal sizes, nothing moved below the compensated title, D-16) for 1040, 880, 479 and 340 in both its Result and Final re-run sections, and `14-21-SUMMARY.md` carries the `Open items for the owner` section (D-07 partly delivered and D-02/OI-11: owner decides; D-04/OI-6: CONFIRMED 2026-10-25)
- **Max feedback latency:** 15 seconds (unit); e2e only at the phase gate

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 14-01-01 | 01 | 1 | D-01/D-02/D-06/D-07 (tracer) | T-14-01 | Shared layer reaches the built page; no remote reference in the new CSS | build + node check | `pnpm run build` then the node check in the plan (built CSS carries `--fs-title`, `.t-title`, `.visually-hidden`, `.scroller:focus-visible`) | ✅ | ✅ green |
| 14-01-02 | 01 | 1 | D-05 helpers (scanner, mixSrgb) | — | Nested CSS and color-mix arithmetic readable by tests | unit | `pnpm exec vitest run tests/unit/guards/css-helper.test.ts tests/unit/charts/color-helper.test.ts` | ✅ | ✅ green |
| 14-01-03 | 01 | 1 | D-15 baseline record | T-14-03 | The Overview "before" set is retained: baseline commit plus per-width size and sha-256 in the committed evidence file; the file holds no screenshot or export content | file check | the evidence check in plan 14-01 Task 3 `<verify>` (the file exists and holds at least four baseline rows, one per width 1040, 880, 479, 340) | ✅ | ✅ green |
| 14-02-03 | 02 | 2 | D-11 as amended (five data levels plus empty) heat contract | T-14-04 | `--heat-*` declared as `color-mix(in srgb, …)`; 5 data steps ≥ 3:1; monotonic; adjacent ≥ 1.1:1 | unit | `pnpm exec vitest run tests/unit/charts/contrast.test.ts` | ✅ | ✅ green |
| 14-03-01 | 03 | 3 | D-01/D-02/D-03/D-04 (G1-G6, CSS-network, style attribute) | T-14-05 | Tokens declared once; no raw font/spacing/hex; shared names only in `src/styles/`; no `url(`/`@import`/`style=` | guard | `pnpm exec vitest run tests/unit/guards/design-tokens-guards.test.ts` | ✅ | ✅ green |
| 14-04-01 | 04 | 4 | D-05 (G6) | T-14-17 | Nested blocks scope correctly, no `css_unused_selector` | unit (compiler) | `pnpm exec vitest run tests/unit/guards/nesting-guard.test.ts` | ✅ | ✅ green |
| 14-05-01 | 05 | 5 | D-12 titles | T-14-06 | Titles `.t-title` (32px ≥ 900px, 26px below); phone overrides gone | unit + e2e | `pnpm exec playwright test tests/e2e/shell/multi-account.spec.ts tests/e2e/shell/master-detail-nav.spec.ts` | ✅ | ✅ green |
| 14-05-02 | 05 | 5 | D-16 Overview title compensates its line box | T-14-24 | `Overview.svelte` `.section-title` margin-bottom is `calc((var(--fs-display) - var(--fs-title)) * var(--lh-heading))` (-7.8px at ≥ 900px, 0 below), no line-height, height or overflow; DashboardSection carries none; the Overview keeps equal PNG sizes and 0 differing pixels outside the masked title box | unit + scratch compare | `pnpm exec vitest run tests/unit/shell/overview-title.test.ts`; scratch `compare --strict --mask-title` (equal sizes) | ✅ | ✅ green |
| 14-09-01 | 09 | 9 | D-10/D-11 as amended, heat on five consumers | T-14-08 | Level 0 reads `--heat-empty`, levels 1-5 read `--heat-1` to `--heat-5`; ramp deleted; heat contract (`D-11 as amended`) survives the ramp-describe removal | unit + e2e | `pnpm exec playwright test tests/e2e/playtime/playtime-charts.spec.ts tests/e2e/logins/login-map.spec.ts` | ✅ | ✅ green |
| 14-09-03 | 09 | 9 | D-10 (G8) | — | No `--ramp-` outside `.planning/` and `graphify-out/` | grep guard | `! grep -rn -- "--ramp-" src tests` | ✅ | ✅ green |
| 14-10-01 | 10 | 10 | D-08 (PlaytimeSummary) | T-14-09 | Numeral 26px desktop, 18px at 375px, one line | e2e amend | `pnpm exec playwright test tests/e2e/playtime/playtime-ui-review.spec.ts` | ✅ | ✅ green |
| 14-11-01 | 11 | 11 | D-08 (LoginSummary) | — | No 30px size remains; `SCALE_PX` is the six D-06 sizes | unit + e2e | `pnpm exec playwright test tests/e2e/shell/master-detail-nav.spec.ts` | ✅ | ✅ green |
| 14-20-02 | 20 | 20 | D-09/D-15/D-16 Overview identical | T-14-23 | Equal PNG sizes and 0 differing pixels outside the masked title box at 1040/880/479/340; the result (widths, `BYTE-EQUAL` verdict, masked title box) is committed in `14-OVERVIEW-PIXEL-EVIDENCE.md` | scratch compare + committed record | scratch `compare --strict --mask-title` and `evidence --section result` (scripts outside the repo, result file committed); the evidence check in plan 14-20 Task 2 `<verify>` (at least four `BYTE-EQUAL` rows) | ✅ committed record | ✅ green |
| 14-21-01 | 21 | 21 | D-03/D-14 allowlist removal | T-14-16 | No allowlist; guards apply to every file | guard | `pnpm exec vitest run tests/unit/guards` | ✅ | ✅ green |
| 14-21-02 | 21 | 21 | D-07 and D-02/OI-11 open items, D-04/OI-6 confirmed, D-11 as amended, D-15/D-16 final re-run | — | D-07 (owner decides: add `.t-note` roles in a follow-up, or accept) and D-02/OI-11 (owner decides: confirm or move the layout and phone block) are reported as open, and D-04/OI-6 (the 44 radius sites keep 6px) as CONFIRMED 2026-10-25, in the UAT checklist and in `14-21-SUMMARY.md` under `Open items for the owner`; the heat contract passes; the evidence file gains the Final re-run | unit + file check | `pnpm exec vitest run tests/unit/charts/contrast.test.ts`; then the greps in plan 14-21 Task 2 acceptance on `14-OVERVIEW-PIXEL-EVIDENCE.md` and `14-21-SUMMARY.md` | ✅ | ✅ green |
| any | any | any | Zero-network | T: no new request | No network after load; no remote `url(`/`@import` in CSS | e2e + unit | `pnpm exec vitest run tests/unit/guards/fetch-scan.test.ts` + design-tokens guard CSS-network rule + `tests/e2e/guards/zero-network.spec.ts` | ✅ | ✅ green |
| any | any | any | Budget | — | Listed e2e count ≤ 273 | unit | `pnpm exec vitest run tests/unit/guards/ci-budget.test.ts` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Every sweep test must assert it visited ≥ 1 file and matched ≥ 1 declaration (non-vacuity rule).*

---

## Wave 0 Requirements

- [x] `tests/helpers/css.ts` — brace-aware scanner with its own unit test (strings, `@media`, nested depth) — plan 14-01 Task 2
- [x] `tests/helpers/color.ts` — `mixSrgb` and rgb-float luminance, tested against Chromium-verified (89, 150.5, 68) and (123.5, 119, 10) — plan 14-01 Task 2
- [x] `tests/unit/guards/design-tokens-guards.test.ts` — G1–G5 and CSS-network check, each with non-empty-match assertion and synthetic self-test — plan 14-03 Task 1
- [x] `tests/unit/guards/nesting-guard.test.ts` — compiles a nested fixture with `svelte/compiler`, asserts `:where(.svelte-` and no `css_unused_selector` — plan 14-04 Task 1
- [x] `tests/unit/shell/overview-title.test.ts` — pins the D-16 compensation arithmetic (-7.8px at ≥ 900px, 0 below) and that DashboardSection carries none — plan 14-05 Task 1
- [x] `tests/helpers/components.ts` — `SCALE_PX = {12, 14, 18, 26, 32, 56}` (temporary 30 from plan 14-04 until plan 14-11); `OVERVIEW_SCALE_PX` removed in plan 14-21
- [x] Scratch screenshot harness and Overview pixel-compare, **outside the repo** (not listed by `playwright test --list`) — plan 14-01 Task 3. The harness and its PNG sets were wiped by a machine restart before plan 14-21; the Final re-run was measured with a replacement script that reproduced all four Baseline PNG sizes. The committed record in `14-OVERVIEW-PIXEL-EVIDENCE.md` is what remains.
- [x] `.planning/phases/14-design-unification/14-OVERVIEW-PIXEL-EVIDENCE.md` — committed record of the Overview compare (Baseline written by plan 14-01 Task 3, Result by plan 14-20 Task 2, Final re-run by plan 14-21 Task 2); the harness `evidence` subcommand writes it, the harness itself stays scratch

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Before/after screenshots of every pane at 1280 / 900 / 899 / 375 px | D-13 | 6px→4px snaps, 30→26px and 32px titles change pixels on purpose | Run the `run-data-export-viewer` driver against `pnpm run preview` (port 4173) with `tests/fixtures/multi-account-fixtures.ts`; owner reviews in UAT |
| Overview pixel identity except the title's own box | D-15, D-16 | The in-page `ImageData` compare runs from scratch scripts that are not committed; its result is committed | Capture Overview root before/after at 1040, 880, 479, 340 px; require equal PNG sizes (the Overview title compensates its line box, D-16); mask the title box at ≥ 880 px; read the verdicts in `14-OVERVIEW-PIXEL-EVIDENCE.md` (widths, `BYTE-EQUAL`, masked title box) |
| D-07 open item: 105 of 188 14px/1.4 sites keep token declarations | D-07 | An owner decision, not a test | At UAT the owner decides: add `.t-note` roles in a follow-up, or accept. Listed in plan 14-21's UAT checklist and in `14-21-SUMMARY.md` (`Open items for the owner`) |
| D-02 / UI-SPEC OI-11 open item: `app.css` keeps the shell layout and the phone block | D-02 | An owner decision, not a test; NOT yet confirmed (2026-10-25) | At UAT the owner decides: confirm, or direct a follow-up that moves them into `src/styles/` and repoints the phase-8 guard. Listed in plan 14-21's UAT checklist and in `14-21-SUMMARY.md` |
| D-04 / UI-SPEC OI-6: the 44 radius sites keep 6px as `--radius-sm` | D-04 | Recorded, not open | CONFIRMED by the owner in chat 2026-10-25; listed in plan 14-21's UAT checklist and summary for the record |
| No title wraps/overflows at 900 and 375 px (except long nicknames) | D-12 | Layout judgement | Computed-style check + UAT |
| Payments focal element and 4px gap choice | UI-SPEC OI | Declared, not measured | UAT confirmation |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15 s (quick run; the full unit suite measured about 35 s against the ~12 s estimate)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-10-27 by running the table's own commands and file checks against HEAD 695cff7; manual-only rows remain for owner UAT

## Validation Audit 2026-10-27

| Metric | Count |
|---|---|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |
