---
phase: 03-dashboard-shell-account-identity
plan: 03-07
type: execute
status: complete
wave: 3
depends_on: [03-04, 03-05, 03-06]
files_changed:
  - tests/e2e/import-flow.spec.ts
  - tests/e2e/persistent-dataset.spec.ts
  - tests/e2e/import-failure.spec.ts
  - src/lib/ui-copy.ts
  - tests/unit/ui-copy.test.ts
  - .claude/skills/run-data-export-viewer/driver.mjs
  - .claude/skills/run-data-export-viewer/SKILL.md
key_files:
  - tests/e2e/import-flow.spec.ts
  - tests/e2e/persistent-dataset.spec.ts
  - tests/e2e/import-failure.spec.ts
  - src/lib/ui-copy.ts
  - .claude/skills/run-data-export-viewer/driver.mjs
decisions:
  - "Kept the single page.evaluate busy snapshot in import-flow (a): splitting it races the transition on a fast runner, and D-26 only changed WHERE the status and spinner live, not how many reads the snapshot takes."
  - "Expressed 'no identity was ever loaded' as identity-nickname count 0 PLUS import-bar[data-variant=full], not as one of the two, because either alone is satisfiable by a regression in the other."
  - "persistent-dataset (a)'s no-re-upload proof became the co-rendered input's empty FileList, not an absent dropzone: the co-render is the D-13 replace-on-drop contract, so an absent-dropzone assertion would have asserted the opposite of what the app must do."
  - "Deleted formatSummary and formatAccountHeading only after the specs stopped importing them, letting pnpm run check rather than a text search be the gate."
  - "Renamed three import-failure test titles that said 'shows the heading' / 'no Account heading' — a test name asserting a retired hook is the same stale contract the plan exists to remove."
requirements_satisfied:
  - SC3
  - SC4
requirements_partial: []
requirements_deferred: []
success_criteria_met:
  - "Every e2e spec passes against the dashboard; no retired hook remains anywhere in tests, source or the skill."
  - "Start over confirmation, one-worker, zero-network, no-dialog, generic-failure and no-auto-dismiss guarantees are still asserted."
  - "Retired formatters are deleted with their tests; the skill driver and SKILL.md match the new UI."
  - "Lint, type-check, unit and e2e suites are green."
verification:
  - "pnpm run lint -> exit 0 (prettier --check . && eslint .)"
  - "pnpm run check -> exit 0 (svelte-check app/tsc node/svelte-check test)"
  - "pnpm run test:unit -> 14 files, 316 tests passed"
  - "pnpm run test:e2e -> 83 passed, 0 failed (was 63 passed / 20 failed)"
  - "driver smoke run -> exit 0, six 'screenshot ->' lines, no [pageerror]"
  - "grep -rn --exclude=dashboard.spec.ts -e account-heading -e summary-line -e category-badge -e badge-skipped-count tests src .claude/skills -> empty"
  - "grep -rn --exclude=dashboard.spec.ts \"getByTestId('results')\" tests -> empty"
  - "grep -c 'level: 2' tests/e2e/import-failure.spec.ts -> 0"
  - "git diff --quiet 9558a26 -- package.json pnpm-lock.yaml -> exit 0"
---

# 03-07 Summary — Legacy e2e rewrite, formatter retirement, skill update

## What was built

The phase closed with 20 red e2e tests: the three specs written in Phase 2
still asserted markup that Plans 03-04 to 03-06 replaced. This plan
re-pointed every one of them at the hook that now carries the same
guarantee, retired the two copy formatters that existed only to serve the
old markup, and updated the `run-data-export-viewer` skill so it drives
the real dashboard instead of failing silently against it.

Nothing was deleted to make a suite green. Each retired hook has a
named successor and, where the old assertion was doing real work, a
comment recording what moved and why.

## Task 1 — `import-flow.spec.ts` (tracer, RED first)

RED was recorded before any edit: 20 failed / 5 passed across the three
legacy specs, every failure a `getByTestId('results')` timeout — the
wrapper no longer exists.

| Retired hook | Re-pointed at |
|---|---|
| `results` | `import-bar[data-variant="slim"]` / `[data-variant="full"]` |
| `account-heading` | `identity-account-id` with `formatAccountId(root)`, plus `identity-nickname` and `identity-header[data-variant="loaded"]` |
| `summary-line` | `section-summary` in each of the four `dashboard-section-*` cards, text built by the app's own `formatImportSummary` |
| `category-badge` (8, order + text) | the four section cards in D-02 order (asserted by strictly increasing bounding-box `y`) plus the four `unsupported-banner` cards in `SAMPLE_BADGE_ORDER.slice(4)` order with their `data-status` |
| processing text + spinner inside the dropzone | the same elements read from inside `notice-slot` (D-26) |

Test (e) and (h) now click `start-over` and then `confirm-commit`. The old
sequence assumed Start over cleared directly; D-15/D-16 ended that, and
under the drop-during-confirm rule the old sequence would have hung in
`confirm-pending`.

