---
phase: "4"
slug: "activity-time-dashboards"
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-29"
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Seeded from the
> "Validation Architecture" section of `04-RESEARCH.md`; the per-task map is filled in as plans land.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^5.0.2 (`environment: 'node'`, no jsdom, `fake-indexeddb` for the Dexie layer) + Playwright ^1.63 (Chromium only; the `webServer` builds and previews the production bundle) |
| **Config file** | `vitest.config.ts`, `playwright.config.ts` |
| **Quick run command** | `pnpm exec vitest run tests/unit/playtime.test.ts tests/unit/playtime-model.test.ts tests/unit/civil-date.test.ts` |
| **Full suite command** | `pnpm run lint && pnpm run check && pnpm run test:unit && pnpm exec playwright test` |
| **Estimated runtime** | Quick under 10 s. Unit step at most 90 s (plan 04-13 measures it). Playwright in CI is a projected 630 s for about 128 tests on one worker under the amended limits derived in plan 04-13 (global 15 min, wrapper 17 min, job 25 min); Chromium is not installable in the cloud sandbox, so e2e runs in CI |

> **CI dependency of the browser criteria.** Chromium cannot be downloaded in the cloud sandbox, so every criterion marked "e2e" or "browser in 04-11" is verified in the sandbox only by `playwright test --list` (specs load, counts recorded) plus the Node tests that prove the numbers those specs use (`tests/unit/playtime-hand-fixture.test.ts` proves the hand numbers and both weekday-hour tables against the oracle). The browser run itself happens in CI (one Playwright worker) or on a developer machine, and each plan's `human-check` block names the command. Until a CI run has passed, browser rows stay "pending" below and `nyquist_compliant` stays `false`. Plan 04-13 owns the CI limits and their guard test.

---

## Sampling Rate

- **After every task commit:** run the quick command, plus `pnpm run check` when a `.svelte` file or `worker-messages.ts` changed.
- **After every plan wave:** `pnpm run lint && pnpm run check && pnpm run test:unit`.
- **Before `/gsd-verify-work`:** the full suite green, plus the human check against a real export.
- **Max feedback latency:** 10 seconds for the quick command.

---

## Per-Requirement Verification Map

