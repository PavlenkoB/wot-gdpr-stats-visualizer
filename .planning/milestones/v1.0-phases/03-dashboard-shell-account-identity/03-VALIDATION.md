---
phase: "3"
slug: "dashboard-shell-account-identity"
status: validated
nyquist_compliant: true
wave_0_complete: true
validated: "2026-09-29"
unit_test_files: 14
unit_tests: 316
e2e_spec_files: 7
e2e_tests: 83
created: "2026-09-29"
---

# Phase 3 — Validation Strategy

> Per-phase validation contract. Originally drafted before execution; this
> revision records the coverage the seven completed plans actually delivered.
> Every status below was re-derived from the shipped suites on 2026-09-29, not
> copied from a plan or a SUMMARY.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 5.0.2 (`environment: 'node'`, no jsdom, `fake-indexeddb` for the Dexie layer) + Playwright 1.63 (Chromium only; `webServer` builds and previews the production bundle on port 4173, `reuseExistingServer: false`) |
| **Config file** | `vitest.config.ts`, `playwright.config.ts` |
| **Quick run command** | `pnpm exec vitest run tests/unit/<file>.test.ts` (one e2e spec: `pnpm exec playwright test tests/e2e/<file>.spec.ts`) |
| **Full suite command** | `pnpm run lint && pnpm run check && pnpm run test:unit && pnpm run test:e2e` |
| **Unit suites** | **14 test files, 316 tests** |
| **E2E suites** | **7 spec files, 83 tests** |
| **Measured runtime** | unit 1.07 s, e2e 37.5 s on this machine (the planning-time estimate of ~180 s was ~4x high; `lint-guards.test.ts` is the slowest unit file but the whole unit tier finishes in about a second) |

`tests/unit/setup.ts` and `tests/e2e/helpers.ts` are harness files, not suites, and are excluded from the counts above.

---

## Sampling Rate

- **After every task commit:** the single relevant `vitest run tests/unit/<file>`; add `pnpm run check` for any `.svelte` or type change
- **After every plan wave:** `pnpm run lint && pnpm run check && pnpm run test:unit`
- **Before `/gsd-verify-work`:** full suite including `pnpm run test:e2e` must be green
- **Max feedback latency:** 60 seconds for per-task checks — satisfied with wide margin; the whole unit tier is a ~1 s command

---

## Per-Task Verification Map

Keyed by requirement and success criterion. The **Evidence** column names the
named tests that actually carry the check, and each command was re-run (or
`--list`-confirmed for the `-g` filters) on 2026-09-29.

