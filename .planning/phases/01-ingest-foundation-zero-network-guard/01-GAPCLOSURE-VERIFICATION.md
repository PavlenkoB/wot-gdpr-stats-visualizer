---
phase: 01-ingest-foundation-zero-network-guard
status: passed
verified: 2026-09-30T17:17:00Z
verifier: independent verifier agent (orchestrator-dispatched)
run_type: gap-closure
---

# Phase 01 verification (gap closure of the 2026-09-28 advisory review)

The phase was previously implemented by plans 01-01..01-06. The 2026-09-28
`01-REVIEW.md` raised 11 advisory findings; plans 01-07..01-10 (`gap_closure:
true`) closed them, and this document verifies the closure.

## Success Criteria

**1. Root detected, categories 3-way sorted, no fixed layout assumed — MET**

The real `analyzeExport` plus the verbatim `unzipSync` filter from
`ingest.worker.ts:150-155` was executed against real zip bytes built with
`fflate.zipSync` and against the repo's own fixtures. All nine required shapes
agree — `resolveCsvFileCategory(p, outcome.accountRoot, recognized) !== null`
exactly for the entries whose category `analyzeExport` reported:

| Shape | `accountRoot` | Inflated |
|---|---|---|
| `personal_data_export/Activity_history/foo.csv` (CR-01) | `""` | 1/1 |
| `Downloads/personal_data_export/Activity_history/a.csv` | `""` | 1/1 |
| `Personal_Data_Export/Activity_history/a.csv` (case variant) | `""` | 1/1 |
| `WrapperName/1234567/Activity_history/a.csv` | `1234567` | 2/2 |
| `123456789/Activity_history/a.csv` | `123456789` | 1/1 |
| `Activity_history/a.csv` (true rootless) | `""` | 1/1 |
| `Activity_history/a.csv` + `Payment_history/b.csv` | `""` | 2/2 |
| `renamed-root-2026/Activity_history/a.csv` | `renamed-root-2026` | 2/2 |
| `foo.csv` | — | `no-single-root` (correctly fails) |

Fixture bytes: `buildSampleExport` 12/12, `buildRenamedRootExport` 14/14,
`buildWrapperExport` 12/12, `buildRootlessExport` 12/12.
Evidence: `src/lib/worker/classify.ts:268-305`, `:443-516`,
`src/lib/worker/ingest.worker.ts:150-155`, `src/lib/worker/categories.ts:11-22`.

**2. Non-zip / corrupt / unrecognized → one generic failure state, re-drop
immediately — MET (code) / browser behaviour UNVERIFIED-BY-ENVIRONMENT**

One copy, one path: `GENERIC_FAILURE_MESSAGE` (`src/lib/ui-copy.ts:10-11`),
assigned only at `src/lib/worker-client.svelte.ts:648` (`#fail`). Every source
— pre-check, broken worker, worker error, `onerror`, `onmessageerror` — routes
through it. Re-drop is immediate because `#fail` leaves `state` non-`'processing'`,
so `busy` is false and the dropzone re-enables. Named reasons preserved
(`no-recognized-category`, `no-single-root`, `empty-archive`).

**3. Dropzone disabled while processing, single Worker, typed contract — MET
(code) / responsiveness UNVERIFIED-BY-ENVIRONMENT**

`App.svelte:239` → `ImportBar.svelte:126` → `Dropzone.svelte:126`, plus
`onchange`/drag guards and `aria-disabled`/`aria-busy`. Exactly one
`new Worker(` site in `src/` (`src/lib/ingest-client.ts:26`), one
`new IngestClient` at module scope — the worker spawns at app init, not per
upload. All traffic typed `IngestRequest`/`IngestResponse`. The
page-stays-responsive half is asserted only by Playwright
(`tests/e2e/import-flow.spec.ts`, 20,000-entry export), which cannot run here.

**4. CI gates + zero-network Playwright + CSP meta — CI and CSP MET;
Playwright half UNVERIFIED-BY-ENVIRONMENT**

