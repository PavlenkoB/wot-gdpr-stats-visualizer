---
phase: 01-ingest-foundation-zero-network-guard
reviewed: 2026-10-10T00:00:00Z
depth: standard
files_reviewed: 40
files_reviewed_list:
  - .claude/skills/run-data-export-viewer/driver.mjs
  - .github/workflows/ci.yml
  - .gitignore
  - README.md
  - eslint.config.js
  - index.html
  - package.json
  - playwright.config.ts
  - src/App.svelte
  - src/app.css
  - src/lib/core/types/worker-messages.ts
  - src/lib/import/ingest-client.ts
  - src/lib/import/precheck.ts
  - src/lib/import/worker-client.svelte.ts
  - src/lib/shell/Dropzone.svelte
  - src/lib/shell/FailureBanner.svelte
  - src/lib/ui-copy.ts
  - src/lib/worker/categories.ts
  - src/lib/worker/classify.ts
  - src/lib/worker/ingest.worker.ts
  - src/lib/worker/zip-paths.ts
  - src/main.ts
  - svelte.config.js
  - tests/e2e/_support/helpers.ts
  - tests/e2e/guards/zero-network.spec.ts
  - tests/e2e/import/import-failure.spec.ts
  - tests/e2e/import/import-flow.spec.ts
  - tests/fixtures/export-fixtures.ts
  - tests/unit/guards/lint-guards.test.ts
  - tests/unit/import/classify.test.ts
  - tests/unit/import/ingest-client.test.ts
  - tests/unit/import/zip-paths.test.ts
  - tests/unit/setup.ts
  - tests/unit/shell/ui-copy.test.ts
  - tsconfig.app.json
  - tsconfig.json
  - tsconfig.node.json
  - tsconfig.test.json
  - vite.config.ts
  - vitest.config.ts
findings:
  critical: 1
  warning: 10
  info: 10
  total: 21
status: issues_found
---

# Phase 1: Code Review Report

**Reviewed:** 2026-10-10
**Depth:** standard
**Files Reviewed:** 40 (see the scope note for depth)
**Status:** issues_found

## Summary

Scope: Phase 1 concerns only (zip ingest, classification, worker lifecycle, zero-network guarantee, CSP, lint guards), as the caller asked. Later-phase code reached through these files (playtime / data-query / city-load handlers in `ingest.worker.ts`, most of `ui-copy.ts`, `app.css`, the second half of `import-flow.spec.ts` and `ingest-client.test.ts`) was skimmed, not audited. `tests/fixtures/export-fixtures.ts` was read through the sample/trap builders only.

`src/lib/worker/classify.ts` carries an uncommitted working-tree edit. It is comment-only (`T-01-18` -> `T-01-32` in the `MAX_WRAPPER_DEPTH` docblock), so it does not affect behaviour.

Several claims below were verified by running the real modules (classify/identity under Node, and ESLint's Node API against the repo's `eslint.config.js`), not just by reading.

Headline result: the zero-network posture itself is sound (CSP meta is correctly built and injected, the Playwright request counting is real). The weaker points are (1) a classification-precedence bug that routes a real account folder around the D-18 `User_Info` strip, (2) lint guard globs and scopes that leave real holes, and (3) a state machine with no recovery path for a worker that dies after `ready`.

No structural (fallow) findings were supplied.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Rootless-first precedence misfiles the real account folder and bypasses the D-18 `User_Info` strip

**File:** `src/lib/worker/classify.ts:275-279` (cause), `src/lib/worker/classify.ts:499-529` (consequence), `src/lib/worker/ingest.worker.ts:795,859` (what is skipped)
**Issue:** `resolveAccountRootAndCategories` runs the "rootless read" first and accepts it as soon as ANY top-level folder classifies as recognized (`hasRecognizedCategory(counts0)`). It does not check that the other top-level folders are not the real account root. Verified with the real modules:

```
analyzeExport(['123/User_Info/Account_Info.csv', '123/Activity_history/a.csv', 'Clans/b.csv'])
-> ok: true, accountRoot: '', categories: [Clans (known-deferred), 123 (unknown, fileCount 2)]
resolveCsvFileCategory('123/User_Info/Account_Info.csv', '', recognized)
-> { category: '123', sourceFile: 'User_Info/Account_Info.csv' }
isUserInfoCategory('123') -> false
```

