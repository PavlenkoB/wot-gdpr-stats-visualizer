---
phase: 07-mobile-layout-public-deploy
plan: 01
subsystem: infra
tags: [vite, base-path, github-pages, playwright, zero-network, csp, artifact]

requires:
  - phase: 06-logins-map
    provides: the CSP meta policy, the opt-in city-file module and its build-time manifest, the zero-network e2e guard
provides:
  - "vite.config.ts reads an absolute base from VITE_BASE, default '/' (D-11)"
  - "tests/deploy/playwright.gate.config.ts serves the built dist under the Pages subpath, never rebuilding it"
  - "tests/deploy/deployed-build.spec.ts — the spec shared with plan 07-02's post-deploy smoke, deriving its base from baseURL"
  - "tests/deploy/dist-artifact.spec.ts — a browserless allowlist of everything the artifact would publish"
  - "tests/unit/guards/deploy-gate.test.ts — source-contract guard for the base line and the gate invariants"
  - "the D-12 Pages preconditions, recorded as DEFERRED"
affects: [07-02-deploy-workflow, 07-06-readme, deploy.yml, any future subpath hosting]

actuals:
  tokens: 41000
  tasks: 3
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Deploy specs live in tests/deploy, outside the default testDir, so the pull-request e2e budget is provably unaffected"
    - "A pre-deploy gate serves the dist already on disk: a gate that rebuilt would test a build, not the artifact"
    - "The gate spec is shared verbatim with the post-deploy smoke; the base is read from the baseURL option so the two servers cannot drift"

key-files:
  created:
    - tests/deploy/playwright.gate.config.ts
    - tests/deploy/deployed-build.spec.ts
    - tests/deploy/dist-artifact.spec.ts
    - tests/unit/guards/deploy-gate.test.ts
  modified:
    - vite.config.ts

key-decisions:
  - "The Pages preconditions are recorded as DEFERRED by the owner's explicit reply; no repository setting was changed and none is read by the agent"
  - "The base is a single config line, not an index.html edit: Vite rewrites the favicon, script, stylesheet and worker URLs itself"
  - "The city file's presence-before-build is enforced by an assertion (the manifest's name must appear in a built chunk), not by workflow YAML ordering alone"
  - "The artifact spec asserts a positive allowlist rather than a denylist of bad names, and collects every offender into one message"

patterns-established:
  - "Config-source guards: the deploy path's failures are defects of the configuration around the tests, so a unit guard reads those files the way geo-seam.test.ts reads the fixture switch"
  - "Derive expectations from the fixture under test: every base-path assertion reads baseURL's pathname, so no spec carries a second copy of the path"

requirements-completed: [PLATFORM-03]

coverage:
  - id: D1
    description: "The app is built and served under the real Pages subpath, with its worker and favicon resolving under it and no request leaving the base"
    requirement: PLATFORM-03
    verification:
      - kind: e2e
        ref: "tests/deploy/deployed-build.spec.ts — the app loads, its worker and favicon resolve under the base, and no request leaves it"
        status: pass
      - kind: other
        ref: "VITE_BASE=/wot-gdpr-stats-visualizer/ pnpm run build && pnpm exec playwright test -c tests/deploy/playwright.gate.config.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "The CSP is intact on the built artifact, with exactly the five directives and connect-src exactly 'self'"
    verification:
      - kind: e2e
        ref: "tests/deploy/deployed-build.spec.ts — the served build carries the CSP meta tag with all five directives and connect-src exactly 'self'"
        status: pass
    human_judgment: false
  - id: D3
    description: "Zero network requests follow the load baseline, idle and through a real import, with no CSP violation raised"
    verification:
      - kind: e2e
        ref: "tests/deploy/deployed-build.spec.ts — no request follows the load baseline, through a real import, with no CSP violation"
        status: pass
      - kind: e2e
        ref: "tests/e2e/guards/zero-network.spec.ts (default base regression, 5 passed)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The city file is served with the byte count and sha256 its manifest records, and one opt-in press issues exactly one request for that file"
    verification:
      - kind: e2e
        ref: "tests/deploy/deployed-build.spec.ts — the served city file is the manifest's file, with the manifest's bytes and sha256; and one press of the opt-in makes exactly one request"
        status: pass
    human_judgment: false
  - id: D5
    description: "The artifact holds only allowlisted public files, its manifest is dbip-sourced for the expected month, and the build-order dependency is caught"
    verification:
      - kind: other
        ref: "tests/deploy/dist-artifact.spec.ts (4 tests, pass; 3 of them fail when public/geo-city-data is removed before the build)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The base line and the gate invariants (no rebuild, no fixture switch, no listing by the default config) are guarded"
    verification:
      - kind: unit
        ref: "tests/unit/guards/deploy-gate.test.ts (14 tests) and tests/unit/guards/geo-seam.test.ts (11 tests)"
        status: pass
    human_judgment: false
  - id: D7
    description: "The Pages preconditions (repository visibility, Pages source = GitHub Actions) are confirmed or consciously deferred by the owner"
    verification: []
    human_judgment: true
    rationale: "Both settings are owner-only, the agent is unauthenticated against the GitHub API, and the recorded outcome is a deferral. No test can assert it; the only evidence is the owner's recorded reply, carried in this SUMMARY and in 07-VALIDATION.md."