`.github/workflows/ci.yml` runs lint, typecheck, unit, and Playwright.
`tests/e2e/zero-network.spec.ts` is sound on reading: `context.on('request')` +
`page.on('worker')`, baseline taken only after `networkidle`, exactly one worker
URL, every URL same-origin, then `postSubmitCount === baselineCount` after the
drop. CSP meta asserted at `:72-83`. Source-level, `vite.config.ts:53-70` emits
the tag as a literal string in one `transformIndexHtml` hook — no
`unescapeQuotes` plugin and no registration-order tie remains.

**Correction to the prior report:** the workflow is `runs-on: self-hosted`,
`timeout-minutes: 10`, e2e as `pnpm exec timeout 10m playwright test`. The prior
`01-VERIFICATION.md` claimed `ubuntu-latest` / 20 min / bare `pnpm run test:e2e`.
The file is unchanged since the phase-1 merge commit `9689001`, so the prior
report's CI description is stale, not a regression from this run.

## The `42aeef5` fix — VERIFIED HOLDS

The pre-fix `classify.ts` from `42aeef5^` was imported out-of-tree and run
side-by-side with the current one:

```
PRE  personal_data_export/Activity_history/foo.csv            accountRoot=""  inflated=[]
POST personal_data_export/Activity_history/foo.csv            accountRoot=""  inflated=1
PRE  Downloads/personal_data_export/Activity_history/a.csv   accountRoot=""  inflated=[]
POST Downloads/personal_data_export/Activity_history/a.csv   accountRoot=""  inflated=1
PRE  Personal_Data_Export/Activity_history/a.csv             accountRoot=""  inflated=[]
POST Personal_Data_Export/Activity_history/a.csv             accountRoot=""  inflated=1
     Activity_history/a.csv, 123456789/Activity_history/a.csv    unchanged, still correct
```

`resolveCsvFileCategory` now scans for the first segment that is itself a
recognized category and treats everything above it as transparent prefix
(`classify.ts`), instead of blindly taking segment 0. Verified against real zip
bytes, not just path strings.

**No pre-existing test broken:** 339/339 unit tests pass (15/15 files, exit 0).

**The two new tests are genuinely load-bearing, not tautological.** Mutation
test: the repo was copied out-of-tree, `classify.ts` reverted to the buggy
`42aeef5^` version, and `classify.test.ts` re-run — **2 failed | 51 passed**,
the new tests failing with `expected [] to deeply equal
[ "personal_data_export/Activity_history/foo.csv" ]` while all 51 pre-existing
tests still pass. A tautological test would have survived the mutation.

## Gap Closures