The `123` folder is reported as an `unknown` category, so the account folder's `User_Info/Account_Info.csv` is parsed under category `'123'`. In the worker, `isUserInfoCategory(entry.name)` is false for that category, so `sanitizeUserInfoRow` never runs and `LOGIN` (email), `BIRTH_DATE` and `BIRTH_DATE_SRC` are written to IndexedDB. That is exactly what D-18 says must never be persisted. The identity pick also finds no User_Info rows, so the header falls back to "Unknown account". The import reports success, so nothing signals that the strip was skipped.

The trigger is a zip with a recognized-named folder beside the account folder. That is unusual, but the outcome is a silent privacy-guarantee bypass on a tool whose entire purpose is that guarantee, and the strip is keyed on a folder name that this precedence rule can change.

**Fix:** Two layers.

1. Make the rootless read fail closed on ambiguity. If any top-level folder that is NOT itself a recognized category holds a recognized category one level beneath it, there is a real account root next to the stray folder, and the importer must not guess (`detectRoot` returns `null` for this shape because there are two top-level segments, so it cannot be reused as the test):
```ts
// Strategy 1: rootless read, unless a non-category top-level folder is itself a root.
const counts0 = foldersAt('', prepared);
if (hasRecognizedCategory(counts0)) {
  const ambiguous = [...counts0.keys()].some(
    (top) =>
      classifyFolder(top) === 'unknown' &&
      hasRecognizedCategory(categoryFoldersUnder(top, prepared)),
  );
  if (ambiguous) return null; // analyzeExport's named-reason chain then fails closed
  return { root: '', counts: counts0 };
}
```
2. Defence in depth in the worker: apply the column strip by column name for every parsed row, not by folder name. `DROPPED_COLUMN` in `identity.ts:50` already matches by header, so calling `sanitizeUserInfoRow` unconditionally (or at least on any row that has such a column) removes the dependency on classification being right.

Add a regression test next to the existing priority-inversion block in `tests/unit/import/classify.test.ts` using the three-path shape above, and a worker-level assertion that `LOGIN` is absent from stored rows.

## Warnings

### WR-01: Lint guard globs cover only `.ts` / `.svelte`; a `.js` / `.mjs` / `.cjs` file under `src/` gets no network ban at all

**File:** `eslint.config.js:189`, `eslint.config.js:227`, `eslint.config.js:273`
**Issue:** All three guard blocks (network ban, worker escape hatches, fflate/geo import ban) use `files: ['src/**/*.ts', 'src/**/*.svelte']` (7b: `src/lib/worker/**/*.ts`). `tsconfig.app.json` sets `allowJs: true` and includes `src/**/*.js`, and Vite will bundle such a file. Verified with ESLint's API against the real config:

```
src/lib/probe.js   "fetch('/x'); new XMLHttpRequest();"  -> no errors
src/lib/probe.mjs  "fetch('/x');"                        -> only no-undef
```

`tests/unit/guards/fetch-scan.test.ts` scans `.ts|.js|.svelte` for network API names, which backstops `.js` for the names it lists, but not `.mjs`/`.cjs`, not `Worker`/`caches`, and it is a regex over source rather than a rule. The README and AGENTS.md describe the ESLint ban as the enforcement mechanism, so the lint layer should not depend on a convention that "there are no `.js` files in `src/`" (stated only in a `tsconfig.app.json` comment).
**Fix:** Widen all three globs and add probes:
```js
const SRC_CODE = ['src/**/*.{ts,mts,cts,js,mjs,cjs}', 'src/**/*.svelte'];
// blocks 7 and 8: files: SRC_CODE
// block 7b:       files: ['src/lib/worker/**/*.{ts,mts,cts,js,mjs,cjs}']
```
and add `src/lib/__lint_probe__.js` / `.mjs` cases to `tests/unit/guards/lint-guards.test.ts`.

### WR-02: Worker-escape and extra network-adjacent bans are scoped by directory, but the worker also executes code from other directories

**File:** `eslint.config.js:226-248` (block 7b), `eslint.config.js:191-192` (block 7)
**Issue:** Block 7b bans `Worker`, `SharedWorker` and `caches` only under `src/lib/worker/**`. The worker bundle also runs modules from `src/lib/features/**` (playtime/login aggregators, `ingest.worker.ts:24-42`), `src/lib/geo/**` and `src/lib/core/**`. The comment says the meta CSP is blind to worker traffic, so lint is the only guard there, yet `Cache.add(url)` or a Blob-URL nested worker written in `src/lib/geo/city-table.ts` or a feature module passes. Verified:

```
src/lib/features/logins/probe.ts  "new Worker('x'); caches.open('x');"      -> no errors
src/lib/geo/probe.ts              "caches.open('x'); new SharedWorker('y');" -> no errors
```

Separately, block 7 is a name denylist and does not list other request-issuing main-thread APIs. Verified: `new Image().src = '/leak?d=' + 1; window.open('/x'); location.href = '/y'; document.createElement('img')` raises nothing, and `const f = self; f.fetch('/x')` is not caught either. A same-origin image beacon is still a request to the host with data in the query string, and `default-src 'self'` does not stop it. The Playwright counting catches it only on flows the specs happen to exercise.
**Fix:** Ban `Worker`, `SharedWorker`, `caches` and `navigator.serviceWorker` for all of `src/**` and exempt exactly `src/lib/import/ingest-client.ts` (the one legitimate `new Worker`), mirroring how `city-fetch.ts` is exempted. Add `Image`, `Audio`, `open`, `location` assignments to block 7 or, better, add a `no-restricted-syntax` selector for `AssignmentExpression[left.property.name=/^(src|href|action)$/]`. State plainly in the config header that the denylist is not exhaustive and that request counting is the real backstop, instead of "only guard".

### WR-03: Ingest inflates every matching CSV with no size cap, while `zip-paths.ts` advertises zip-bomb immunity

**File:** `src/lib/worker/ingest.worker.ts:729-734`, `src/lib/worker/zip-paths.ts:21-24`
**Issue:** `listEntryPaths` is bomb-safe because its filter returns `false`. The very next step, `unzipSync(bytes, { filter })`, returns `true` for every entry that resolves to a category CSV and does not look at `info.size` / `info.originalSize`. fflate allocates `new Uint8Array(originalSize)` from the (attacker-controlled) header and inflates into it, then the worker decodes each file to a JS string and holds every row object in `allRows`. A small archive can therefore force multi-GB allocations in the worker, which either throws mid-import or takes the renderer down (see WR-04 for what the UI does then). The docblock's "a zip-bomb is bounded by the archive's central directory" is only true of the listing step, and the city path (`inflateIfGzip`) does cap its inflate, so the codebase already knows this is needed.
**Fix:** Bound it in the filter, using the central-directory sizes before anything is allocated:
```ts
const MAX_ENTRY_BYTES = 256 * 1024 * 1024;
const MAX_TOTAL_BYTES = 1024 * 1024 * 1024;
let total = 0;
const inflated = unzipSync(bytes, {
  filter(info) {
    if (resolveCsvFileCategory(info.name, root, recognized) === null) return false;
    if (info.originalSize > MAX_ENTRY_BYTES) throw new Error('entry too large');
    total += info.originalSize;
    if (total > MAX_TOTAL_BYTES) throw new Error('archive too large');
    return true;
  },
});
```
Also soften the `zip-paths.ts` claim to say it covers enumeration only.

### WR-04: A worker that dies after `ready` leaves the app in `processing` (or hangs the next submission) forever; `#workerBroken` is never set post-ready

**File:** `src/lib/import/worker-client.svelte.ts:225-269`, `:474-496`, `:556`
**Issue:** The only place `#workerBroken` is set is the `!this.workerReady` branch of `onerror`. After `ready`, an `error` event while `processing` just schedules `#fail`, and one while idle is "informational". The worker is neither terminated nor marked broken, there is no watchdog, and no heartbeat. If the worker is actually gone (OOM, killed), the next `submitFiles` passes guards 2b and 5, posts into the void, sets `state = 'processing'`, and nothing ever settles it; `busy` keeps the dropzone disabled until a page reload. The code acknowledges this ("Reopen WR-01 if real-world idle+ready errors ever leave the busy floor stranded"), and the unit tests (`ingest-client.test.ts` "worker error while idle and ready", "is not marked broken") pin the behaviour rather than cover the hang. The comment on guard 2b (`:474-480`) claims the opposite ("set by EVERY worker error event"), so the next maintainer will read the code as safe.
**Fix:** Add a liveness check instead of trusting the event. Minimal version: remember the last message time; if `state === 'processing'` and no message (stage/done/error) arrives within N seconds, call `#fail('worker unresponsive')` and set `#workerBroken = true`. Alternative: on any `onerror` received while `processing`, set `#workerBroken = true` and surface a "reload the page" notice. Add the missing test: `ready`, `error` while processing, then `submitFiles` must fail fast. Fix the contradictory comment either way.