| Requirement | Behavior | Test Type | Automated Command | File Exists |
|-------------|----------|-----------|-------------------|-------------|
| ACTIVITY-01 | seconds, sessions and active days per slice; overlaps merged; midnight crossing attributed to start day; excluded rows counted; usable + excluded equals stored rows | unit | `pnpm exec vitest run tests/unit/playtime.test.ts` | ❌ W0 |
| ACTIVITY-01 | oracle cross-check against a per-second bitmap | unit | same | ❌ W0 |
| ACTIVITY-01 | tiles and excluded-row pill render formatted values | e2e | `pnpm exec playwright test tests/e2e/playtime.spec.ts` | ❌ W0 |
| ACTIVITY-02 | calendar model: cell count equals days in active years, at most 54 columns, empty-year collapse, year totals equal the tile | unit | `pnpm exec vitest run tests/unit/playtime-model.test.ts` | ❌ W0 |
| ACTIVITY-02 | rank colour scale: ties, n = 0/1/2, level 0 never shaded | unit | same | ❌ W0 |
| ACTIVITY-02 | calendar cells, tooltip on hover and focus, arrow-key roving focus | e2e | `pnpm exec playwright test tests/e2e/playtime-charts.spec.ts` | ❌ W0 |
| ACTIVITY-03 | both hour grids sum to the total; weekday index Monday = 0; week-peel matches the oracle | unit | `pnpm exec vitest run tests/unit/playtime.test.ts` | ❌ W0 |
| ACTIVITY-03 | 168 hour cells with per-basis expected seconds (overlap and start tables differ in six cells, both proved against the oracle); timezone caption always visible | unit + e2e | `pnpm exec vitest run tests/unit/playtime-hand-fixture.test.ts`; `pnpm exec playwright test tests/e2e/playtime-charts.spec.ts` | ❌ W0 |
| ACTIVITY-04 | 12 bins, edge inclusion, zero-length sessions, bins sum to sessions | unit | `pnpm exec vitest run tests/unit/playtime.test.ts` | ❌ W0 |
| ACTIVITY-04 | 12 duration bins; bin counts sum to the sessions tile | e2e | `pnpm exec playwright test tests/e2e/playtime-charts.spec.ts tests/e2e/playtime-scale.spec.ts` | ❌ W0 |
| Split (D-03) | column-selection rule; blank values; `__proto__` value; selector resets on replace and clear | unit + e2e | `pnpm exec vitest run tests/unit/playtime.test.ts`; `pnpm exec playwright test tests/e2e/playtime.spec.ts` | ❌ W0 |
| Contract | `playtime-query` after ingest; legacy-meta backfill; query after clear; `IngestClient` ignores `playtime-*` for its own state | unit | `pnpm exec vitest run tests/unit/ingest-worker.test.ts tests/unit/ingest-client.test.ts tests/unit/playtime-client.test.ts` | partial |
| Scale (SC5) | 50k+ sessions over 12-15 years: model sizes independent of session count | unit | `pnpm exec vitest run tests/unit/playtime.test.ts` | ❌ W0 |
| Scale (SC5) | DOM node count for a 5,000-session export equals that of a 60,000-session export over the same years; no long task of 1000 ms or more | e2e | `pnpm exec playwright test tests/e2e/playtime-scale.spec.ts` | ❌ W0 |
| Contrast | ramp in `app.css` equals the ramp in `04-UI-SPEC.md`; luminance strictly decreasing; adjacent ratio at least 1.25 | unit | `pnpm exec vitest run tests/unit/contrast.test.ts` | extend |
| Privacy | no IP value in `meta.playtime`, page content, tooltips, aria labels or data attributes | unit + e2e | `pnpm exec vitest run tests/unit/playtime.test.ts`; `pnpm exec playwright test tests/e2e/playtime.spec.ts` | ❌ W0 |
| Zero network | request count unchanged through import and selector changes on the large fixture | e2e | `pnpm exec playwright test tests/e2e/playtime-scale.spec.ts tests/e2e/zero-network.spec.ts` | extend |
| Phone | at 375 px the page has no horizontal scroll; far-right cell focus scrolls inside its own scroller | e2e | `pnpm exec playwright test tests/e2e/playtime.spec.ts tests/e2e/playtime-charts.spec.ts` | ❌ W0 |
| CI budget | the three nested CI limits are ordered with margin against the projected e2e duration; every spec loads | unit | `pnpm exec vitest run tests/unit/ci-budget.test.ts` | ❌ W0 |

## Per-Task Verification Map

Final plan numbering (13 plans, 8 waves). The foundation plan was split, so plan numbers 02 to 11 of the earlier draft are now 03 to 12 and plan 04-13 is new. Requirement column: ACTIVITY-NN. "Run where": every command in the table runs in the cloud sandbox; where a command only lists Playwright specs (`--list`), or where the type says "browser in 04-11", the browser assertions themselves run in CI or on a developer machine (see the CI dependency note above).

