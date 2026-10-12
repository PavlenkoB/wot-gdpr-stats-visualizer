---
phase: 06-login-ip-history-offline-geolocation
plan: 13
subsystem: ui
tags: [svelte5, opt-in, state-machine, abort-controller, web-worker, playwright, privacy]

requires:
  - phase: 06-login-ip-history-offline-geolocation
    provides: "the worker-side city decode and view (06-09), the one sanctioned main-thread fetch and the build manifest (06-11), the IP table with a declared-but-unwired City column (06-10), the country map section (06-12), the frozen copy (06-02), the block, mask and locators (06-08)"
provides:
  - "CityClient: its own loadId namespace, a transfer-list post, fixed-detail failures, supersede on issue"
  - "city-state.ts: the pure seven-state machine (cityReduce), the silent-abort effect on a dataset change, acceptCityOutcome and the unavailable rule"
  - "CityOptIn.svelte: idle, downloading, decoding, ready, error, cancelled and unavailable, with focus moves and announcements; the only caller of fetchCityBytes"
  - "CityList.svelte: the ranked city list capped at fifty with its two captions"
  - "the City column: a per-row city source decided when the rows are built, sortable, special values last"
  - "IngestClient.city, routed from the first branch of the message handler"
  - "a hermetic three-test browser suite that reads the one request itself"
affects: [06-14, phase-07, ACTIVITY-07]

actuals:
  tokens: 23800
  tasks: 3
  commits: 5

# Measured, never narrated (#3968). plan_head_after is the head when the ledger was read;
# the docs commit that records this summary is necessarily later.
plan_head_before: 20e4f5b698d6dd6472373b84dcae954faf342796
plan_head_after: 69de9948c81f8b946f0e8c5a2b6b5e7a8d4e27f3
commits: 5
commits_note: "5 measured from plan_head_before: the tracer feat, the Task 2 red test commit and its green feat, the Task 3 red test commit and its green feat. tokens is chars/4 over the added lines of `git diff plan_head_before..plan_head_after` (about 95,200 chars), the scale the estimate used; the estimate of 120,000 was high because most of the volume is comments and the 719-line browser spec."

tech-stack:
  added: []
  patterns:
    - "one pure reducer returns {state, effect}; the effect (abort-silently) is what a dataset change adds to a transition, so 'a replace is not a cancel' is a property of a table and not a discipline"
    - "whoever aborts a controller has already moved the state, so a handler that wakes to an aborted signal does nothing and one that finds a live signal reports a failure: signal.aborted is 'somebody already decided'"
    - "a per-row display source decided at build time from an index-aligned view, BEFORE sorting, with the view dropped whole if its length disagrees"
    - "hermetic request proof: route.fulfill from the committed fixture, a context-level request recorder, and an exact assertion on method, origin, path, query, fragment, body and referer"

key-files:
  created:
    - "src/lib/features/logins/city-client.ts"
    - "src/lib/features/logins/city-state.ts"
    - "src/lib/features/logins/CityOptIn.svelte"
    - "src/lib/features/logins/CityList.svelte"
    - "tests/unit/logins/city-client.test.ts"
    - "tests/unit/logins/city-state.test.ts"
    - "tests/e2e/logins/login-city.spec.ts"
    - ".planning/phases/06-login-ip-history-offline-geolocation/deferred-items.md"
  modified:
    - "src/lib/features/logins/login-model.ts"
    - "src/lib/features/logins/LoginHistory.svelte"
    - "src/lib/import/worker-client.svelte.ts"
    - "src/lib/shell/Dashboard.svelte"
    - "tests/unit/import/ingest-client.test.ts"
    - "tests/e2e/shell/dashboard.spec.ts"

key-decisions:
  - "The city view lives in LoginHistory's one rune, stamped with its importedAt and nulled by the existing dataset effect beside the mask and sort reset; CityOptIn owns only the machine and the controller. CityOptIn sits inside the ready branch, so a replace unmounts it, and its teardown aborts silently."
  - "acceptCityOutcome drops a view-less result, a result for another dataset and any answer for another load, as the plan lists. The component treats a null for a load nobody aborted as a FAILURE, not a wait: nothing else is coming, and a decoding state that never ends is the worse failure."
  - "A browser without DecompressionStream is told before the 11.8 MB are spent: the press goes to downloading and straight to the fixed error, with no request."
  - "CityClient exposes lastLoadId, read right after load() returns, so the component can name the load it is about to await for acceptCityOutcome; load() still returns a promise of CityOutcome."
  - "buildLoginRows takes the city view as an optional third argument and decides each row's city source (place, unknown, none) there, because placeOf is aligned to the STORED order and is only true before the rows are sorted. A view whose length differs from the address list is ignored whole."
  - "An address with a country and no usable place reads City unknown for BOTH 'no record' and 'a country with no city name' (the worker gives both placeOf -1); the no-city caption counts only the second, from the view's own noCityAddresses."