| Requirement / Criterion | Behavior | Test Type | Automated Command | Evidence | Status |
|-------------------------|----------|-----------|-------------------|----------|--------|
| IDENTITY-01 / SC1a | Nickname, region and date-only created shown; D-17 row choice | unit + e2e | `pnpm exec vitest run tests/unit/identity.test.ts tests/unit/ingest-worker.test.ts` ; `pnpm exec playwright test tests/e2e/dashboard.spec.ts -g '\(identity-loaded\)\|\(fallback\)\|\(multi-row\)\|\(multi-row-no-match\)\|\(rootless\)\|\(empty-user-info\)'` (6 tests) | `identity.test.ts` 17 tests incl. D-17 decoy/fallback/stable-choice; `ingest-worker.test.ts` 19 tests incl. `(identity)`, `(replay)`; `dashboard.spec.ts` asserts `identity-nickname` / `identity-region` / `identity-created` (`2020-01-01`, exact match) / `identity-account-id` | ⚠️ see [Coverage seam](#known-coverage-seams) |
| IDENTITY-01 / SC1b | Email and birth date appear nowhere: DOM text, attributes, title, a11y tree, console, IndexedDB (fresh import and reload) | e2e + unit | `pnpm exec playwright test tests/e2e/identity-privacy.spec.ts` ; `pnpm exec vitest run tests/unit/ingest-worker.test.ts tests/unit/db.test.ts` | `identity-privacy.spec.ts` `(a)`, `(b)`, `(c) ×N header variants` — 5 tests, each needle paired with a positive control; `(no-leak)` at the row level; mutation-proven non-vacuous (03-VERIFICATION §1c: 5/5 go red when the strip is neutered) | ✅ green |
| D-19 | Existing v1 cache wiped; fresh DB untouched | unit (fake-indexeddb) | `pnpm exec vitest run tests/unit/db.test.ts` | `db.test.ts` seeds a real v1 store holding a `LOGIN` row and asserts rows + meta are empty; a second test pins the DB *name* so the seeded store is actually reached; a third proves v2 data survives close/re-open, so the upgrader never re-runs on a fresh DB | ✅ green |
| DATA-03 / SC2 | Every non-supported folder gets the identical banner; zero-unsupported state | e2e + unit | `pnpm exec playwright test tests/e2e/dashboard.spec.ts -g '\(banners-sample\)\|\(banners-renamed\)\|\(none\)\|\(skip\)\|\(case-variants\)'` ; `pnpm exec vitest run tests/unit/dashboard-status.test.ts` | `dashboard-status.test.ts` `unsupported block` describe (4 tests) incl. `'Bans'`/`'bans'` kept separate; e2e compares nine `getComputedStyle` properties across `data-status` variants; `(markup)` proves an untrusted folder name creates no element | ✅ green |
| DATA-04 / SC3 | Missing supported folder is a greyed `no-export` section with a muted nav link; zero-row is a distinct `empty` state | unit + e2e | `pnpm exec playwright test tests/e2e/dashboard.spec.ts -g '\(absent\)\|\(empty\)'` (2 tests) ; `pnpm exec vitest run tests/unit/dashboard-status.test.ts` | `dashboard-status.test.ts` `'absent and present-but-empty stay distinct in both status and wording'`; `navEntries` mutes only the affected link and reports the reason; `ui-copy.test.ts` `'the three greyed section statuses have three distinct messages'`; `(muted-names)` in `scroll-nav.spec.ts` carries the accessible-name half | ✅ green |
| SC4a | Processing, duplicate, error and cleared notices use the single notice slot; dashboard stays visible during and after a failed replace | unit + e2e | `pnpm exec vitest run tests/unit/ingest-client.test.ts` ; `pnpm exec playwright test tests/e2e/dashboard.spec.ts -g '\(busy\)\|\(single-live-region\)\|\(duplicate\)\|\(replace-in-flight\)\|\(failed-replace\)\|\(first-error\)\|\(cleared\)\|\(drop-during-confirm\)\|\(stray-drop\)'` (9 tests) | `(single-live-region)` proves one `aria-live` region for the whole page; `(failed-replace)` proves the old dataset survives a failure *including after a reload*; `(drop-during-confirm)` / `(stray-drop)` cover the widened drop path | ✅ green |
| SC4b | Return visit opens straight to the dashboard | e2e | `pnpm exec playwright test tests/e2e/persistent-dataset.spec.ts -g 'return visit'` | `persistent-dataset.spec.ts` `(a)` and `dashboard.spec.ts` `(return-visit)` / `(cache-check-window)`; the proof is now the co-rendered file input's empty `FileList` (see Known deviations) | ✅ green |
| D-01 / D-05 | Sticky nav; scroll-spy sets `aria-current="location"` per the band rule | unit (pure) + e2e | `pnpm exec vitest run tests/unit/scroll-spy.test.ts` ; `pnpm exec playwright test tests/e2e/scroll-nav.spec.ts -g 'tracer\|sticky\|band-mirror\|anchors'` | `scroll-spy.test.ts` 15 tests over `pickActiveSection`, `isAtPageBottom` (pixel-exact), `buildRootMargin`, `parseNavOffset`; e2e asserts the exact `aria-current` attribute at top, bottom and each band, and `(anchors)` proves native hash links land below the sticky nav | ✅ green |
| UI-SPEC backstops | 375px: no horizontal page scroll, last nav link reachable, long names wrap | e2e | `pnpm exec playwright test tests/e2e/scroll-nav.spec.ts tests/e2e/dashboard.spec.ts -g 'phone-375\|long-text'` (4 tests) | `scroll-nav.spec.ts` `(phone-375)` focuses the last link and polls the nav's own `scrollLeft` > 0, then bounds-checks it inside the nav box and pins the nav height as width-independent; `(long-text)` runs at 375 px and 720 px; `dashboard.spec.ts` `(phone-375)` covers the slim bar | ✅ green |
| Focus management | Confirm focuses dismiss; dismiss returns to trigger; clear focuses full dropzone | e2e | `pnpm exec playwright test tests/e2e/dashboard.spec.ts -g 'start-over\|clear-data\|replace-on-drop\|confirmed-clear'` (4 of 7 hits in the whole spec) | `(start-over)` panel opens with the safe default focused and dismiss returns focus to the trigger; `(replace-on-drop)` dismiss focuses the dropzone; `(confirmed-clear)` and `(clear-data)` cover both destructive paths | ✅ green |
| Standing guards | Zero-network and CSP still green; lint-guard tests | e2e + unit | `pnpm exec playwright test tests/e2e/zero-network.spec.ts` ; `pnpm exec vitest run tests/unit/lint-guards.test.ts` | 2 e2e tests (no requests after load incl. the worker script; served HTML carries the CSP meta with `default-src` and `connect-src 'none'`); `zero-network.spec.ts` has no `testIgnore`, so it runs inside the default `test:e2e` gate on every wave | ✅ green |
| Copy | New strings and formatters; retired copy removed | unit + e2e | `pnpm exec vitest run tests/unit/ui-copy.test.ts` ; `pnpm exec playwright test tests/e2e/dashboard.spec.ts -g '\(retired\)'` | `ui-copy.test.ts` 37 tests, including the three new Phase 3 describes (section/nav/banner copy, identity header copy, `formatCreatedDate`); `dashboard.spec.ts` `(retired)` asserts the badge list, summary line, account heading and results wrapper are gone from the DOM | ✅ green |

*Status: ✅ green · ⚠️ covered with a known seam · ❌ red · ⏭ manual-only*

### Requirement-level verdict

| Requirement | Automated coverage | Verdict |
|-------------|--------------------|---------|
| IDENTITY-01 | 17 `identity.test.ts` + 19 `ingest-worker.test.ts` unit tests, 5 `identity-privacy.spec.ts` e2e tests, 6 header-variant e2e tests in `dashboard.spec.ts` | satisfied |
| DATA-03 | 5 `unsupported block` tests in `dashboard-status.test.ts` + 5 banner e2e tests in `dashboard.spec.ts` | satisfied |
| DATA-04 | 23 `dashboard-status.test.ts` tests + 2 section-state e2e tests + 4 `(muted-names)` nav e2e tests | satisfied |

Test counts are Vitest's and Playwright's own reported totals for the named
file, not a count of `test(` call sites — the e2e totals are 38 / 5 / 10 / 7 /
8 / 13 / 2 across the seven specs, which sums to the 83 in the gate.

All four ROADMAP success criteria and all three requirement IDs are carried by
tests that run green in the default gate. `nyquist_compliant: true` is asserted
at this level. The one open item is a criterion-level rendering detail, not a
requirement, and is recorded below rather than absorbed.

---

## Known Coverage Seams

**One open seam. It is disclosed, not closed, and it is the only thing standing
between this phase and an unqualified clean bill.**

| # | Promised by the plan | Actually covered | Why it is open |
|---|----------------------|-------------------|----------------|
| S-1 | SC1a: "`Unknown` for missing" values in the identity header | The *inputs* to the placeholder are tested: `ingest-worker.test.ts` returns three `null` slots when the identity columns are absent, `ui-copy.test.ts:214` pins `UNKNOWN_VALUE === 'Unknown'`, and `formatCreatedDate` is unit-tested for null/empty/whitespace/T-only. The *rendered* `loaded` card is not: no e2e imports a fixture whose `User_Info` row is present but missing `REGION` or the nickname, and no test asserts `identity-region` or `identity-nickname` contains `Unknown`. `dashboard.spec.ts` `(empty-user-info)` does not close it — that fixture takes the `fallback` variant, which does not render the three-field card at all. | `IdentityHeader.svelte:62` `valueOrUnknown()` and lines 87 / 100 are unexercised in the DOM. A regression that rendered an empty `<dd>` would pass every suite in this phase. |

The smallest test that would close it: one `dashboard.spec.ts` case importing a
`buildCustomExport` fixture with the `REGION` cell blank, asserting
`identity-region` has text `Unknown` while `identity-nickname` still shows the
real nickname. It is **not** written here — this run was scoped to the planning
artifact and explicitly forbidden from touching the test suite. Severity: low
(the constant and the formatter are both pinned, and the leak direction fails
closed to a visible word rather than to raw PII).

---

## Plan / task map (as executed)

| Criterion | Plan and task that created the check | Wave | Outcome |
|-----------|--------------------------------------|------|---------|
| IDENTITY-01 / SC1a (identity, D-17) | 03-01 T1 (worker tracer), T2 (`identity.test.ts`, variant fixtures); 03-04 T1-T2 (e2e header, sections, fallback, multi-row) | 1, 2 | delivered, 1 seam (S-1) |
| IDENTITY-01 / SC1b (no leak) | 03-01 T1-T2 (worker and IndexedDB assertions); 03-04 T1 and T3 (`identity-privacy.spec.ts`) | 1, 2 | delivered, mutation-proven |
| D-19 (v1 wipe) | 03-01 T3 (`db.test.ts`) | 1 | delivered |
| DATA-03 / SC2 (banners) | 03-02 T1 (`dashboard-status.test.ts`); 03-04 T3 (`dashboard.spec.ts` banners) | 1, 2 | delivered |
| DATA-04 / SC3 (greyed sections) | 03-02 T1; 03-04 T2 (sections, skeleton); 03-05 T2 (muted accessible names) | 1, 2, 3 | delivered |
| SC4a (states, notice slot) | 03-03 T1-T2 (`ingest-client.test.ts`); 03-06 T1 and T3 (`dashboard.spec.ts` state matrix) | 1, 3 | delivered |
| SC4b (return visit) | 03-06 T3; 03-07 T2 (`persistent-dataset.spec.ts`) | 3, 4 | delivered, proof shape changed |
| D-01 / D-05 (nav, scroll-spy) | 03-02 T3 (`scroll-spy.test.ts`); 03-05 T1-T2 (`scroll-nav.spec.ts`) | 1, 3 | delivered |
| UI-SPEC backstops (375px, long text) | 03-05 T2; 03-06 T3 (phone-375 bar) | 3 | delivered in Chromium |
| Focus management | 03-06 T2 | 3 | delivered |
| Standing guards | every e2e gate runs `zero-network.spec.ts`; 03-07 T3 runs the full suite | 2 to 4 | delivered |
| Copy | 03-02 T1-T2 (`ui-copy.test.ts`); retirement in 03-07 T3 | 1, 4 | delivered |

Every task in all seven plans carries an `<automated>` verify block — 19 tasks,
20 automated commands (03-07 T3 has two: the full suite and the skill-driver
smoke), no task without one. Two `<human-check>` blocks sit on 03-05 T2 and are
reproduced below.

---

## Wave 0 Requirements

- [x] `tests/unit/dashboard-status.test.ts` — DATA-03, DATA-04
- [x] `tests/unit/identity.test.ts` — IDENTITY-01 (strip variants: BOM, padded/duplicate/lowercase headers, `__parsed_extra`)
- [x] `tests/unit/scroll-spy.test.ts` — pure band-rule function
- [x] Extend `db.test.ts` (v2 upgrade, identity persistence), `ingest-worker.test.ts` (identity, no-leak), `ingest-client.test.ts` (displayed-result fixes), `ui-copy.test.ts`
- [x] `tests/fixtures/export-fixtures.ts` additions: `buildMissingUserInfoExport`, `buildMissingPaymentHistoryExport`, `buildZeroRowPaymentExport`, `buildOnlySupportedExport`, `buildMultiRowAccountInfoExport`, `buildAccountInfoVariantExport`, `buildLowercaseUserInfoFolderExport`, `buildCaseVariantFoldersExport`, `buildEmptyAccountInfoExport`, `buildLongTextExport`, `buildCustomExport`
- [x] `tests/e2e/dashboard.spec.ts`, `identity-privacy.spec.ts`, `scroll-nav.spec.ts`; rewrite affected assertions in `import-flow`, `persistent-dataset`, `import-failure`, `zero-network`
- [x] Update `.claude/skills/run-data-export-viewer/driver.mjs` and `SKILL.md`
- [x] Framework install: none (all present)

---

## Manual-Only Verifications

Chromium is the only automated browser (AGENTS.md: other browsers
best-effort). These are declared backstops in 03-05 T2 and were not automated
by design, not by omission.

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Scroll-spy `rootMargin` in Firefox and Safari | D-05 | Only Chromium is automated. The W3C text reads the percentage axis as width, so other engines may differ (RESEARCH assumption A1) | Build and preview, import a synthetic sample zip, scroll top to bottom in each engine, confirm the current-section underline follows the section in view and lands on the last link |
| Sticky nav height and focus-ring clipping at 375px with classic scrollbars | UI-SPEC `--nav-offset` | Depends on OS scrollbar style and on visual clipping that geometry assertions cannot see | In Chromium at 375px with always-visible scrollbars: confirm the nav row stays about 56px, the 3px underline and 3px focus ring are not clipped, and each section heading clears the nav after using its link |
| Skill driver smoke against the built app | 03-07 T3 second verify block | Needs a live preview server and a human-eyeballed screenshot pass | `pnpm run build && pnpm run preview`, then `node .claude/skills/run-data-export-viewer/driver.mjs`; expect no `[pageerror]` and five `screenshot ->` lines |

---

## Known Deviations

| Deviation | Impact on validation |
|-----------|----------------------|
| `persistent-dataset` (a) proof shape changed: the return visit is now proven by the co-rendered file input's empty `FileList` (`toHaveJSProperty('files.length', 0)`) rather than by the dropzone being absent | Strengthening, not a loss. The old argument is now the opposite of the D-13 contract. SC4b stays ✅ |
| 03-REVIEW found the SUMMARY frontmatter under-reports the phase (14 files listed vs 39 actually changed) | Planning metadata only. Test coverage was re-derived from the suites and the git diff for this file, not from the SUMMARYs |
| The `aria-modal` defect in `ConfirmPanel.svelte` (no backdrop, no trap, background reachable) is unfixed and untested | Outside all four success criteria and pre-existing from Phase 2; escalated in STATE.md. It is an untested defect, not an untested requirement |

---

## Validation Sign-Off

- [x] All 19 tasks across the 7 plans have an `<automated>` verify block (20 commands; 03-07 T3 carries two)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references — every checklist item delivered
- [x] No watch-mode flags anywhere in the suite config
- [x] Feedback latency < 60s — the unit tier is a ~1 s command, the e2e tier 37.5 s
- [x] `nyquist_compliant: true` set in frontmatter, at requirement granularity; the one criterion-level seam is disclosed above as S-1
- [x] Full gate re-run green on 2026-09-29: lint clean, svelte-check 0 errors / 0 warnings, tsc clean, 316/316 unit, 83/83 e2e

**Approval:** validated 2026-09-29 (post-execution audit; supersedes the planning-time draft)

---

## Validation Audit 2026-09-29

State A update. Re-derived the map from the shipped suites, the git diff and the
plan verify blocks; no test was added, modified or removed by this audit.

| Metric | Count |
|--------|-------|
| Requirements in scope (DATA-03, DATA-04, IDENTITY-01) | 3 |
| Criteria rows in the map | 12 |
| Criteria COVERED (green) | 11 |
| Criteria COVERED with a disclosed seam | 1 (SC1a → S-1) |
| Criteria MISSING | 0 |
| Criteria PARTIAL (test failing) | 0 |
| Manual-only backstops | 3 |
| Gaps found | 1 |
| Resolved by this audit | 0 (writing tests was out of scope for this run) |
| Escalated / carried forward | 1 (S-1) |

### Gate re-run (this audit)

| Check | Result |
|-------|--------|
| `pnpm run lint` | prettier + eslint clean |
| `pnpm run check` | svelte-check 0 errors, 0 warnings (app + test); tsc clean |
| `pnpm run test:unit` | 14 files, 316 passed (1.07 s) |
| `pnpm run test:e2e` | 83 passed (37.5 s), 0 flaky, build + preview via `webServer` |
| `03-VERIFICATION.md` | `passed` — 69/69 must-have truths, 4/4 success criteria |
| `03-REVIEW.md` | `pass` — 3 candidate defects found and all cleared |
| `03-SECURITY.md` | `verified` — 29 threats, `threats_open: 0` |

### Next step

S-1 is the only outstanding item. Either close it with the one-case e2e named
above, or accept it explicitly at milestone audit with the reason recorded.
Everything else in this phase is closed.