| Task ID | Wave | ACTIVITY- | Behavior | Test Type | Automated Command | Status |
|---------|------|-----------|----------|-----------|-------------------|--------|
| 04-01-01 | 1 | 01 | Tracer, worker half: Sessions.csv row to Dexie meta aggregate to playtime-query answer; header-only and Logins-only cases | unit | `pnpm exec vitest run tests/unit/ingest-worker.test.ts -t "04-01 tracer" && pnpm run check` | ⬜ pending |
| 04-01-02 | 1 | 01 | PlaytimeClient and the IngestClient delegation seam over the real worker | unit | `pnpm exec vitest run tests/unit/ingest-worker.test.ts tests/unit/ingest-client.test.ts && pnpm run check && pnpm run lint` | ⬜ pending |
| 04-02-01 | 2 | 01 | Tracer, UI half: ready status, Sessions tile, six strings pinned to the UI-SPEC, Phase 3 unit assertions migrated | unit + build | `pnpm exec vitest run tests/unit/ui-copy.test.ts tests/unit/dashboard-status.test.ts && pnpm run test:unit && pnpm run check && pnpm run lint && pnpm run build` | ⬜ pending |
| 04-02-02 | 2 | 01 | Phase 3 e2e assertions migrated off 'Activity_history is pending' | e2e (list here, run in CI) | `pnpm run check && pnpm run lint && pnpm exec playwright test tests/e2e/dashboard.spec.ts tests/e2e/import-flow.spec.ts tests/e2e/persistent-dataset.spec.ts --list` | ⬜ pending |
| 04-03-01 | 2 | 01, 03, 04 | Tracer: overlap, midnight crossing, containment to both hour grids and bins | unit | `pnpm exec vitest run tests/unit/playtime.test.ts -t "04-03 tracer" && pnpm run check` | ⬜ pending |
| 04-03-02 | 2 | 01, 03, 04 | Seeded fixture generator with analytic key; civil-date cross-check | unit | `pnpm exec vitest run tests/unit/sessions-fixtures.test.ts tests/unit/civil-date.test.ts && pnpm run check` | ⬜ pending |
| 04-03-03 | 2 | 01, 03, 04 | Parse table, exclusion and merge matrix, IP never read, bounded time, seeded oracle | unit | `pnpm exec vitest run tests/unit/playtime.test.ts tests/unit/ingest-worker.test.ts && pnpm run check` | ⬜ pending |
| 04-04-01 | 3 | 01 to 04 | Tracer: formatHours end to end; one ramp step from UI-SPEC through app.css into contrast tests | unit | `pnpm exec vitest run tests/unit/ui-copy.test.ts tests/unit/contrast.test.ts && pnpm run check` | ⬜ pending |
| 04-04-02 | 3 | 01 to 04 | Static strings and count formatters | unit | `pnpm exec vitest run tests/unit/ui-copy.test.ts && pnpm run check` | ⬜ pending |
| 04-04-03 | 3 | 01 to 04 | Date, tooltip, accessible-name formatters; hour-basis wording | unit | `pnpm exec vitest run tests/unit/ui-copy.test.ts tests/unit/contrast.test.ts && pnpm run check && pnpm run lint` | ⬜ pending |
| 04-05-01 | 2 | 02 to 04 | Tracer: rank scale and a one-day calendar model | unit | `pnpm exec vitest run tests/unit/playtime-model.test.ts -t "04-05 tracer" && pnpm run check` | ⬜ pending |
| 04-05-02 | 2 | 02 to 04 | Multi-year layout, empty-run collapse, calendar keyboard navigation | unit | `pnpm exec vitest run tests/unit/playtime-model.test.ts && pnpm run check` | ⬜ pending |
| 04-05-03 | 2 | 02 to 04 | Hour grid, duration rows, split table, selection reset, tooltip placement | unit | `pnpm exec vitest run tests/unit/playtime-model.test.ts tests/unit/playtime.test.ts tests/unit/civil-date.test.ts && pnpm run check && pnpm run lint` | ⬜ pending |
| 04-06-01 | 3 | 01 | Tracer: two-server Sessions.csv to a per-value slice through the worker | unit | `pnpm exec vitest run tests/unit/ingest-worker.test.ts -t "04-0[16] tracer" && pnpm run check` | ⬜ pending |
| 04-06-02 | 3 | 01 | Column-choice matrix, value handling, ordering, cross-value overlap | unit | `pnpm exec vitest run tests/unit/playtime.test.ts tests/unit/ingest-worker.test.ts && pnpm run check` | ⬜ pending |
| 04-06-03 | 3 | 01 | Lazy backfill, atomic snapshot, playtime-error channel | unit | `pnpm exec vitest run tests/unit/ingest-worker.test.ts tests/unit/db.test.ts tests/unit/playtime.test.ts && pnpm run check && pnpm run lint` | ⬜ pending |
| 04-07-01 | 2 | 01 | Tracer: worker error resolves a pending query as an error outcome | unit | `pnpm exec vitest run tests/unit/ingest-client.test.ts && pnpm run check` | ⬜ pending |
| 04-07-02 | 2 | 01 | PlaytimeClient behaviour matrix (supersede, stale ids, unavailable worker) | unit | `pnpm exec vitest run tests/unit/playtime-client.test.ts tests/unit/ingest-client.test.ts && pnpm run check` | ⬜ pending |
| 04-07-03 | 2 | 01 | IngestClient regression suite; availability probe | unit | `pnpm exec vitest run tests/unit/ingest-client.test.ts tests/unit/playtime-client.test.ts && pnpm run check && pnpm run lint` | ⬜ pending |
| 04-08-01 | 4 | 01 | Tracer: selection path, only a current answer applied, tiles and announcement | unit + build | `pnpm exec vitest run tests/unit/playtime-state.test.ts && pnpm run check && pnpm run lint && pnpm run build` | ⬜ pending |
| 04-08-02 | 4 | 01 | Split table, excluded notice, empty and error states, layout rules | unit + build | `pnpm run check && pnpm run lint && pnpm run build && pnpm exec vitest run tests/unit/playtime-state.test.ts tests/unit/playtime-model.test.ts tests/unit/ui-copy.test.ts` | ⬜ pending |
| 04-08-03 | 4 | 01 | Login history sub-heading; pending-note assertion restored | unit + build; e2e list | `pnpm run lint && pnpm run check && pnpm run build && pnpm run test:unit && pnpm exec playwright test tests/e2e/dashboard.spec.ts --list` | ⬜ pending |
| 04-09-01 | 5 | 03, 04 | Tracer: 168-cell weekday by hour grid with caption and legend | build; browser in 04-11 | `pnpm run lint && pnpm run check && pnpm run build && pnpm run test:unit` | ⬜ pending |
| 04-09-02 | 5 | 03, 04 | Shared tooltip, roving focus, focus ring, scroll correction (hour grid) | unit + build; browser in 04-11 | `pnpm run lint && pnpm run check && pnpm run build && pnpm exec vitest run tests/unit/playtime-model.test.ts` | ⬜ pending |
| 04-09-03 | 5 | 03, 04 | Session length list, twelve rows | build; browser in 04-11 | `pnpm run lint && pnpm run check && pnpm run build && pnpm run test:unit` | ⬜ pending |
| 04-10-01 | 6 | 02 | Tracer: newest-first year blocks, sticky heads, shaded cells, empty-year lines | build; browser in 04-11 | `pnpm run lint && pnpm run check && pnpm run build && pnpm run test:unit` | ⬜ pending |
| 04-10-02 | 6 | 02 | One roving tab stop across years, tooltip, focus ring, scroll clearance | unit + build; browser in 04-11 | `pnpm run lint && pnpm run check && pnpm run build && pnpm exec vitest run tests/unit/playtime-model.test.ts tests/unit/ui-copy.test.ts` | ⬜ pending |
| 04-11-01 | 7 | 01 to 04 | Tracer: import to hand totals to selector; hand numbers proved against the oracle for both hour bases | unit + e2e (list here, run in CI) | `pnpm exec vitest run tests/unit/playtime-hand-fixture.test.ts && pnpm exec playwright test tests/e2e/playtime.spec.ts --list && pnpm run check && pnpm run lint` | ⬜ pending |
| 04-11-02 | 7 | 01 to 04 | Block specs: states, split table, excluded pill, hostile values, privacy, selector reset | e2e (list here, run in CI) | `pnpm exec playwright test tests/e2e/playtime.spec.ts --list && pnpm run check && pnpm run lint` | ⬜ pending |
| 04-11-03 | 7 | 01 to 04 | Chart specs: calendar, hour grid per basis, duration, tooltip, keyboard, sticky, overflow, clipping | e2e (list here, run in CI) | `pnpm exec playwright test tests/e2e/playtime-charts.spec.ts --list && pnpm run check && pnpm run lint` | ⬜ pending |
| 04-12-01 | 7 | 01 to 04 | Tracer: 60,000-session export through the real worker equals the analytic key; 5k vs 60k model size | unit | `pnpm exec vitest run tests/unit/playtime-scale.test.ts tests/unit/ingest-worker.test.ts -t "04-12" && pnpm run check && pnpm run lint` | ⬜ pending |
| 04-12-02 | 7 | 01 to 04 | Browser scale specs, zero-network extension over the large flow | e2e (list here, run in CI) | `pnpm exec playwright test tests/e2e/playtime-scale.spec.ts tests/e2e/zero-network.spec.ts --list && pnpm run check && pnpm run lint` | ⬜ pending |
| 04-12-03 | 7 | 01 to 04 | Demo driver and skill notes; human check against a real export | node scripts; human | `node .claude/skills/run-data-export-viewer/sessions-csv.mjs --check && node --check .claude/skills/run-data-export-viewer/driver.mjs` | ⬜ pending |
| 04-13-01 | 8 | 01 to 04 | CI limits derived and guarded (global timeout, wrapper, job) | unit; CI run measures duration | `pnpm exec vitest run tests/unit/ci-budget.test.ts && pnpm run lint && pnpm run check && git diff --quiet 40ac5c2 -- package.json pnpm-lock.yaml` | ⬜ pending |