| ID | Verdict | Code evidence |
|---|---|---|
| CR-01 | CLOSED | `classify.ts` `EXPORT_WRAPPER_FOLDER` / `isTransparentWrapper`; returns `''` for a transparent wrapper directly above categories; consumer agreement restored in `resolveCsvFileCategory` |
| WR-01 | CLOSED | `worker-client.svelte.ts` sets `#workerBroken = true` on *every* `onerror`, before the state branches; fail-fast guard runs before the pre-check; test in `ingest-client.test.ts` |
| WR-02 | CLOSED | `vite.config.ts` — one `cspMeta` plugin, tag serialized as a literal; no `unescapeQuotes`, no order tie |
| WR-03 | CLOSED | `classify.ts` — `categoryFoldersUnder` delegates to `foldersAt`; the old `"/"`-prefix build that matched nothing is gone |
| WR-04 | CLOSED | `package.json` `"check": "tsc -b"`; `tsconfig.json` carries the project references (see window #4 for a side effect) |
| WR-05 | CLOSED | `playwright.config.ts` invokes the vite binary directly; `webserver-teardown.test.ts` is the guard; the stale Gotcha is reduced to a cross-reference |
| WR-06 | CLOSED | `classify.ts` — the rootless `foldersAt('')` read runs first, so an exhausted wrapper retry can no longer pre-empt it |
| IN-01 | CLOSED | `tsconfig.app.json` — `"verbatimModuleSyntax": true`, explicitly declared with rationale |
| IN-02 | CLOSED | `tsconfig.app.json` — `checkJs` gone; `allowJs: true` retained with a comment explaining that `.svelte` files embed JS |
| IN-03 | CLOSED | `driver.mjs` — one comment line above `chromium.launch({ args: ['--no-sandbox'] })`; the flag itself is unchanged |
| IN-04 | CLOSED | `README.md` — states the dev server applies no CSP meta tag and that the zero-network assertion covers build/preview, not dev |
| IN-05 | CLOSED | `svelte.config.js` — annotated with rationale; `export default {}` retained deliberately |

## Requirements Trace

| ID | REQUIREMENTS.md | Satisfied at |
|---|---|---|
| IMPORT-02 | line 11 | the resolver in `classify.ts` — rootless-first, bounded wrapper descent, name-anchored wrapper allow-list; verified on renamed-root, wrapper, rootless, case-variant, backslash and macOS-noise shapes |
| IMPORT-05 | line 14 | `ui-copy.ts` single copy; `worker-client.svelte.ts` single assignment; four named reasons; all five failure fixtures keep their exact reasons |
| PLATFORM-02 | line 51 | `tests/e2e/zero-network.spec.ts`; `vite.config.ts`; the CI e2e step; the ESLint source-level network ban |

All three IDs appear in `ROADMAP.md` for this phase, in the Traceability table
as Phase 1 / Complete, and in plan frontmatter.

**Bookkeeping drift (pre-existing, not from this run):** the checkboxes for
IMPORT-02 (line 11) and PLATFORM-02 (line 51) are still `- [ ]` while their own
Traceability rows say Complete. `REQUIREMENTS.md` was not touched by this run.

## Findings by severity

No blocking findings. The critical fix holds.

**Low — stale docstring inside the fixed function.** The numbered rules above
`resolveCsvFileCategory` still described "use the full normalized path when
`root === ''`" and "take the first remaining path segment as the category",
both inaccurate for the transparent-wrapper case. **Fixed in this run** — the
rules now state the first-recognized-category-segment rule and why it exists.

**Low — ROADMAP plan checkboxes not updated.** `ROADMAP.md` still read
"6/6 plans complete" with 01-07..01-10 unchecked. **Fixed in this run** — now
10/10 with all four checked.

**Info — three property-test cases report a category that inflates zero rows**
(`['Payment_history/invoice.pdf']`, or a real export mixed with unknown
sub-folders). Re-run against `42aeef5^`: byte-identical pre- and post-fix. This
is the already-logged WINDOWS #3, not new.

**Info — the prior `01-VERIFICATION.md` misdescribes CI** (`ubuntu-latest`/20
min vs actual `self-hosted`/10 min). Stale prior report.

## Open windows

All four are real, already logged in `.planning/WINDOWS.md`, and none blocks the
phase goal: #1 unrun-verify for 01-09's e2e; #2 the WR-01 guard not covering
the `requestStartOver`/`requestClearData` confirm routes; #3 rootless-first
widening the accept surface; #4 `tsc -b` placing 0 of 11 `.svelte` files in the
CI type-check program.

## human_verification

1. **Run `pnpm run test:e2e` on a normal machine or CI runner.** Highest-value
   single action: it closes the Playwright half of criterion 4, the
   responsiveness half of criterion 3, and the browser half of criterion 2.
2. **Drop a real 2021 Wargaming export in a real browser** and confirm the
   dashboard populates with actual data. The CR-01 fix is verified at the
   module level and through real zip bytes, but the rendered result was never
   observed.
3. **Confirm the self-hosted CI runner is registered and healthy.**
   `runs-on: self-hosted` means the entire phase-1 gate — including the
   zero-network assertion — is dark if no runner is online.

## Unverified

- ~~All 83 Playwright e2e specs~~ — **RESOLVED 2026-09-30.** Run on a normal
  machine outside the agent sandbox: **`86 passed (40.1s)`**, including both
  `tests/e2e/zero-network.spec.ts` specs (the post-load network assertion and
  the CSP meta assertion). This closes the Playwright half of criterion 4 and
  WINDOWS #1. See "Post-verification addendum" below for what it changed.
- ~~Browser-observed rendering~~ — **RESOLVED 2026-09-30** (see human-verification
  item 2). Real rows render in a real browser: 4,276 in `Activity_history`, 476
  in `Player_statistics`, Account ID 1234567 extracted. The limit: that is the
  wrapper-around-account shape, not the transparent-wrapper shape `42aeef5`
  repaired, so that specific path remains covered only by its unit guard.
- Actual CI execution on a push — the workflow was read, and the maintainer
  attests the self-hosted runner is online, but no run record could be read from
  this environment (private repo, no `gh`).

---

# Post-verification addendum (2026-09-30, after the human e2e run)

The maintainer ran `pnpm run test:e2e` on a normal machine: **86 passed
(40.1s)**. Consequences for this report:

1. **Criterion 4 is now fully MET, not partially unverified.** The Playwright
   half — the zero-network assertion that fails the build on any post-load
   request, including the worker script fetch, plus the CSP meta assertion — is
   now executed and green, not merely read. PLATFORM-02 is verified end to end.
2. **The e2e suite is blind to the Critical this run fixed, which is the more
   interesting fact.** All 86 specs passed *before and after* `42aeef5` and
   caught the empty-dashboard regression neither time. No spec uses
   `buildWrapperExport`, and the wrapper-above-categories shape has no fixture.
   The unit-level guard added in `42aeef5` is currently the only thing standing
   between that regression and a shipped release. Follow-up: add an e2e spec (or
   a `buildTransparentWrapperExport` fixture) so the real import path is covered.
3. **A count correction in the review is overturned.** The post-gap-closure
   review noted that `README.md` claimed 86 e2e tests while the source contains
   83 `test()` definitions, and treated the README figure as wrong. The real run
   is **86 passed**, and `playwright test --list` reports "Total: 86 tests in 7
   files". Three tests are generated at collection time and so are not visible
   to a static count of `test()` calls. **The README value of 86 is correct; the
   83 figure was the error.** No README change was made, which is why it
   remained correct.
4. **The "browser half of criterion 2" and the responsiveness half of criterion 3
   remain inferred rather than observed.** The suite is green, but it did not
   specifically assert a real Wargaming export rendering with non-zero rows in a
   real browser. That is the same coverage hole as point 2.

## human_verification — status after the run

1. ~~Run `pnpm run test:e2e` on a normal machine or CI runner.~~ **DONE — 86
   passed (40.1s), including both zero-network specs.**
2. ~~Drop a real 2021 Wargaming export in a real browser and confirm the
   dashboard populates with actual rows.~~ **DONE — maintainer-attested
   2026-09-30, with a screenshot.** The rendered dashboard shows a non-empty
   import: account `PLAYER`, an EU region, account created 2015-05-06, **Account ID
   1234567**, and category tabs `Activity_history` (4 files, **3,910 rows**),
   `Player_statistics` (20 files, **476 rows**), `Payment_history`,
   `User_Info`, and a "Not yet supported" tab. Non-zero row counts in a real
   browser confirm the end-to-end import path, and the extracted Account ID
   confirms identity extraction.

   **Scope limit worth recording.** The imported export resolved to an
   account id of `1234567`, i.e. the **wrapper-around-account** shape
   (`WrapperName/1234567/Activity_history/...`, the G-01-20 shape). That path
   was already working and is not the shape `42aeef5` fixed. The
   **transparent-wrapper** shape this run actually repaired
   (`personal_data_export/Activity_history/foo.csv`, which resolves to
   `accountRoot: ''`) was **not** exercised by this run and still has no e2e
   fixture. The fix is verified at the module and real-zip-byte level only. This
   is the same coverage gap recorded in the addendum's point 2, and it is why the
   follow-up fixture is still recommended.

   The screenshot contains real account identity data, so it was reviewed and
   **not committed** to the repository — consistent with the fixture PII policy
   established in plan 01-01.
3. ~~Confirm the self-hosted CI runner is registered and healthy.~~ **DONE —
   maintainer-attested 2026-09-30 ("self-hosted CI runner is online").** Recorded
   as an owner attestation, not an independently observed fact: the repository is
   private, so the Actions API returns 404 unauthenticated and `gh` is not
   available in the agent sandbox, so no run record could be read from here.
   The substantive risk this item covered — the phase-1 gate, including the
   now-verified zero-network assertion, silently not executing because no
   runner was registered — is reported resolved by the maintainer.

---

_Verified: 2026-09-30T17:17:00Z — addendum 2026-09-30 after the human e2e run_