patterns-established:
  - "Pure state module (no Svelte, no copy) plus a component that only wires it, with a source scan of the component for the markup rules no unit test can render"
  - "Lifecycle browser test: one test, one import, many steps, so the CI budget prices three tests for ten cases and the expensive part is paid once"

requirements-completed: [ACTIVITY-07]

coverage:
  - id: D1
    description: "Nothing is requested before the click; one click makes exactly one same-origin GET for the one file the manifest names, with no query, fragment, body or referer, and a City cell then appears"
    requirement: ACTIVITY-07
    verification:
      - kind: e2e
        ref: "tests/e2e/logins/login-city.spec.ts#tracer: nothing is requested before the click, then one click fetches the fixture and a City cell appears"
        status: pass
  - id: D2
    description: "The seven-state machine: transitions, the dataset-change silent abort that never enters cancelled, the drop rules, the unavailable rule, and the Load button gated behind idle, error and cancelled"
    requirement: ACTIVITY-07
    verification:
      - kind: unit
        ref: "tests/unit/logins/city-state.test.ts"
        status: pass
  - id: D3
    description: "CityClient: transfer list, supersede, unknown ids ignored, failPending, never rejects; IngestClient routes city-result and city-error first and releases pending loads with fixed details on a worker error"
    requirement: ACTIVITY-07
    verification:
      - kind: unit
        ref: "tests/unit/logins/city-client.test.ts"
        status: pass
      - kind: unit
        ref: "tests/unit/import/ingest-client.test.ts#06-13 the city bridge"
        status: pass
  - id: D4
    description: "Progress (determinate, max = manifest bytes), Cancel (neutral line, no alert role, focus on Load, request aborted), a 500, a wrong body and a hash mismatch each leave the country view intact; a replace during a slow download is silent; replace, Clear and reload return idle with the mask and sort at their defaults; the 375px progress row stacks"
    requirement: ACTIVITY-07
    verification:
      - kind: e2e
        ref: "tests/e2e/logins/login-city.spec.ts#progress, cancel and failures leave the country view alone, and a replace or Clear returns everything to its defaults"
        status: pass
  - id: D5
    description: "The City column (place, City unknown, dash, recorded account city, sort with special values last), the fifty-row ranked list with its singular and plural captions, the accuracy note and the data month, no address in the list masked or revealed, nothing stored after load or after reload"
    requirement: ACTIVITY-07
    verification:
      - kind: e2e
        ref: "tests/e2e/logins/login-city.spec.ts#after a click the table, the ranked list and the accuracy note are right, no address is in the list, and nothing is stored"
        status: pass
  - id: D6
    description: "The accuracy note is shown whenever city data is shown and the block never claims precision beyond it"
    requirement: ACTIVITY-07
    verification:
      - kind: other
        ref: "judgment: CityOptIn renders CITY_ACCURACY_NOTE in the ready state, the only state in which a City column or list exists; asserted present in the browser spec (city-note), absence-of-claims is review"
        status: pass

duration: 95min
completed: 2026-10-04
status: complete
---

# Phase 6 Plan 13: The City Opt-In Summary

**A pure seven-state opt-in (`cityReduce`) wired to the one main-thread fetch, a transfer-list `CityClient`, a sortable City column and a fifty-row ranked list, all session-only, with a hermetic three-test browser suite that reads the single request itself.**

## Performance

- **Duration:** about 95 minutes
- **Tasks:** 3 of 3 (Task 1 a tracer, Tasks 2 and 3 `tdd="true"`)
- **Files:** 8 created, 6 modified

## Accomplishments