duration: 41 min
completed: 2026-10-05
status: complete
---

# Phase 7 Plan 1: Subpath base and the pre-deploy gate Summary

**A `VITE_BASE` subpath base in `vite.config.ts`, and a Playwright gate that serves the built `dist` under `/wot-gdpr-stats-visualizer/` without ever rebuilding it — proving worker, favicon, CSP, zero-network, single-opt-in-request and artifact contents on the exact bytes that would be uploaded.**

## Performance

- **Duration:** 41 min
- **Started:** 2026-10-05T18:14:00Z
- **Completed:** 2026-10-05T18:55:00Z
- **Tasks:** 3
- **Files modified:** 5 (4 created, 1 modified)

## Task 1 — the D-12 Pages preconditions: DEFERRED

The task changed no files, and its outcome is the owner's recorded reply.

- **Unauthenticated probe:** `curl -s -o /dev/null -w '%{http_code}' https://api.github.com/repos/PavlenkoB/wot-gdpr-stats-visualizer` → **`404`**. Re-verified independently by this executor. A repository that exists answers 404 unauthenticated only when it is **private**; a public one answers 200. Body: `{"message": "Not Found", "status": "404"}`.
- **`gh auth status`:** not logged in to any GitHub host. The agent cannot read or change repository settings and did not try.
- **Owner-only settings, both unsatisfied:** (1) repository visibility that permits GitHub Pages — free Pages needs a public repository; (2) Settings → Pages → Build and deployment → Source = "GitHub Actions".

**Owner's reply, recorded verbatim:**

```
deferred: repo stays private for now
```

The plan title is "deferral allowed", so this is a legitimate completed outcome and Tasks 2 and 3 proceed unchanged. No repository setting was changed, `gh auth login` was not attempted, and the visibility question is not re-opened.

**Nothing downstream depends on the answer.** Every code, test and workflow change in plans 07-01 through 07-06 is built and verified locally against `vite preview` on localhost. The first real dispatch of `deploy.yml` only happens after this branch merges to `main`, and that item stays tracked in the README checklist (plan 07-06) and in `07-VALIDATION.md`.

## Accomplishments

- The single production-code line the phase needed — `base: process.env.VITE_BASE ?? '/'` — with the default at the origin root, so dev, preview and the whole e2e suite are unchanged (D-11). `index.html` was not touched: `git diff --quiet HEAD -- index.html` exits 0, and a build with the subpath rewrites the favicon, script, stylesheet and the main chunk's worker URL on its own.
- A gate that serves the `dist` **already on disk** under the real subpath. Its `webServer` command is `vite preview` and nothing else, because a gate that rebuilt would test a build rather than the artifact that leaves the machine — and the guard asserts the build subcommand is absent.
- One spec shared verbatim with plan 07-02's post-deploy smoke. Every base-path assertion reads the pathname of the `baseURL` test option, so no file carries a second copy of the path and the two servers cannot drift.
- The artifact's own contents, which no browser assertion could reach: a positive allowlist over the whole tree, the manifest's `source`/`month`/`bytes`/`sha256`/gzip magic, the DB-IP attribution text, and the manifest name baked into a built chunk.
- The build ORDER is enforced rather than merely documented in workflow YAML — verified by deleting `public/geo-city-data` before the build, which fails 4 tests including the opt-in and both city artifact checks.
- Nine gate tests where Task 2 shipped one; the default e2e suite provably unchanged at **234 tests in 22 files**, before and after.

