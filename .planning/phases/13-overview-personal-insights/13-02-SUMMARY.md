---
phase: 13-overview-personal-insights
plan: 02
subsystem: build-tooling
tags: [node, build-script, validation, eslint, worker-boundary, zero-network, lookup]

requires:
  - phase: 13-overview-personal-insights
    provides: "plan 13-01's overview view contract and the OverviewClassKey literals"
provides:
  - "The tank-table generator (fail-closed validation, canonical output, offline --check, key handling)"
  - "The committed generated module in its EMPTY form (count 0) — the repository holds no Wargaming data"
  - "overview-lookup.ts — the key-free lookup answering both nation:tag and numeric tank_id"
  - "vehicle-table.ts — the one module that imports the generated table, statically"
  - "The ESLint worker-only rule for the tank table, with its probes, plus the key/host/dynamic-import guard"
affects: [13-03, 13-04, 13-07, 13-15, overview, worker, eslint]

actuals:
  tokens: 19252
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "A build-time generator that is a plain Node .ts file (native type stripping), with a module-local main guard so tests can import its helpers"
    - "Fail-closed validation of untrusted API payloads: a rejected payload writes NOTHING and the error names the rule, never the payload"
    - "The generated table is inlined into the worker chunk through ONE static import; a dynamic import would be a post-load request"

key-files:
  created:
    - scripts/vehicles/build-vehicle-table.ts
    - scripts/vehicles/lib/vehicle-table-build.ts
    - src/lib/features/overview/vehicle-table.generated.ts
    - src/lib/features/overview/overview-lookup.ts
    - src/lib/features/overview/vehicle-table.ts
    - tests/unit/overview/vehicle-table.test.ts
    - tests/unit/overview/vehicle-lookup.test.ts
    - tests/unit/guards/vehicle-table-guard.test.ts
  modified:
    - eslint.config.js
    - package.json
    - .prettierignore
    - tests/unit/guards/lint-guards.test.ts

key-decisions:
  - "The committed generated module holds NO vehicle rows (count 0). Every lookup is a miss, and the page falls back to the tag-derived name and 'class unknown' (D-09), until plan 13-15 runs the generator behind the Terms-of-Use checkpoint (D-07, D-23)."
  - "overview-lookup.ts declares its OWN VehicleClassKey rather than importing OverviewClassKey from overview-shared.ts, so the lookup stays free of any import the worker-only lint pattern would catch; the literals are identical, so the values are assignable."
  - "The lookup's `size` is the table's ROW COUNT — the number the generated metadata counts — not the number of distinct map keys."
  - "The tank-table guard asserts which files name a tank-table IMPORT SPECIFIER, not which files contain the words: the pre-existing Vehicles pane already calls its own statistics table a 'vehicle table'."

patterns-established:
  - "Generated data files are excluded from Prettier (.prettierignore) rather than reformatted, so the generator's byte-stable output and the formatter cannot fight: the same precedent as world-map.generated.ts."
  - "A generated module imports NOTHING and is reached through exactly one module, which is the module the ESLint worker-boundary rule exempts."

requirements-completed: [INSIGHT-06]

coverage:
  - id: D1
    description: "The fail-closed generator: validatePages rejects every unusable field, the key never reaches the output, --empty writes the committed module, and --check proves it offline."
    requirement: INSIGHT-06
    verification:
      - kind: unit
        ref: tests/unit/overview/vehicle-table.test.ts
        status: pass
      - kind: other
        ref: "pnpm run vehicles:table:check"
        status: pass
      - kind: other
        ref: "pnpm run check"
        status: pass
    human_judgment: false
  - id: D2
    description: "The committed generated module holds no vehicle rows, so the repository holds no Wargaming data before the Terms-of-Use checkpoint."
    requirement: INSIGHT-06
    verification:
      - kind: unit
        ref: tests/unit/overview/vehicle-table.test.ts#the committed module
        status: pass
      - kind: other
        ref: "pnpm run vehicles:table:check (count=0)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The key-free lookup answers both nation:tag and numeric tank_id, applies the id pattern, and derives a fallback name from the tag without guessing."
    requirement: INSIGHT-06
    verification:
      - kind: unit
        ref: tests/unit/overview/vehicle-lookup.test.ts
        status: pass
    human_judgment: false
  - id: D4
    description: "The tank table is worker-only: one static importer, the ESLint ban outside the worker, and a guard that no dynamic import, key literal or API host reaches src/ or the built output."
    requirement: INSIGHT-06
    verification:
      - kind: unit
        ref: tests/unit/guards/lint-guards.test.ts#worker-boundary import ban — no-restricted-imports (the tank table)
        status: pass
      - kind: unit
        ref: tests/unit/guards/vehicle-table-guard.test.ts
        status: pass
      - kind: other
        ref: "pnpm run lint"
        status: pass
    human_judgment: false

