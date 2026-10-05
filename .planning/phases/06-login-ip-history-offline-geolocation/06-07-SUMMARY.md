---
phase: 06-login-ip-history-offline-geolocation
plan: 07
subsystem: infra
tags: [world-atlas, d3-geo, topojson-client, build-time-generation, svg, choropleth, offline-geo]

requires:
  - phase: 06-login-ip-history-offline-geolocation
    provides: "the committed DB-IP range table and the GEO_FIXTURE seam (06-04, 06-06), so the map's alpha-2 keys are the codes the worker already resolves"
  - phase: 04-activity-time-dashboards
    provides: "the --ramp-0..5 tokens and the contrast guard the choropleth paints with (06-12)"
provides:
  - "src/lib/geo/world-map.generated.ts — 235 committed per-country SVG path shapes, a viewBox and the undrawable-code list; plain data that imports nothing"
  - "scripts/geo/build-world-map.ts — the Node generator, with --check and --against, run as `pnpm run geo:map`"
  - "the three build-time-only devDependencies (world-atlas 2.0.2, d3-geo 3.1.1, topojson-client 3.1.0), exact-pinned, absent from `dependencies`"
  - "four guards in tests/unit/geo/world-map.test.ts: shape invariants, hybrid coverage, byte-for-byte reproducibility, and a runtime-dependency ban checked in package.json, across src/, in the generated module and in dist/"
affects: [06-12, 06-13, phase-07, ACTIVITY-06]

actuals:
  tokens: 43035
  tasks: 2
  commits: 7
plan_head_before: 44845f0efc76046c15b29d150c578a2874ebab33
plan_head_after: 11578b5c098b71e5225046a021468870ca957682
commits_note: "7 measured from plan_head_before: 4 production (feat, test, feat, refactor) plus 3 documentation commits (SUMMARY, self-check, STATE/ROADMAP). plan_head_after is the head at the moment the ledger was measured; the commit that records the ledger is necessarily one commit later than its own hash."

tech-stack:
  added:
    - "world-atlas 2.0.2 (devDependency, build-time only)"
    - "d3-geo 3.1.1 (devDependency, build-time only)"
    - "topojson-client 3.1.0 (devDependency, build-time only)"
  patterns:
    - "build-time generation into a COMMITTED TypeScript data module, checked by a --check mode a test runs as a child process"
    - "the ISO 3166-1 numeric-to-alpha-2 conversion is Intl.getCanonicalLocales('und-<id>'), never a hand-typed table"

key-files:
  created:
    - "scripts/geo/build-world-map.ts"
    - "src/lib/geo/world-map.generated.ts"
    - "tests/unit/geo/world-map.test.ts"
  modified:
    - "package.json"
    - "pnpm-lock.yaml"
    - ".prettierignore"

key-decisions:
  - "The map is a HYBRID, not a single atlas: 110m as the base plus only those 50m features whose alpha-2 the base did not take. The guard that skips an alpha-2 already present is what stops a country being drawn twice at two resolutions."
  - "The undrawable-code list is a constant INSIDE the generator and is written into the generated module, so the map caption's 'not drawn' count comes from the same run that drew the shapes and cannot drift from them."
  - "The generated header records the package versions read from this repository's own devDependencies rather than from the installed package.json. A version bump therefore FAILS --check and forces a regeneration, instead of silently changing the map."
  - "The map data imports nothing, and that is asserted. It is the strongest form of the runtime-dependency ban: a file that pulls in nothing cannot drag a projection library into the main chunk, whatever else changes."
  - "Reproducibility is proven in both directions. The altered-copy case runs through --against, and the UNALTERED copy is asserted to pass through the same path first, so a non-zero exit cannot come from the option not existing."

patterns-established:
  - "A committed generated artifact carries a --check mode, and the check is a TEST (spawned as a child process) rather than a script nobody runs."
  - "A build-time-only dependency is guarded at four levels: package.json placement, a scan of src/, an import-free generated module, and a scan of dist/ when a build has been run."
  - "The atlas values are narrowed to three small structural interfaces (AtlasFeature, PathGenerator, AtlasTopology) rather than `any`, since no @types are installed for any of the three packages."

requirements-completed: [ACTIVITY-06]

