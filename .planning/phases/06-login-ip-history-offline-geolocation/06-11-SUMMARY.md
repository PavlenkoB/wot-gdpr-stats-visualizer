---
phase: 06-login-ip-history-offline-geolocation
plan: 11
subsystem: infra
tags: [csp, network-guard, eslint, fetch, vite-define, playwright, privacy]

requires:
  - phase: 06-login-ip-history-offline-geolocation
    provides: "the recorded option-a decision (main-thread fetch, buffer transferred, connect-src self) and the worker-side city decode (06-09); the committed city fixture trio and the build manifest shape (06-09)"
provides:
  - "src/lib/geo/city-fetch.ts: readCityManifest, cityAssetUrl, fetchCityBytes, CITY_FILE_PATTERN, CITY_FETCH_ERROR, MAX_CITY_DOWNLOAD_BYTES - the only network call in src"
  - "src/lib/geo/city-manifest.d.ts: ambient __GEO_CITY__"
  - "scripts/geo/lib/city-manifest.ts: loadCityManifestFile, validateCityManifest (build time)"
  - "an ESLint override scoped to src/lib/geo/city-fetch.ts, with probes and a source scan proving it is one file wide"
  - "CSP connect-src 'self' and a zero-network spec that asserts the exact directive set"
affects: [06-12, 06-13, 06-14, phase-07, ACTIVITY-07]

actuals:
  tokens: 11700
  tasks: 2
  commits: 2
plan_head_before: dd54c9fee46190c1b127591147fa7cd8caba256b
plan_head_after: 5dfceda804607084f2190446ca3a64e65fa6ca81
commits: 2
commits_note: "2 measured from plan_head_before: one feat per task (Task 1 the tracer, Task 2 the CSP, manifest, spec and skill text). plan_head_after is the head when the ledger was measured; the docs commit that records it is necessarily later. tokens is chars/4 over the added lines of `git diff plan_head_before..plan_head_after` (about 46,700 chars), the scale the estimate used; the estimate of 85,000 was high because the plan's own prose was most of the volume."

tech-stack:
  added: []
  patterns:
    - "one exact-path ESLint override that re-declares the whole restricted-globals list minus one entry, because an override replaces rather than merges"
    - "an exemption proved from two independent instruments: lint probes on every edge of the glob, and a source scan that counts call sites without reading the lint config"
    - "a build-time constant read inside a function and typeof-guarded, so a unit test can stub it and a build without the define reads as no manifest"
    - "a pattern that cannot be shared across the src/ and scripts/ projects is written twice and a unit test asserts the two sources are identical"

key-files:
  created:
    - "src/lib/geo/city-fetch.ts"
    - "src/lib/geo/city-manifest.d.ts"
    - "scripts/geo/lib/city-manifest.ts"
    - "tests/unit/geo/city-fetch.test.ts"
    - "tests/unit/geo/city-manifest.test.ts"
    - "tests/unit/guards/fetch-scan.test.ts"
  modified:
    - "eslint.config.js"
    - "vite.config.ts"
    - "tsconfig.test.json"
    - "tests/unit/guards/lint-guards.test.ts"
    - "tests/e2e/guards/zero-network.spec.ts"
    - ".claude/skills/run-data-export-viewer/SKILL.md"

key-decisions:
  - "The CSP is described everywhere (vite.config.ts, zero-network spec, run skill, city-fetch.ts) as defence in depth only. The measured fact stands: a meta CSP is blind to worker traffic and a 'self' host source cannot be path-restricted, so nothing claims the CSP confines the request to the city asset. The `connect-src 'none'` of earlier phases never governed worker traffic either."
  - "The request init is method GET, credentials omit, referrerPolicy no-referrer, mode same-origin, signal - and no headers, no body. mode same-origin is an addition to the plan's list: it refuses a cross-origin redirect on the main thread as well as the CSP does."
  - "The base path must match /^\\/(?:(?!\\.+\\/)[A-Za-z0-9._~-]+\\/)*$/ (one leading slash, a trailing slash, no dot-only segment). A relative './' base is rejected, so Phase 7 must set an absolute subpath."
  - "The URL is the page ORIGIN concatenated with the base path, not a resolution against the page, so nothing in the page's own path, query or fragment can reach it."
  - "fetchCityBytes stops and throws the fixed error past MAX_CITY_DOWNLOAD_BYTES (96 MiB, pinned equal to MAX_CITY_TABLE_BYTES by a test) rather than buffering an unbounded body on the main thread."

patterns-established:
  - "Probe the glob's edges, not only its target: a near-miss name beside the exempt file and the exempt file name in the worker directory are both probed as still banned."

requirements-completed: [ACTIVITY-07]