# Metrics
duration: 15min
completed: 2026-10-23
status: complete
---

# Phase 13 Plan 02: The tank-table machinery, with the table itself left empty

**A fail-closed generator that turns an untrusted API payload into a committed module, a key-free lookup that answers both vehicle keys, and the lint and guard rules that keep the table in the worker chunk and the key out of the repository — with the committed table holding zero rows.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-10-23T06:11:00Z
- **Completed:** 2026-10-23T06:26:00Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments

- `pnpm run vehicles:table` and `pnpm run vehicles:table:check` exist and cost no dependency: the generator is a plain Node `.ts` file beside `scripts/geo/`, and the validation fails closed on a non-`ok` status, a bad id, tag, nation, name, type or tier, a duplicate key, an empty result or an oversized result — writing NOTHING when it refuses.
- The key is read from the environment or from one line of the gitignored `.env.local`, and it reaches the request and nothing else: no log line, no error message, no generated file.
- `src/lib/features/overview/vehicle-table.generated.ts` is committed in its EMPTY form (count 0), so the repository holds no Wargaming data at all until plan 13-15 passes the Terms-of-Use checkpoint. Every lookup is therefore a miss today, and the page falls back to the tag-derived name and an unknown class (D-09).
- `overview-lookup.ts` answers both keys — `nation:tag` and the numeric record id — with a strict id pattern and a tag-derived fallback name, and it imports nothing, so the page cannot reach the table through it.
- `vehicle-table.ts` is the single module that imports the generated table, statically, so the table is inlined into the worker chunk and no request is ever made for it.
- The ESLint worker-boundary rule now bans the tank table outside the worker, in the SAME block as the geo tables and the fflate ban, and a new guard proves that no file under `src/` (or the built output) names the key parameter, the environment variable, the API host or a dynamic import of the table.

## Task Commits

Each task was committed atomically:

1. **Task 1: The generator — fail-closed validation, canonical output, offline check, key handling, and the empty committed module** - `72838bf` (feat)
2. **Task 2: The lookup, the one table importer and the worker-only rule with its probes and guards** - `1ed07dd` (feat)

## Files Created/Modified

- `scripts/vehicles/lib/vehicle-table-build.ts` - The pure half: `VEHICLE_TYPES`, `MAX_ROWS`, `validatePages`, `validateRows`, `rowsHash`, `renderModule`, `readApplicationId`. No network, no filesystem.
- `scripts/vehicles/build-vehicle-table.ts` - The generator: `--out`, `--from`, `--empty`, `--check`, `--against` and the test-only `--key-file`. Fetch mode is the only mode that touches the network, and only on the maintainer's machine.
- `src/lib/features/overview/vehicle-table.generated.ts` - The committed table, in its empty form. Imports nothing.
- `src/lib/features/overview/overview-lookup.ts` - `VehicleClassKey`, `VehicleInfo`, `VehicleLookup`, `createVehicleLookup`, `tagFallbackName`, `nationOfKey`. Imports nothing.
- `src/lib/features/overview/vehicle-table.ts` - The one importer of the generated table; exports `defaultVehicleLookup`.
- `eslint.config.js` - The tank-table entry in the worker-boundary `no-restricted-imports` group, its message, and the one exemption.
- `package.json` - The `vehicles:table` and `vehicles:table:check` scripts.
- `.prettierignore` - The generated table, for the same reason the world map is there.
- `tests/unit/overview/vehicle-table.test.ts` - The generator's rules, its key handling, and its modes as a child process.
- `tests/unit/overview/vehicle-lookup.test.ts` - The lookup's two keys, its id pattern, its fallback name and its prototype-key misses.
- `tests/unit/guards/vehicle-table-guard.test.ts` - The key, the host, the dynamic import and the importer set.
- `tests/unit/guards/lint-guards.test.ts` - The tank-table lint probes, beside the geo and fflate probes that share the same block.