Plan-level notes: plans 04-09 and 04-10 verify component behaviour in the browser through plan 04-11's specs (their own commands are lint, check, build and the unit suite); plans 04-11 and 04-12 hold at most 36 and 8 browser tests, the counts plan 04-13 derives the CI limits from.

---

## Wave 0 Requirements

- [ ] `tests/fixtures/sessions-fixtures.ts` — seeded generator for 50k+ sessions over 12-15 years with overlaps, midnight crossings, zero-length and bad rows, plus an independent per-second oracle in `tests/helpers/`
- [ ] `tests/unit/playtime.test.ts`, `tests/unit/playtime-model.test.ts`, `tests/unit/civil-date.test.ts`, `tests/unit/playtime-client.test.ts`, `tests/unit/sessions-fixtures.test.ts`, `tests/unit/playtime-state.test.ts`, `tests/unit/playtime-scale.test.ts`
- [ ] Extensions to `ui-copy.test.ts`, `contrast.test.ts`, `dashboard-status.test.ts`, `ingest-worker.test.ts`, `ingest-client.test.ts`, `zero-network.spec.ts`
- [ ] `tests/e2e/playtime.spec.ts`, `tests/e2e/playtime-charts.spec.ts` and `tests/e2e/playtime-scale.spec.ts`; the shared hand fixture `tests/fixtures/playtime-hand-fixture.ts` (a non-spec module, because Playwright rejects a spec that imports another spec) with its cross-check `tests/unit/playtime-hand-fixture.test.ts`
- [ ] `tests/unit/ci-budget.test.ts` (CI limits guard, plan 04-13)
- [ ] Framework install: none

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Split column picks a sensible column on a real export | D-03 | No real export exists in the repo or sandbox | Import a real Wargaming export; confirm the selector label and values make sense, or that no selector appears |
| Sticky year head and focus scrolling in a real browser | ACTIVITY-02 | Chromium cannot be downloaded in the cloud sandbox | Run the Playwright suite in CI or locally and eyeball the calendar at desktop and 375 px width |
| Weekday x hour attribution (overlap default, start alternative) | ACTIVITY-03, D-01 | Owner decision, not a test | Owner picks the basis after seeing a real export; a one-constant switch (`HOUR_GRID_BASIS`), both hand tables already proved |
| First CI run duration of the e2e step | CI budget | The 630 s projection is an estimate until one real run | Read the E2E step duration from the CI log and record it in the plan 04-13 SUMMARY; re-derive the limits if it exceeds about 692 s |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency under 10 s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