coverage:
  - id: D1
    description: "Exactly one source file under src makes a network call, city-fetch.ts, on the main thread; the exemption is one exact path and every other network API stays banned in it"
    requirement: ACTIVITY-07
    verification:
      - kind: unit
        ref: "tests/unit/guards/fetch-scan.test.ts"
        status: pass
      - kind: unit
        ref: "tests/unit/guards/lint-guards.test.ts#the single sanctioned fetch"
        status: pass
  - id: D2
    description: "The request is one GET for one same-origin file built only from the validated manifest: no query, fragment, header or body, credentials omitted, no referrer; one fixed error; an abort propagates as an abort"
    requirement: ACTIVITY-07
    verification:
      - kind: unit
        ref: "tests/unit/geo/city-fetch.test.ts"
        status: pass
  - id: D3
    description: "CSP connect-src changes from none to self and no other directive; every pre-existing flow still records zero requests and zero CSP violations"
    requirement: ACTIVITY-07
    verification:
      - kind: e2e
        ref: "tests/e2e/guards/zero-network.spec.ts"
        status: pass
      - kind: unit
        ref: "tests/unit/geo/city-manifest.test.ts#vite.config.ts"
        status: pass
  - id: D4
    description: "The build-time manifest is baked as __GEO_CITY__ (fixture, real, or null) and a malformed manifest is rejected at build time"
    requirement: ACTIVITY-07
    verification:
      - kind: unit
        ref: "tests/unit/geo/city-manifest.test.ts"
        status: pass
  - id: D5
    description: "The run skill and the stale spec comment no longer claim worker requests are invisible to Playwright or that the CSP is the guard"
    requirement: ACTIVITY-07
    verification:
      - kind: other
        ref: "manual diff review of .claude/skills/run-data-export-viewer/SKILL.md and the header of tests/e2e/guards/zero-network.spec.ts"
        status: pass

duration: 40min
completed: 2026-10-04
status: complete
---

# Phase 6 Plan 11: The One Sanctioned Network Path Summary

**A main-thread `city-fetch.ts` is the only network call in the product, behind a lint exemption exactly one file wide, a source scan that counts one call site, a `connect-src 'self'` CSP described honestly as defence in depth, and a build-time manifest baked as `__GEO_CITY__`.**

## Performance

- **Duration:** about 40 minutes
- **Tasks:** 2 of 2 (Task 1 a tracer, Task 2 auto)
- **Files:** 6 created, 6 modified

## Accomplishments

- `city-fetch.ts` builds one URL from the page origin, the validated base path, `geo-city-data/` and a manifest file name that must match a strict pattern, then issues ONE GET with credentials omitted, a no-referrer policy and same-origin mode, no headers and no body. Progress is reported against the manifest's byte size, the body is returned as one `ArrayBuffer` ready to transfer, every failure is the single text `city fetch failed`, and an abort stays an abort.
- The ESLint override re-declares block 7's restricted globals minus the platform fetch entry for that exact path. 19 lint probe tests show fetch is reported on a main-thread feature path, the worker directory, a nested worker path, a sibling geo file, a near-miss name beside the exempt file, the exempt name in the worker directory and a Svelte file, and is not reported in the exempt file; the legacy request object, socket, transport, event source, peer connection, deferred fetch and importScripts and the explicit-global forms (`window.`, `self.`, `globalThis.fetch`, `sendBeacon`) all stay reported there.
- A source scan, independent of the lint config, asserts the platform fetch call appears in exactly one `src/` file (called once in it), that no explicit-global fetch, other network API or inline lint-disable exists anywhere in `src/`, and that `src/lib/worker/` contains none.
- `connect-src` is `'self'` and nothing else in the policy moved; the zero-network spec asserts the exact directive set and still passes in full (4 of 4: zero requests and zero CSP violations in every pre-existing flow).
- `loadCityManifestFile(process.env)` returns the committed fixture manifest for `GEO_FIXTURE=1`, the real manifest when `public/geo-city-data/manifest.json` exists, otherwise `null`; a malformed manifest fails the build naming the field and never quoting the content. `pnpm run build` passes with no manifest (null) and with `GEO_FIXTURE=1`.

## Task Commits

1. **Task 1 (tracer): the one network module, its lint exemption and the proof it is one file wide** - `d809358` (feat)
2. **Task 2: CSP connect-src self, the build-time manifest, the corrected zero-network spec and run-skill text** - `5dfceda` (feat)

## Verification

- `pnpm run test:unit`: 72 files, 2,176 tests passed.
- `pnpm run check`, `pnpm run lint` (prettier plus eslint), `pnpm run build` (null manifest and `GEO_FIXTURE=1`): pass.
- `pnpm exec playwright test tests/e2e/guards/zero-network.spec.ts`: 4 passed.
- Tracer gate: `<verify>` re-run end to end before expansion, passed.
- The built `dist/index.html` carries `default-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'`.