## Decisions Made

- **The table stays empty in this plan.** The generator, the validation, the lookup, the fallbacks and the guards all ship and are proved on synthetic payloads; the real rows are a one-way commit to a public repository (D-07) and belong to plan 13-15, behind the Terms-of-Use checkpoint (D-23).
- **`overview-lookup.ts` declares its own `VehicleClassKey`.** Importing `OverviewClassKey` from `overview-shared.ts` would have been fine on its own, but the plan asks this module to be import-free, and the shared module is on the page's side of the worker boundary. The literals are identical, so a class key is assignable to the tile contract's class key with no conversion.
- **`size` is the row count.** The generated metadata counts rows, and the lookup's `size` is that count, so `defaultVehicleLookup.size === VEHICLE_TABLE_META.count` is a single fact rather than two.
- **The fallback name is clamped to 60 characters**, matching the generator's own name-length rule, so the page never has to truncate a name it was given.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The test-only env-file flag is `--key-file`, not `--env-file`**
- **Found during:** Task 1 (the generator's flags)
- **Issue:** The plan names an undocumented `--env-file <path>` flag "used only by tests". Node itself owns `--env-file`, and it intercepts the flag before the script ever sees it: the child died with `node: /path: not found` instead of reaching the script.
- **Fix:** The flag is called `--key-file`. It does exactly what the plan asked — it points the env-file lookup at a path that does not exist, so the test can prove the script fails closed without reading the repository's own `.env.local`.
- **Files modified:** `scripts/vehicles/build-vehicle-table.ts`, `tests/unit/overview/vehicle-table.test.ts`
- **Verification:** the "fails closed when there is no key and no env file" case passes, with the exact message and nothing written.
- **Committed in:** `72838bf`

**2. [Rule 2 - Missing critical] The API error message is redacted of the key**
- **Found during:** Task 1 (the fetch mode)
- **Issue:** The plan says an error page prints `error.code` and `error.message` and never `error.value`, because `value` echoes the offending parameter — the key. But T-13-06 states the stronger rule: the key must never appear "in a log line or an error message". The message is payload too, and the plan does not say the message cannot echo the key.
- **Fix:** The key is replaced with `[redacted]` in the message before it is printed. `error.value` is still never read.
- **Files modified:** `scripts/vehicles/build-vehicle-table.ts`
- **Verification:** the redaction is in the single print path; the unit suite covers the surrounding fail-closed behaviour.
- **Committed in:** `72838bf`

**3. [Rule 3 - Blocking] The generated module is excluded from Prettier**
- **Found during:** Task 1 (`pnpm run lint`)
- **Issue:** Every string in the generated module is written with `JSON.stringify`, so the file uses double quotes where Prettier wants single ones — and `prettier --check .` failed on it. Worse, letting Prettier rewrite it would have made `pnpm run vehicles:table:check` fail against a file Prettier had edited.
- **Fix:** `src/lib/features/overview/vehicle-table.generated.ts` is added to `.prettierignore`, with the same reasoning and the same precedent as `src/lib/geo/world-map.generated.ts`. `tsc` and ESLint still cover the file.
- **Files modified:** `.prettierignore`
- **Verification:** `pnpm run lint` exits 0.
- **Committed in:** `72838bf`

**4. [Rule 1 - Bug] Control characters are checked by code point, not by a regular expression**
- **Found during:** Task 1 (`pnpm run lint`)
- **Issue:** The name rule was written as a literal control range in a pattern, which `no-control-regex` rightly refuses, and which is unreadable in a diff.
- **Fix:** `forbiddenNameCharacter()` walks the string's code points and reports a control character (below U+0020, or U+007F) or an angle bracket. The rule itself is unchanged.
- **Files modified:** `scripts/vehicles/lib/vehicle-table-build.ts`
- **Verification:** the control-character and angle-bracket rejection cases pass; `pnpm run lint` exits 0.
- **Committed in:** `72838bf`

**5. [Rule 3 - Blocking] The tank-table guard asserts IMPORT SPECIFIERS, not raw source text**
- **Found during:** Task 2 (the guard)
- **Issue:** The plan asks the guard to assert that "the only files under src/ whose source mentions the specifier text 'vehicle-table' are vehicle-table.ts itself, files under src/lib/worker/". The pre-existing Vehicles pane (`src/lib/features/vehicles/`) already uses the words "vehicle table" for its own per-vehicle statistics table — in `VehicleTable.svelte`'s `data-testid`, and in two module headers — so a raw-text scan would flag four files that import nothing of the sort, and the plan's assertion could never hold.
- **Fix:** The guard reads the IMPORT SPECIFIERS of every file under `src/` and asserts that only `vehicle-table.ts` and the worker files name a tank-table specifier. That is the claim that actually matters — a main-thread import of the table — and it is strictly stronger than a text scan, because it names the mechanism rather than a phrase.
- **Files modified:** `tests/unit/guards/vehicle-table-guard.test.ts`
- **Verification:** the guard passes, and the Vehicles pane files are correctly not flagged.
- **Committed in:** `1ed07dd`

---

**Total deviations:** 5 auto-fixed (3 blocking, 1 missing critical, 1 bug)
**Impact on plan:** All five are corrections to the plan's mechanics, not changes to its intent. The generator, the empty table, the lookup, the lint rule and the guards all behave exactly as the plan describes; four of the five are places where the plan named a mechanism that does not exist as written (a Node-owned flag, a formatter that fights the generator, a lint rule about control characters, a phrase that another feature already uses).

## Issues Encountered

- Node intercepts `--env-file` before the script sees it (deviation 1). The first run of the fail-closed test failed with Node's own error rather than the script's message, which is what surfaced it.

## User Setup Required

None — no external service configuration required. The application key is needed only by plan 13-15, which runs the generator on the maintainer's machine; no key was read, needed or written by this plan.

## Next Phase Readiness

- The generator, the validation rules, the lookup and the fallbacks are proved on synthetic payloads and need no network or key.
- The committed table is empty, so every lookup today falls back to the tag-derived name and an unknown class (D-09). Plans that consume the lookup (13-03 onward) must expect `classKey: 'unknown'` and `tier: null` until 13-15 commits the real rows.
- Plan 13-15 owns the one-way step: running `pnpm run vehicles:table` on the maintainer's machine behind the Terms-of-Use checkpoint (D-07, D-23), and the copyright line and the link to the official game site the API Policy asks for.

## Self-Check: PASSED

- All nine created files exist on disk; both task commits are ancestors of HEAD.
- Every acceptance criterion re-run: `pnpm exec vitest run tests/unit/overview/vehicle-table.test.ts` (42 passed), `pnpm run vehicles:table:check` (count=0), `pnpm run check` (0 errors), `pnpm exec vitest run tests/unit/overview/vehicle-lookup.test.ts tests/unit/guards/vehicle-table-guard.test.ts tests/unit/guards/lint-guards.test.ts` (139 passed), `pnpm run lint` (0 problems), and the full `pnpm run test:unit` (140 files, 4251 passed).
- `git diff --stat` shows no file under `src/` other than the three feature files, and no environment file.

---
*Phase: 13-overview-personal-insights*
*Completed: 2026-10-23*
