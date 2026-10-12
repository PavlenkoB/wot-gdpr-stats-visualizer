---
phase: 08-master-detail-ui-redesign
plan: 22
subsystem: ui
tags: [verification, ui-spec, gap-closure]
status: complete
gap_closure: true
gap_ids: [G-08-3]

requires:
  - phase: 08-master-detail-ui-redesign
    provides: plans 08-20 (Finance fill) and 08-21 (Playtime fill)
provides:
  - Full-suite, e2e budget and dependency-manifest proof for G-08-3
  - UI-SPEC Amendment A-1 (G-08-3): measured chart width
  - Manual 1280 / 800 / 375 / wide-window sign-off

actuals:
  tasks: 3
  commits: 1
plan_head_before: ffacb4f2780d0cb4576d31c6abe4268a280b75f2

key-files:
  modified:
    - .planning/phases/08-master-detail-ui-redesign/08-UI-SPEC.md

metrics:
  completed: 2026-10-08
---

# Phase 8 Plan 22: G-08-3 gate, UI-SPEC amendment and manual check Summary

## Task 1: Full-suite gate (no commit, no fixes needed)

- `pnpm run build` passed.
- `pnpm run test:unit`: 85 files, 2617 tests passed, including `ci-budget.test.ts`.
- `pnpm run check`: 305 files, 0 errors, 0 warnings. `pnpm run lint`: clean.
- `pnpm exec playwright test`: 254 of 254 passed (chromium and chromium-mobile), including `tests/e2e/guards/zero-network.spec.ts`.
- `playwright test --list`: 254 tests, under the 258 ceiling. Projected e2e duration 1318 s; 1.3x floor 1713.4 s against the 1740 s `globalTimeout`, limits unchanged.
- `git diff --exit-code a3f91c9 -- package.json pnpm-lock.yaml playwright.config.ts .github/workflows/ci.yml` exited 0.

## Task 2: UI-SPEC amendment (eb8ff25)

`08-UI-SPEC.md` now holds "Amendment A-1 (G-08-3): measured chart width" (cause, rule, floor, no upper bound, 4px ring reserve, bar and heatmap specifics, widths checked) plus two one-line pointers.

## Task 3: Manual check

User response: "approved". All six steps matched:

1. 1280px Finance: pass.
2. 1280px Playtime: pass.
3. 800px stacked layout: pass.
4. 375px: pass.
5. Resize 1500 to 700 and wide window: pass.
6. Start over / replace export: pass.

## Deviations

None.