## Decisions Made

See `key-decisions` above. The load-bearing one: nothing in this plan says the CSP restricts the fetch to the city asset, because it cannot. The enforcement is the lint ban (one exempt module, worker directory with no exemption) and Playwright request assertions; the latter must, in plan 06-13, prove which asset the one request fetched.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The base-path pattern accepted a `..` segment**
- **Found during:** Task 1 (the unit test written for `'/../'` failed)
- **Issue:** `[A-Za-z0-9._~-]+` matches `..`, so `/../` passed validation and could have steered the URL up the path.
- **Fix:** a negative lookahead rejecting a dot-only segment.
- **Files modified:** `src/lib/geo/city-fetch.ts`
- **Commit:** `d809358` (fixed before the commit, with the test that found it)

**2. [Rule 2 - Missing critical functionality] Unbounded buffering on the main thread**
- **Found during:** Task 1
- **Issue:** the plan's loader concatenates whatever the host sends. A misconfigured or hostile host could make the main thread buffer an unbounded body before the worker's cap could ever apply.
- **Fix:** `MAX_CITY_DOWNLOAD_BYTES` (96 MiB, the container cap) with the fixed error and a cancelled reader; a test pins it equal to `MAX_CITY_TABLE_BYTES`, which this module cannot import because it is worker-only.
- **Files modified:** `src/lib/geo/city-fetch.ts`, `tests/unit/geo/city-fetch.test.ts`
- **Commit:** `d809358`

**3. [Rule 2 - Missing critical functionality] `mode: 'same-origin'` on the request**
- **Issue:** the plan listed credentials and referrer only. A same-origin mode makes the browser refuse any cross-origin redirect on the main thread in addition to the CSP. The unit test pins the exact set of init keys, so it cannot grow unnoticed.
- **Commit:** `d809358`

**4. [Shape] Tracer files**
- The plan's task 1 file list was followed (7 files). `tests/unit/geo/city-manifest.test.ts` and the pattern-equality assertion moved to Task 2, because the build script they import does not exist until then.

### TDD note

Task 2 is `tdd="true"`. The manifest helper and its tests were written together in one pass and committed together as a single `feat`, not as a red commit followed by a green one. The behaviours in the plan's `<behavior>` list are each asserted, and the one bug found (item 1) was found by a test, but there is no separate failing-test commit.

## Issues Encountered

None beyond the deviations above.

## Notes for Later Plans

- **06-13 (opt-in UI):** call `readCityManifest()` and treat `null` as "opt-in unavailable". Pass `import.meta.env.BASE_URL` and `location.href` to `cityAssetUrl`. Catch an abort separately from `city fetch failed`. Transfer the returned buffer to the worker. The opt-in specs must assert WHICH asset the one request fetched (path ends in the manifest file, no query, no body), since that is now the real enforcement. Nothing consumes `city-fetch.ts` yet, so it is tree-shaken out of the bundle and `__GEO_CITY__` does not appear in `dist/` until 06-13 wires it.
- **Phase 7 hand-off:** the base path comes from `import.meta.env.BASE_URL` and must be an absolute subpath (a relative `./` base is rejected on purpose). Path-restricting the `connect-src` host source can be revisited once the deployed origin is known (a flagged assumption of 06-RESEARCH); and the deployed Pages behaviour for the `.citydb.bin` file (Content-Encoding, caching) is still unverified (A1).
- **Stale text outside this plan's files:** `AGENTS.md` (the CSP row and a source line) still says `connect-src 'none'`; `tests/e2e/playtime/playtime-scale.spec.ts` comments say a blocked `connect-src` surfaces in its violation collector. That spec still counts requests, so it is not weakened, but a same-origin exfiltration attempt would now show as a request and not as a CSP violation. Neither file was in this plan's scope; both are worth a documentation touch-up.
- **CI budget:** no new browser test was added (the CSP test was renamed in place), so `globalTimeout`, the `timeout Nm` wrapper, `timeout-minutes` and `tests/unit/guards/ci-budget.test.ts` are untouched and the budget state from 06-10 stands.
- **WINDOWS.md:** not touched (rows 8-9 corrupt, pre-existing). No stubs, skipped tests or unrun verifies were introduced.

## Known Stubs

None.

## Threat Flags

None. The new surface (the one request) is exactly the one T-06-41 to T-06-44 cover.

## Self-Check: PASSED

- Created files all exist: city-fetch.ts, city-manifest.d.ts, scripts/geo/lib/city-manifest.ts, the three new test files.
- Commits `d809358` and `5dfceda` exist on `gsd/phase-06-login-ip-history-offline-geolocation`.