- **Nothing before the click, one request after it, and the request is proved, not assumed.** The browser spec records every request the context makes (a worker's included), holds the count stable after import, presses the button, and then asserts exactly one new request: GET, same origin as the page, path ending `/geo-city-data/<the manifest's file>`, empty query and fragment, no post data, no `referer`. The file name and byte count are read from the same fixture manifest JSON the page was built from.
- **Abort is not failure, and a replace is not a cancel.** `cityReduce` is a table; a dataset change from any state returns idle with an `abort-silently` effect and never enters cancelled. Cancel is a neutral line with no alert role (`CITY_CANCELLED_TONE` is `'neutral'`), focus on Load and a polite announcement; every genuine failure (a 500, a body that is not the file, a right-sized body with the wrong hash, an unsupported browser, a worker error) is the one fixed sentence in the alert chrome with the Load button back.
- **The City column and the list.** Each row's city source is decided once, when the rows are built, from the view's index-aligned `placeOf` (before sorting, with the view ignored whole on a length mismatch). The cell is `{City}, {State}` or just the city, `City unknown` (muted) for a country with no city, a dash for no country, and the pinned Account record keeps the city the account file recorded (`Testville` in the sample), never the database's answer for the same address. Sorting by City is code-unit order with the special values last in both directions.
- **The list** is a native `details open` with a native table in a 320px scroller, at most 50 rows, then `and k more cities not listed` and `n IP addresses have no city in the database` only above zero (singular forms exercised).
- **Session-only.** One rune in `LoginHistory` stamped with its `importedAt`, reset by the existing dataset effect beside the mask and sort. The browser spec reads localStorage, sessionStorage, cookies, the URL and every IndexedDB store after load and again after a reload, asserts the stores are non-trivially populated (so the check is not vacuous) and that no fixture city name is in any of them.
- **Bundle:** after `pnpm run build` (with `GEO_FIXTURE=1` and without), `city-fetch.ts` and the manifest constant are in the main chunk (`geo-city-data` once there, zero in the worker chunk) and the output is still three assets (CSS, main JS, worker JS), so no lazy chunk appeared. `city-fetch.ts` is no longer tree-shaken out.

## Task Commits

1. **Task 1 (tracer): a click fetches the fixture, the worker decodes it and a City cell appears** - `fb83b6e` (feat)
2. **Task 2: the opt-in's transitions, drop rules, city client and routing** - `045f9d0` (test, red: `city-state.ts` did not exist)
3. **Task 2: the full state machine, cancel, errors, silent abort, focus and announcements** - `0e10157` (feat, green)
4. **Task 3: the hermetic browser suite, red until the list exists** - `c67354e` (test)
5. **Task 3: the ranked city list** - `69de994` (feat, green)

## Verification

- `pnpm run test:unit`: 75 files, 2,281 tests passed.
- `pnpm run check` (`tsc -b`) and `pnpm run lint` (prettier plus eslint): pass. `svelte-check` reports nothing in the touched files (its only errors are an unresolvable `esrap` type in `node_modules`, which predates this plan).
- `pnpm exec playwright test`: 228 passed, in full, on a clean build.
- `pnpm exec vitest run tests/unit/guards/ci-budget.test.ts` and `fetch-scan.test.ts`: pass. `tests/e2e/guards/zero-network.spec.ts`: 4 passed.
- Tracer gate: `<verify>` re-run end to end before expansion, passed.
- Task 3's red was observed rather than assumed: with the list component and its mount moved aside, the browser case failed at the missing `city-list` and the persistence scan failed on the missing file; both were restored and the red commit made before the green one.

## CI budget

Three new browser tests take the suite to 228 tests, the figure the 06-12 raise holds up to (`playwright test --list`: 228 tests in 21 files). `globalTimeout` (26 min), the `timeout Nm` wrapper, `timeout-minutes` and the `ci-budget.test.ts` constants were left alone, and the guard passes. The ten cases of the plan are grouped into three tests by what they share (the tracer and request shape; the list, privacy and persistence on one import; the lifecycle on one import), so the expensive import is paid once per test.

## Decisions Made

See `key-decisions` above. The one with the widest reach: **the city view and the controller are split.** The view lives in the block that already owns the dataset identity, so a replace and a Clear null it by the same effect that re-masks; the machine and the abort live in the component that is unmounted by exactly those events. Neither half needs a hook somebody has to remember to call.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `LoginHistory` had no route to the city client**
- **Found during:** Task 1
- **Issue:** its only client prop is the channel-scoped `QueryClient`, so `ingestClient.city` was unreachable. The parent that mounts it was not in `files_modified`.
- **Fix:** a `cityClient` prop, passed by `src/lib/shell/Dashboard.svelte` from `ingestClient.city`, the way the data client is passed.
- **Files modified:** `src/lib/shell/Dashboard.svelte`
- **Commit:** `fb83b6e`

**2. [Rule 1 - Bug] The dashboard spec's button count for the Activity card**
- **Found during:** the full Playwright run after Task 2
- **Issue:** `dashboard.spec.ts` pins the card's buttons at seven (the mask toggle and the six sort buttons) and says a new control has to come back and own the line. The city Load button is that control.
- **Fix:** the count is eight, with the Load button named in the comment and asserted by test id.
- **Files modified:** `tests/e2e/shell/dashboard.spec.ts`
- **Commit:** `c67354e`

**3. [Rule 2 - Missing critical functionality] A decode that can never be accepted must not strand the block**
- **Issue:** the plan's drop rules make a view-less result and a result for another dataset `null`. A component that treats every `null` as "ignore" would leave the block in decoding forever when the worker holds no dataset.
- **Fix:** `null` for a load nobody aborted is a failure in the component (documented in `acceptCityOutcome`); a dataset change or Cancel aborts the controller first, so those cases never reach it.
- **Files modified:** `src/lib/features/logins/CityOptIn.svelte`, `city-state.ts`

**4. [Rule 2 - Missing critical functionality] The unsupported-browser case fails before the download**
- **Issue:** the plan says an unsupported `DecompressionStream` shows the error sentence, which in the worker would only happen after 11.8 MB had been fetched and transferred.
- **Fix:** the press checks for it first and shows the same fixed error with no request.
- **Files modified:** `src/lib/features/logins/CityOptIn.svelte`

**5. [Shape] Additions beyond the listed files**
- `CityClient.lastLoadId` (a getter) so the component can name the load it awaits; `data-testid` values `city-ready`, `city-cancelled`, `city-unavailable`, `city-intro`, `city-progress-line`, `city-decoding`, `city-more` and `city-no-city` added beside the plan's list, all new, none changing an existing hook.
- `deferred-items.md` in the phase directory records the out-of-scope fixture findings below.

### TDD note

Task 2 and Task 3 each have a test commit before the feature commit. Task 2's red is a missing module (the state tests). Task 3's browser cases were written beside the list component, so its red was produced on purpose by moving the component aside, observing the failure, and restoring it before the red commit. The `city-client` and ingest-routing tests are in the Task 2 test commit and passed from it, because Task 1's tracer had already built the client.

## Notes for the verifier and later plans

- **The decoding state is not observed in a browser.** It lasts a few milliseconds against a 1.2 KB fixture, so asserting it there would be a race. It is covered by the reducer table (downloading to decoding to ready, no Cancel offered, a press ignored) and the source scan (no Load button, no Cancel, in that branch).
- **Out-of-scope fixture findings** (`deferred-items.md`): six IPv6 rows of `city-fixture.csv` are missing their continent column, and the country fixture covers only forty of the sixty IPv6 `/48`s. Neither affects a result here; the browser spec mirrors the committed file's column positions and reaches more than fifty places through the IPv4 ranges as well.
- **ACTIVITY-07** was already marked Complete in `REQUIREMENTS.md` by earlier plans (the data and the one request). This plan delivers the UI half that makes that true: the opt-in, the City column, the list and the proofs. It was not un-marked.
- **06-14** can rely on `cityOptIn`, `city-load`, `city-cancel`, `city-progress`, `city-error`, `city-note`, `city-list` and `city-row`, all present.
- **CSP honesty** holds in every comment this plan wrote: the CSP is defence in depth only, and the guarantee is the lint ban plus the request assertions in `login-city.spec.ts`.
- **WINDOWS.md** was not touched (rows 8 and 9 are corrupt, pre-existing). No stubs, skipped tests or unrun verifies were introduced.

## Known Stubs

None.

## Threat Flags

None. The only new surface is the single request T-06-53 covers, now asserted exactly.

## Self-Check: PASSED

- Created files all exist: `city-client.ts`, `city-state.ts`, `CityOptIn.svelte`, `CityList.svelte`, `city-client.test.ts`, `city-state.test.ts`, `login-city.spec.ts`, `deferred-items.md`.
- Commits `fb83b6e`, `045f9d0`, `0e10157`, `c67354e` and `69de994` exist on `gsd/phase-06-login-ip-history-offline-geolocation`.