## Task Commits

Each task was committed atomically:

1. **Task 1: Record the Pages preconditions (D-12), deferral allowed** — no files, by design; recorded in this SUMMARY.
2. **Task 2: Tracer — the built app, served under the subpath, loads and its worker returns 200** — `b2c87fd` (feat)
3. **Task 3: Expand the gate — CSP, zero-network, served city bytes, artifact contents** — `396c997` (test)

**Plan metadata:** see the final commit of this plan.

## Files Created/Modified

- `vite.config.ts` — the `base` line, read from `VITE_BASE` with `/` as the default, documented against the absolute-base requirement `cityAssetUrl` imposes.
- `tests/deploy/playwright.gate.config.ts` — the gate: reads and validates the base, serves the dist under it with no build and no fixture switch, lists both gate specs.
- `tests/deploy/deployed-build.spec.ts` — five tests: the subpath load, the CSP directive set, zero-network through an import, the served city bytes, and the single opt-in request. Shared with plan 07-02.
- `tests/deploy/dist-artifact.spec.ts` — four browserless tests over the artifact tree.
- `tests/unit/guards/deploy-gate.test.ts` — 14 tests reading the config sources: the base line, `index.html` untouched, the CSP array unchanged, no build in the gate, no fixture name anywhere under `tests/deploy`, the default config's `testDir`, and the artifact spec's browserlessness.

## Decisions Made

- **The base is a config line, not an `index.html` edit.** Research had already established that `vite build --base=…` rewrites every reference; a hand-edited `index.html` would be a second, drifting source of the same truth and would break the default build, where no prefix exists.
- **The gate never builds.** Serving the on-disk `dist` is what makes the gate a test of the artifact rather than a test of a build step. The guard reads the config to keep it that way.
- **Deploy specs live in `tests/deploy`, outside `testDir`.** This is the strongest guarantee available about them: `ci.yml`'s e2e budget and the pull-request suite cannot reach them, which the before/after count of 234 in 22 files demonstrates.
- **Build order is a test, not a comment.** `__GEO_CITY__` is baked while Vite evaluates its config, so the manifest's file name can only appear in a chunk if the dataset existed first. Asserting that turns the ordering requirement in `deploy.yml` into something that fails loudly.
- **An allowlist, not a denylist.** A denylist of bad names would have to enumerate everything that could go wrong and would miss the next one.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] A self-contradictory favicon assertion in the tracer spec**
- **Found during:** Task 2, first gate run
- **Issue:** The spec asserted `expect(iconHref.startsWith('/')).toBe(false)` two lines after asserting `iconHref === ${base}favicon.svg`. The base is by construction a leading-slash path, so the second assertion was unsatisfiable. It was a leftover from trying to express "the href is not the origin-root path" in the wrong terms.
- **Fix:** Removed it. The `toBe` equality already proves the point — an unrewritten href would read `/favicon.svg`, one path segment short — and the comment now says so.
- **Files modified:** `tests/deploy/deployed-build.spec.ts`
- **Verification:** gate green; the equality assertion still fails if the favicon is not rewritten.
- **Committed in:** `b2c87fd`

**2. [Rule 1 - Bug] The allowlist compared bare names against prefixed paths**
- **Found during:** Task 3, first full gate run
- **Issue:** `GEO_STATIC_FILES` held `manifest.json` and `ATTRIBUTION.txt` while `walk()` yields `geo-city-data/…` paths, so the spec flagged the two legitimate geo files as offenders — the allowlist failed on a correct artifact.
- **Fix:** Store the two names with their `geo-city-data/` prefix, so the set is compared like for like.
- **Files modified:** `tests/deploy/dist-artifact.spec.ts`
- **Verification:** the allowlist test passes on a correct artifact and still reports every offender together.
- **Committed in:** `396c997`