coverage:
  - id: D1
    description: "A committed, deterministic per-country path module exists: WORLD_VIEWBOX, WORLD_SHAPES and the WorldShape interface, generated from the atlas at build time by a Node script."
    requirement: ACTIVITY-06
    verification:
      - kind: unit
        ref: "tests/unit/geo/world-map.test.ts#the generated world map"
        status: pass
      - kind: other
        ref: "pnpm run geo:map:check (exit 0 on the committed file)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The map covers what a login history reaches: SG, HK, MT, BH, MC and LI are drawn, XK comes from the feature named Kosovo, Antarctica is dropped, and 235 shapes stay inside the UI-SPEC's 238 node bound."
    requirement: ACTIVITY-06
    verification:
      - kind: unit
        ref: "tests/unit/geo/world-map.test.ts#the map covers what a login history reaches"
        status: pass
    human_judgment: false
  - id: D3
    description: "Regenerating twice leaves the committed file byte-identical, and --check fails on an altered copy — so a hand edit or a drifted regeneration cannot ship unnoticed."
    requirement: ACTIVITY-06
    verification:
      - kind: unit
        ref: "tests/unit/geo/world-map.test.ts#the committed map is exactly what the generator produces"
        status: pass
      - kind: other
        ref: "two consecutive `pnpm run geo:map` runs, sha256 1b3e846f790282e08a90aad7f72968fdbd017fa2c5a45d31c9682e3273dec8e5 both times"
        status: pass
    human_judgment: false
  - id: D4
    description: "No mapping library can reach the shipped bundle: the three packages are devDependencies only, are named nowhere under src/, and appear nowhere in a real `pnpm run build` output."
    requirement: ACTIVITY-06
    verification:
      - kind: unit
        ref: "tests/unit/geo/world-map.test.ts#no mapping library can reach the shipped bundle"
        status: pass
      - kind: other
        ref: "pnpm run build then grep -rl 'world-atlas\\|d3-geo\\|topojson-client' dist/ — no match"
        status: pass
    human_judgment: false
  - id: D5
    description: "The map is legibly rendered on screen: the contrast of the choropleth ramp against the map background, and the tiny-country marker being visible and hoverable."
    requirement: ACTIVITY-06
    verification: []
    human_judgment: true
    rationale: "This plan ships DATA, not pixels. The visible result is plan 06-12's WorldMap.svelte against the UI-SPEC, and no assertion in this plan can judge whether a 235-shape choropleth reads well at phone width. Coverage not determined at authoring time — verifier must classify."

# Metrics
duration: 26min
completed: 2026-10-03
status: complete
---

# Phase 06 Plan 07: Build-time world map generation Summary

**235 committed per-country SVG path shapes generated from world-atlas 110m+50m at build time, with the three mapping packages provably unable to reach the shipped bundle**

## Performance

- **Duration:** 26 min
- **Started:** 2026-10-03T19:58Z
- **Completed:** 2026-10-03T20:24Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- **The map exists as data, not as a library.** `src/lib/geo/world-map.generated.ts` holds `WORLD_VIEWBOX`, `WORLD_SHAPES` and `WorldShape`, and imports nothing at all. `world-atlas`, `d3-geo` and `topojson-client` are exact-pinned devDependencies that only `scripts/geo/build-world-map.ts` ever names.
- **235 shapes, not 174.** The 110m atlas alone has no polygon for 61 DB-IP codes, including six a real login history reaches constantly (SG, HK, MT, BH, MC, LI). The 50m atlas fills exactly those gaps and nothing else.
- **No ISO table exists.** `Intl.getCanonicalLocales('und-276')` is `und-DE`; the platform's own CLDR data is the mapping, and it is measured over every id in the atlas.
- **Reproducibility is a test, not a promise.** `--check` regenerates in memory and compares byte for byte; the test proves it can fail by running it against an altered copy through `--against`.
- **The runtime-dependency ban is proven, not inspected.** Four independent guards, and the `dist/` one was demonstrated failing on a planted leak before being left in place.

## Task Commits

Each task was committed atomically:

1. **Task 1 (tracer): the three build-time packages, the generator, a 110m module** - `4bf621e` (feat)
2. **Task 2 RED: failing tests for coverage, reproducibility and the ban** - `79c99f3` (test)
3. **Task 2 GREEN: the hybrid, `--against`, `NO_POLYGON_CODES`, structural types** - `001a6b0` (feat)
4. **Task 2 REFACTOR: resolve the write path only where it writes** - `3ad38a2` (refactor)