### WR-05: `onerror` / `onmessageerror` during `checking-cache` after `ready` leaves the spinner up with no recovery

**File:** `src/lib/import/worker-client.svelte.ts:259-268`, `:278-280`
**Issue:** Both handlers only act when `state === 'processing'` (and `onerror` additionally when `!workerReady`). With `workerReady === true` and `state === 'checking-cache'` (between the `ready` handshake and the `cache-status` reply, i.e. exactly the window in which a Dexie upgrade or open can fault), neither branch runs. The app shows `CACHE_CHECK_TEXT` indefinitely, the dropzone is never rendered (App renders it only outside `checking-cache`), and the user's only way out is a reload. The test file covers a worker `error` *message* during `checking-cache` (D-19) but not an `onerror` or `onmessageerror` *event* in that state.
**Fix:** In both handlers add a `checking-cache` branch that logs, sets `#workerBroken = true`, and moves to `idle` (or `error`) so the page is usable and the next submission fails fast with a truthful message. Add the two tests.

### WR-06: Storage and worker-crash failures are all reported as "This doesn't look like a Wargaming data export"

**File:** `src/lib/import/worker-client.svelte.ts:768-773` (`#fail`), `:717-723` (failed clear), `:686-695`
**Issue:** `#fail` unconditionally sets `GENERIC_FAILURE_MESSAGE`. The codebase itself documents that this copy "is simply false" for storage problems (`:687-694`, and the `PLAYTIME_ERROR` docblock in `ui-copy.ts:521-531`), but a Dexie `QuotaExceededError` on `writeDataset`, a failed `clear-data`, a worker `onerror` and `onmessageerror` all still land on it. A user whose browser quota is full, or whose clear failed, is told their (valid) file is not a Wargaming export, and is invited to re-download it. D-07 locks "one banner", so this is a conflict with a locked decision, but the decision was made before the persistence layer existed.
**Fix:** Keep one banner component but let the worker tag the cause (`kind: 'unrecognized' | 'storage' | 'internal'` on the `error` message) and add one more constant for the non-unrecognized case ("Your export could not be saved. Your previous data is unchanged."), selected in `#fail`. At minimum, use a storage-specific sentence for the failed-clear branch where the dataset is known to be intact.

### WR-07: `resolveCsvFileCategory` re-derives the account prefix with `lastIndexOf`, disagreeing with `analyzeExport`'s top-down descent

**File:** `src/lib/worker/classify.ts:542-550`
**Issue:** `analyzeExport` finds the root by descending from the outermost wrapper; the worker then re-resolves each entry by searching for `/<root>/` from the right. A category subfolder, or any nested folder, that shares the account id's name makes the right-hand match land inside the category:

```
resolveCsvFileCategory('Wrapper/123/Activity_history/x/123/y.csv', '123', {Activity_history}) -> null
```

The file was counted in `fileCount` by `analyzeExport` but is silently not inflated, so `rowCount` quietly disagrees with `fileCount` and nothing reports it. The doc comment above the function states the opposite invariant ("must agree with analyzeExport's own category resolution").
**Fix:** Have `analyzeExport` return the resolved full prefix (`fullRoot`, which `resolveAccountRootAndCategories` already computes at `:284-296`) as `categoryPrefix` on the result and pass that to the resolver, which then only needs `startsWith(prefix)`. This also removes the rootless-vs-transparent-wrapper special case at `:499-529`.

### WR-08: Root detection is brittle: one stray top-level file, a nested `__MACOSX`, or a `//` fails the whole import

**File:** `src/lib/worker/classify.ts:67-73`, `:102-119`
**Issue:** Verified with the real classifier:

```
['123/Activity_history/a.csv', 'README.txt']                  -> no-single-root
['123/Activity_history/a.csv', '.gitkeep']                    -> no-single-root
['Export/123/Activity_history/a.csv',
 'Export/__MACOSX/123/Activity_history/._a.csv']              -> no-recognized-category
['123//Activity_history/a.csv']                               -> no-category-folders
```