**3. [Rule 1 - Bug] A wrong assertion about the built HTML's contents**
- **Found during:** Task 3, same run
- **Issue:** The artifact spec asserted the built `index.html` does not contain the string `wot-gdpr-stats-visualizer`. That was true of `vite.config.ts` — the config must not hardcode the repo name — but is false of a build whose base IS that subpath, where every asset URL contains it.
- **Fix:** Dropped the assertion. The "no origin baked into the CSP" point is already carried where it belongs, by the served spec's exact five-directive check.
- **Files modified:** `tests/deploy/dist-artifact.spec.ts`
- **Verification:** 9/9 gate tests pass.
- **Committed in:** `396c997`

**4. [Rule 3 - Blocking] `baseURL` typed `string | undefined`, and an unused destructure**
- **Found during:** Task 2's `pnpm run check`, then Task 3's `pnpm run lint`
- **Issue:** Playwright types the `baseURL` option as optional, so passing it to `new URL()` failed `tsc`. Later, the served-bytes test destructured `baseURL` without using it and eslint refused it.
- **Fix:** `basePathOf` now asserts the option is present before reading it — which is the right assertion, since a run without one cannot derive a base — and the unused destructure was removed.
- **Files modified:** `tests/deploy/deployed-build.spec.ts`
- **Verification:** `pnpm run check` reports 0 errors across 299 files; `pnpm run lint` clean.
- **Committed in:** `b2c87fd`, `396c997`

---

**Total deviations:** 4 auto-fixed (3 bugs, 1 blocking)
**Impact on plan:** All four were defects in the new test code itself, caught by the plan's own verify commands before commit. No production behaviour was changed beyond the one intended `base` line, and no scope was added.

## Issues Encountered

- The gate needed a real-format city file without network access. The plan's approach worked: `node scripts/geo/build-city-dataset.ts --csv tests/fixtures/geo/city-fixture.csv --month 2026-10` writes a `source: 'dbip'` manifest and a 1,221-byte gzipped container, which is the correct shape at fixture scale. It was removed afterwards, so `git status --short` shows nothing under `public/` or `dist/`.
- The reordering proof was run by moving `public/geo-city-data` aside rather than deleting it, so the passing state could be restored exactly. It failed 4 of 9 tests — the opt-in, both city artifact checks, and the served-bytes test — and the moving directory was restored and the gate re-run green.

## User Setup Required

Deferred by the owner (see Task 1). Carried in the README checklist (plan 07-06) and `07-VALIDATION.md`:
1. Repository visibility permitting GitHub Pages, and
2. Settings → Pages → Build and deployment → Source = "GitHub Actions".

Neither blocks any code in this phase. Both must be in place before the first real `deploy.yml` dispatch, which happens after this branch merges to `main`.

## Next Phase Readiness

- **07-02 (deploy workflow)** can use `tests/deploy/playwright.gate.config.ts` as its pre-upload gate, and point the shared `deployed-build.spec.ts` at the live URL by changing only `baseURL`. Note that `dist-artifact.spec.ts` is deliberately NOT part of that live run: it is a filesystem proof and has no meaning against a URL.
- **07-06 (README)** has the real-dispatch checklist item this plan deferred.
- One input the deploy job must supply: `VITE_BASE=/wot-gdpr-stats-visualizer/` for both the build and the preview, and `EXPECT_CITY_MONTH` for the artifact spec when the DB-IP month is known.

## Self-Check: PASSED

- Both task commits present (`b2c87fd`, `396c997`).
- All Task 2 criteria: base line count 1; `index.html` untouched and 0 CSP-directive lines changed in the diff; no `vite build` in the gate config and the `vite preview` webServer command present; `grep -rn GEO_FIXTURE tests/deploy` empty; `dist/index.html` carries the base-prefixed favicon; `playwright test --list` reports no `tests/deploy` entry.
- All Task 3 criteria: 9 gate tests pass (≥ 6 required); `grep -rn GEO_FIXTURE tests/deploy` empty; reordering caught (4 failures with the city directory removed before the build, then restored); `git status --short` clean of `public/` and `dist/`; `tests/e2e/guards/zero-network.spec.ts` 5/5 at the default base; the default suite unchanged at 234 tests in 22 files.
- Plan-level verification: `pnpm run lint`, `pnpm run check` and `pnpm run test:unit` (78 files, 2,397 tests) all pass; `package.json` and `pnpm-lock.yaml` unchanged (T-07-SC); `index.html` unchanged.

---
*Phase: 07-mobile-layout-public-deploy*
*Completed: 2026-10-05*