**Plan metadata:** this commit (docs: complete plan)

_Note: Task 2 is a TDD task, so it carries the test → feat → refactor triple._

## Files Created/Modified

- `scripts/geo/build-world-map.ts` - the generator. Loads the 110m and 50m `world-atlas` topologies through `createRequire`, keys each feature by alpha-2, projects with `geoNaturalEarth1` onto a 960x500 sphere, and emits the module. `--check` and `--against` never write.
- `src/lib/geo/world-map.generated.ts` - 235 shapes, 15.3 KB of path data per the generator, 125 KB of file. Generated, committed, `.prettierignore`d, and covered by tsc and ESLint.
- `tests/unit/geo/world-map.test.ts` - 23 tests in four groups: shape invariants, hybrid coverage, reproducibility, and the runtime-dependency ban.
- `package.json` - three devDependencies at exact versions, plus `geo:map` and `geo:map:check`. `dependencies` is byte-identical.
- `.prettierignore` - the generated map, with the reason recorded.
- `pnpm-lock.yaml` - the three packages.

## Decisions Made

- **The hybrid is defined by the skip rule, not by a list.** A 50m feature is added only when `byIso` does not already hold its code. That single condition is what makes it a hybrid rather than a 50m map wearing a 110m label, and it is why Antarctica appears in the dropped count twice (once per atlas) without being drawn.
- **`NO_POLYGON_CODES` is a generator constant, not a test constant.** The map caption in 06-12 says how many DB-IP codes are undrawable, and that number is only honest if the same run that drew the shapes produced it.
- **The header records versions read from this repository's `package.json`, not from the installed packages.** A dependency bump then fails `--check` and forces a regeneration, which is a real guard; reading the installed version would have made the header decorative.
- **The dependency ban is asserted at four levels** (package.json placement, a scan of `src/`, an import-free generated module, and `dist/`). The plan specified the first two; the third is the one that cannot be routed around and the fourth is the one that matches what the claim is actually about — the artifact, not the source.
- **The `--against` test asserts the passing case first.** Without it, a non-zero exit could come from the generator rejecting an unknown flag, and the "the check can fail" test would have passed for the wrong reason.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `readFileSync` and `mkdir` were imported from the wrong modules**
- **Found during:** Task 1
- **Issue:** The script imported `mkdir, readFile, writeFile` from `node:fs/promises` but called `readFileSync` (not imported) and then a `mkdir` that resolved to the `node:fs` callback form once `readFileSync` was added, so the generator failed twice with a bare `TypeError` before writing anything.
- **Fix:** `readFileSync` from `node:fs`, the rest from `node:fs/promises`.
- **Files modified:** `scripts/geo/build-world-map.ts`
- **Verification:** `pnpm run geo:map` prints a summary line and writes the module.
- **Committed in:** `4bf621e`

**2. [Rule 3 - Blocking] `@typescript-eslint/no-explicit-any` is an error in this repo's ESLint config**
- **Found during:** Task 2 GREEN
- **Issue:** The untyped `world-atlas` / `topojson-client` values were annotated `any` in eight places. `tsconfig.node.json` permits implicit `any`, but `tseslint.configs.recommended` makes the EXPLICIT annotation an error, so `pnpm run lint` failed.
- **Fix:** Three small structural interfaces — `AtlasFeature` (the only three fields the script reads; `geometry` stays opaque for d3-geo), `PathGenerator` (the three call shapes used) and `AtlasTopology` — replace every annotation. No `@types` package was installed, so the plan's "no type packages" constraint holds.
- **Files modified:** `scripts/geo/build-world-map.ts`
- **Verification:** `pnpm run lint` green; `pnpm run check` green.
- **Committed in:** `001a6b0`

**3. [Rule 2 - Missing Critical] The `dist/` guard was proven rather than assumed**
- **Found during:** Task 2 GREEN
- **Issue:** The bundle-level dependency ban the plan only described at source level is a no-op if it cannot fail. It is also conditional on `dist/` existing, so it can pass vacuously.
- **Fix:** Ran `pnpm run build`, then planted `dist/assets/leak-probe.js` containing the string `world-atlas` and confirmed the test FAILS naming that file, then removed the probe and confirmed it passes on the real build. The condition on `dist/` is stated in the test's own comment as vacuous-when-absent, so no reader mistakes it for a live check.
- **Files modified:** none (a verification step, not a change)
- **Verification:** `AssertionError: expected [ 'assets/leak-probe.js' ] to deeply equal []`, then 23/23 green.
- **Committed in:** n/a (verification of `001a6b0`)