`detectRoot` counts every top-level segment, files included, so any non-metadata top-level file (a README, a license, a checksum list added when sharing) makes an otherwise valid export unrecognizable. `isOsMetadataEntry` only recognises `__MACOSX` as segment 0 (and case-sensitively), so a re-zip that nests it under a wrapper breaks the wrapper descent. Empty path segments from `//` are not collapsed. All four surface as the generic "doesn't look like a Wargaming export".
**Fix:** In `detectRoot`, count only first segments that prefix at least one longer path (ignore top-level files). In `isOsMetadataEntry`, test `__MACOSX` (case-insensitive) at any segment. In `normalizeEntryPath`, collapse `/{2,}` to `/`. Add the four cases above as unit tests.

### WR-09: CI runs every pull request on a persistent self-hosted runner

**File:** `.github/workflows/ci.yml:13`, `:27`
**Issue:** `on: pull_request` (bare, "every PR, from any branch") with `runs-on: self-hosted`. The registered runner is a persistent Linux host (`the self-hosted runner`). `pnpm install` lifecycle scripts, Vitest and Playwright all execute PR-controlled code on it, and the job restores `actions/cache` entries (`node_modules/.vite`, `.tmp`, Playwright browsers) that a PR job can also write. While the repository is private and PR authors are trusted this is acceptable; the README's publishing section makes "make the repository public" the next step (Pages on the free plan requires it), at which point a fork PR becomes arbitrary code execution on that host. The deploy job's preflight trusts the *push* run of this same workflow.
**Fix:** Before the repo goes public: run `pull_request` jobs on `ubuntu-latest` (the deploy workflow already does), or require approval for all outside collaborators, and keep self-hosted runners for `push` to `main` only. If a self-hosted runner must stay, make it ephemeral and give caches a per-ref key. State this precondition in the README's owner checklist.

### WR-10: Persistent-storage request fires at page load, with no handler for rejection

**File:** `src/lib/import/ingest-client.ts:41`
**Issue:** `void navigator.storage?.persist?.();` runs at module evaluation, i.e. on first paint, before the user has imported anything and with no user gesture. `persist()` returns a promise that can reject (and prompts the user in Firefox); `void` discards it with no `.catch`, so a rejection becomes an unhandled rejection. Asking the browser to make a not-yet-existing cache of personal data non-evictable at page load is also the wrong moment for a privacy-first tool.
**Fix:** Move the request to after the first successful import (the `done` transition), and swallow failures:
```ts
void navigator.storage?.persist?.()?.catch?.(() => {});
```

## Info

### IN-01: Stage text flips Unzipping -> Checking -> Unzipping

**File:** `src/lib/import/worker-client.svelte.ts:566`, `:390` vs `src/lib/worker/ingest.worker.ts:706`
**Issue:** The client sets `stage = 'unzipping'` at submit, but the worker's first stage is `hashing`, then `unzipping`. The notice text visibly goes "Unzipping..." -> "Checking for a duplicate..." -> "Unzipping...".
**Fix:** Initialise `stage = 'hashing'` in `submitFiles` and the replace branch of `confirmPending`.

### IN-02: `#workerBroken` comments contradict the code, and one condition is dead

**File:** `src/lib/import/worker-client.svelte.ts:474-492` (says every error event sets it) vs `:230-250` (says post-ready errors do not); `:556`
**Issue:** `#workerBroken` is only set pre-ready, so the guard at `:556` (`this.#workerBroken || !this.workerReady`) can never be true through `#workerBroken` (guard 2b at `:493` already returned). The docs describe two different behaviours.
**Fix:** Reconcile the comments with whatever WR-04 decides; reduce `:556` to `!this.workerReady`.

### IN-03: Rationale comments in the guard files contradict the measured behaviour

**File:** `eslint.config.js:9-12`, `:181-187`; `tests/unit/guards/lint-guards.test.ts:10-14`; `playwright.config.ts:3-7`
**Issue:** They state Playwright's request observation cannot see worker traffic and that lint is "the only guard". `tests/e2e/guards/zero-network.spec.ts:23-31` records that this was measured to be wrong (context-level `request` events include module-worker requests). `playwright.config.ts:3` also still says "Phase 1 has a single end-to-end spec" (there are 254 listed tests).
**Fix:** Update the three comments to match the measured model: request counting sees workers; lint is the static layer; CSP is defence in depth.