Preserved deliberately: the single `page.evaluate` busy snapshot in (a)
(splitting it races the transition — the comment explaining why stays);
`STAGE_PATTERN`; the `beforeEach` worker-ready wait; the one-worker and
zero-post-baseline-request guarantees in (e); the 1000 ms long-task
threshold in (f); both negative leak assertions in (g) and the
account-ID sanity check.

## Task 2 — `persistent-dataset.spec.ts`

Seven of eight tests were red. The local `expectedBadgeText` helper,
which hand-built `"{n} file{s}, {m} row{s}"`, is replaced by
`expectedSectionSummary`, which calls `formatImportSummary` — the same
function the component uses, so test and app cannot drift.

- (a) captures `imported-at`, the four `section-summary` texts and the
  banner texts before the reload and compares all three after it. The
  "no re-upload" proof changed shape: the old comment argued the dropzone
  is absent once results show, but the co-render is the D-13 contract
  (asserted in import-flow (a)), so the proof is now the co-rendered
  input's empty `FileList` via `toHaveJSProperty('files.length', 0)`.
- (b) asserts the full-variant bar, the skeleton header, `identity-nickname`
  count 0 and `identity-account-id` count 0.
- (a-skip) asserts the Bans banner's `skip-tag` reads `1 row skipped`, a
  page-wide `skip-tag` count of exactly 1, and a per-section count of 0 —
  before and after reload.
- (c) keeps the 1000 ms long-task threshold and the per-category progress
  observer, which now reads `processing-status` from inside `notice-slot`;
  the activity `section-summary` carries `10,000 rows`.
- (d) asserts the D-13 copy and label pair, the old account-ID line still
  visible behind the panel, cancel keeping it, and confirm swapping to the
  renamed root with five banners.
- (e) and (f) keep the confirm copy and label pairs, `cleared-ack`, the
  skeleton header, the enabled dropzone and `persistent-bar` count 0.
- (g) keeps the zero-native-dialog listener across all three flows.

## Task 3 — `import-failure.spec.ts`, formatters, skill

The skeleton renders six `<h2>`, so "no level-2 heading" stopped being a
signal that nothing loaded. Tests a, e and j assert `identity-nickname`
count 0 **plus** `import-bar[data-variant="full"]`; tests f, h and i
assert `identity-nickname` has the text `SAMPLE_NICKNAME`. Test (a) also
asserts the failure banner is nested inside `notice-slot`. The
zero-links-and-buttons check, both console-cause checks, the 1500 ms
no-auto-dismiss wait and the stray-drop test are unchanged in substance.

`formatSummary` and `formatAccountHeading` were deleted from
`src/lib/ui-copy.ts` with their doc comments, the now-unused
`CategoryStatus` type import, and the stale comment claiming they were
still pending this plan. Their test blocks and the `CategoryStatus`
coverage block went with them; `pnpm run check` is the gate that proved no
importer remained.

The skill driver waits for the identity nickname, logs the nickname, the
account-ID line and the section/banner counts, names the dashboard
screenshot `03-dashboard.png`, and walks Start over through its
confirmation. `SKILL.md`'s description, step list, screenshot names and
human-path sentence describe the dashboard, and the stale hard-coded test
counts became wording that will not go stale. Run, build and gotcha
procedures are untouched.

## Preserved guarantees, and how each was re-pointed

| Guarantee | Where it now lives |
|---|---|
| Zero network after load | import-flow (e) request counter unchanged; `zero-network.spec.ts` untouched and green |
| Exactly one worker | import-flow (e) `workerUrls` length 1, unchanged |
| No native dialogs | persistent-dataset (g) `page.on('dialog')` listener, unchanged in substance |
| Generic failure copy | import-failure (a)–(d) `toHaveText(GENERIC_FAILURE_MESSAGE)` plus the new in-slot assertion, unchanged |
| No auto-dismiss | import-failure (g) 1500 ms wait, unchanged |
| Start over confirms | persistent-dataset (e) and dashboard.spec.ts `(shared-copy)`, unchanged; import-flow (e)/(h) now confirm too |
| Long-task threshold | import-flow (f) and persistent-dataset (c), both 1000 ms, unchanged |

## Deviations

Three test titles in `import-failure.spec.ts` said "shows the heading" or
"no Account heading appears". The plan authorised updating stale
*comments*; titles were treated the same way, because a test name
asserting a retired hook is the same stale contract the plan exists to
remove, and leaving it would have put a false claim in the suite's
readable output. The letters, counts and order are unchanged.

## Notes for the verifier

- `tests/e2e/dashboard.spec.ts` is excluded from the retired-hook grep by
  design: its retired-hooks test intentionally names those strings and
  asserts count 0.
- The e2e suite is now fast again (38 s). Before this plan the 20 failing
  specs each burned a 30 s timeout, which is why the red suite took
  minutes.
- `SAMPLE_EXPECTED_COUNTS` and `RENAMED_EXPECTED_COUNTS` remain in
  `tests/fixtures/export-fixtures.ts`. They are fixture data, not the
  retired formatters, and the specs no longer use them; removing them was
  outside this plan's scope.