---

**Total deviations:** 3 auto-fixed (1 bug, 1 blocking, 1 missing critical)
**Impact on plan:** All three were correctness-of-build or correctness-of-guard problems inside this plan's own files. No scope creep, no new dependency, and the plan's acceptance conditions are all met as written.

## Issues Encountered

- **The shape count is 235, where RESEARCH measured 238.** The difference is fully accounted for: 235 = 174 from 110m (Antarctica, N. Cyprus and Somaliland dropped) + the 61 the 50m atlas adds. RESEARCH's 238 is 177 base features + 61, which counts Antarctica and the two unnamed territories. The plan's own rule ("drop Antarctica; features with no id and no known name are dropped") produces 235, so 235 is the answer and the UI-SPEC's 238 is a ceiling, not a target. **Plan 06-12's node-count assertion must use 235, not 238.**
- **The 50m atlas has two more id-less features than the plan named.** Alongside Somaliland and N. Cyprus it carries "Indian Ocean Ter." and "Siachen Glacier"; both are dropped by the same rule, neither is a DB-IP code, and neither was in the plan's enumeration. No action needed — recorded so a reader who counts `dropped=8` can account for all of it.
- **One `pnpm run test:unit` run exited non-zero and did not reproduce.** Three subsequent full runs were 1908/1908 green, as was the run before it. The most likely cause is the planted `dist/assets/leak-probe.js` still being on disk when that run started, which is the `dist/` guard doing its job. The current tree is green; if it recurs, the `dist/` guard is the first thing to look at.

## Verification run

| Command | Result |
|---------|--------|
| `pnpm run geo:map:check` | exit 0, `shapes=235 dropped=8` |
| `pnpm run geo:map` x2 | byte-identical, sha256 `1b3e846f…` both runs |
| `pnpm exec vitest run tests/unit/geo/world-map.test.ts` | 23 passed |
| `pnpm run test:unit` | 1908 passed (63 files) |
| `pnpm run check` | clean |
| `pnpm run lint` | clean |
| `pnpm run build` | `index-uo-ECFis.js` 157.86 kB, worker 4,702.54 kB, 3 chunks — unchanged from before this plan |
| `grep -rl 'world-atlas\|d3-geo\|topojson-client' dist/` | no match |
| `git diff main...HEAD -- package.json` | `dependencies` untouched; this plan adds three devDependencies and `geo:map` / `geo:map:check` |

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **For 06-12 (`WorldMap.svelte`):** import `WORLD_SHAPES`, `WORLD_VIEWBOX` and `NO_POLYGON_CODES` **statically**. A dynamic `import()` would emit a lazy chunk the browser requests after load, which is exactly what the zero-network Playwright guard counts (RESEARCH Pitfall 1). The module is currently imported by nothing, so the "joins the main chunk" half of that must_have is 06-12's to make; the half this plan can guarantee — that it imports nothing and no mapping package appears in `dist/` — is asserted.
- **The node-count assertion should read 235**, plus the tiny countries with logins plus three, per the UI-SPEC.
- **Node types available:** `WorldShape` is `{ iso, d, cx, cy, tiny }`, all `readonly`. `tiny` is true where the projected bounding box is under 12 px², which is the UI-SPEC's marker-circle trigger; `cx`/`cy` are the centroids for that marker.
- **`NO_POLYGON_CODES` has 14 entries** and is the exact set of DB-IP codes the map cannot draw, so the caption's count is a constant rather than a runtime subtraction.

---

*Phase: 06-login-ip-history-offline-geolocation*
*Plan: 07*
*Completed: 2026-10-03*

## Self-Check: PASSED

All four created/modified artifacts exist on disk, all five commits (`4bf621e`, `79c99f3`, `001a6b0`, `3ad38a2`, `35a611d`) are reachable, and the generated module exports all four required symbols. Every plan-level verification command was re-run against the committed tree: `geo:map:check` exit 0, two regenerations byte-identical, the world-map suite 23/23, the full unit suite 1908/1908, `check` clean, `lint` clean, `build` green, and no build-time package anywhere in `dist/`.