### IN-04: README test counts and Node floor are stale

**File:** `README.md:16`, `:49-50`
**Issue:** The README says 86 e2e tests and 337 unit tests; `playwright test --list` reports 254 tests in 26 files. It also states "Node 22.12+", but the `geo:*` scripts run `node scripts/geo/*.ts` directly and need Node's default type stripping (22.18+); on 22.12-22.17 they fail unless a flag is passed.
**Fix:** Drop the hard-coded counts (or generate them) and raise the stated floor to 22.18, or add `--experimental-strip-types` to those scripts.

### IN-05: `.gitignore` only protects a root-level `*.zip`

**File:** `.gitignore:60-67`
**Issue:** The privacy tool tells developers to keep a real export out of the repo, but only `/*.zip` and `tests/fixtures/private/` are ignored. A real export placed in `tests/`, `scripts/` or an unzipped `<account-id>/` tree (full of emails, IPs and payments) would be staged normally.
**Fix:** Add `*.zip` (committed fixtures are in-memory; the only tracked `.csv`/`.gz` files live in `tests/fixtures/geo/`), and consider ignoring `personal_data_export/` explicitly.

### IN-06: `driver.mjs` builds its demo with the retired `*_stats.csv` names and a fixed `/tmp` path

**File:** `.claude/skills/run-data-export-viewer/driver.mjs:35`, `:54-65`
**Issue:** `Player_statistics/WOT_stats.csv` etc. are the invented names 05-06 replaced with `WOT_Vehicle_Statistics.csv`, so the demo's Vehicles pane shows nothing. Screenshots are written to the predictable `/tmp/wot-viewer-shots/`, which on a shared machine is a pre-creatable path.
**Fix:** Use the real per-title file names from `tests/fixtures/player-stats-fixtures.ts`, and `mkdtempSync(join(os.tmpdir(), 'wot-viewer-'))` for the output directory.

### IN-07: The first zero-network test has no CSP-violation observer

**File:** `tests/e2e/guards/zero-network.spec.ts:41-93`
**Issue:** The three later tests install a `securitypolicyviolation` listener before navigation and assert it stayed empty; the original Phase 1 test only counts requests. A blocked request (which counting cannot see, because it never leaves the browser) would pass here.
**Fix:** Add the same `addInitScript` observer and final assertion to the first test, or hoist it into a shared helper.

### IN-08: Dead and test-only public surface

**File:** `src/lib/import/worker-client.svelte.ts:305-318`, `src/lib/worker/classify.ts:442-445`
**Issue:** `IngestClient.reset()` has no caller under `src/` (its docblock says "internal-only"); `classifyExport` and the exported `detectRoot` / `categoryFoldersUnder` are used only by tests. They are kept alive by tests that assert behaviour nothing ships.
**Fix:** Remove `reset()` and `classifyExport` (and un-export the helpers) together with their tests, or mark them `@internal`.

### IN-09: Nested interactive controls in the dropzone

**File:** `src/lib/shell/Dropzone.svelte:107-128`
**Issue:** The root is a `<label role="button" tabindex="0">` containing a focusable `<input type="file">`. `role="button"` makes children presentational, so the real control is hidden from assistive tech while still being a second tab stop, and the `svelte-ignore` suppresses the very warning that flags this. Keyboard users tab through the label, then the invisible input.
**Fix:** Drop `role="button"` and `tabindex` from the label and let the (visually hidden but focusable) input carry focus and the accessible name via the label, or make the input `tabindex="-1"` and keep the label as the single control.

### IN-10: Stale limit comments in `ci.yml`

**File:** `.github/workflows/ci.yml:172-176`, `:196`
**Issue:** The step comment still says Playwright's `globalTimeout` is 27 min and "29 min = 1620 + 120 s", while the config is 29 min and the step uses `timeout 31m`. The numbers are guarded by `ci-budget.test.ts`, but the prose next to them is the first thing a maintainer reads.
**Fix:** Rewrite the paragraph to the current G=29 / W=31 / J=39 values, or delete the arithmetic and point at the guard test.

---

_Reviewed: 2026-10-10_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
