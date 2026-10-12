---
phase: 06-login-ip-history-offline-geolocation
fixed_at: 2026-10-05T00:00:00Z
review_path: .planning/phases/06-login-ip-history-offline-geolocation/06-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 6: Code Review Fix Report

**Fixed at:** 2026-10-05
**Source review:** .planning/phases/06-login-ip-history-offline-geolocation/06-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 6 (WR-01, WR-02, WR-03, WR-04, WR-06, WR-07)
- Fixed: 6
- Skipped: 0

CR-01, CR-02 and WR-05 were excluded: `06-REVIEW-DISPOSITION.md` records them as already fixed (plans 06-15, 06-16, 06-17). The current source confirms it (`familiesOf` in `city-table.ts` already asks `mappedIpv4`).

**Verification:** run in the main checkout, because `workflow.use_worktrees` is `false` in `.planning/config.json`, so no worktree was created. After the last fix: `tsc -b` clean, `svelte-check` 0 errors and 0 warnings, `eslint .` clean, `prettier --check .` clean, `vitest run` 77 files and 2363 tests passing. Playwright e2e was not run.

## Fixed Issues

### WR-06: `build-city-dataset.ts --fixture --download` overwrites the committed fixture with real data

**Files modified:** `scripts/geo/build-city-dataset.ts`
**Commit:** a7fe929
**Applied fix:** `parseArgs` now refuses `--fixture` combined with `--download`, with the same message as `build-country-table.ts`. I ran the combination and it exits with the usage error before any download.

### WR-03: The worker-only import ban misses sibling relative imports

**Files modified:** `eslint.config.js`, `tests/unit/guards/lint-guards.test.ts`
**Commit:** b052bb7
**Applied fix:** Added `**/country-table*`, `**/country-lookup*` and `**/city-table*` to the `no-restricted-imports` pattern group. I used the `**/` form rather than the `./` spelling the review suggested, because it matches every spelling. Added three probes that lint `./country-table.ts`, `./country-lookup.ts` and `./city-table.ts` as `src/lib/geo/__lint_probe__.ts`. The probes fail without the config change and pass with it.

### WR-04: The worker's network ban is a denylist with real holes

**Files modified:** `eslint.config.js`, `tests/unit/guards/lint-guards.test.ts`
**Commit:** c06fc05
**Applied fix:**
- Moved the network globals and properties lists into the constants `NETWORK_GLOBALS` and `NETWORK_PROPERTIES`.
- For all of `src/`: enabled `no-eval`, `no-new-func`, `no-implied-eval`, and a `no-restricted-syntax` ban on `ImportExpression`. Nothing under `src/` uses dynamic `import()`.
- New block 7b for `src/lib/worker/**/*.ts`: re-spreads both lists and adds `Worker`, `SharedWorker` and `caches`, including the `self.` and `globalThis.` spellings. The main-thread `new Worker` in `src/lib/import/ingest-client.ts` stays legal.
- Probes cover each hole, the full network list still firing in the worker block (an override replaces rather than merges), and the main-thread client staying allowed.
- Scope decision: the `ImportExpression` ban applies to all of `src/` rather than only the worker, since the project has no lazy chunks (see the comment in `WorldMap.svelte`).

### WR-01: Container reader allocates from header counts before validating them

**Files modified:** `src/lib/geo/range-table.ts`, `tests/unit/geo/range-table.test.ts`
**Commit:** 90c0c11
**Applied fix:**
- `readTable` now refuses a header whose `v4Count * 2 + v6Count * 3` plus the header and place bytes exceeds the buffer, before any plane is allocated.
- `decodePlaces` counts 0x0a bytes on the raw section and requires the count to match `placeCount` before decoding or splitting. The match is exact: a trailing newline terminates the last place, and the old `split` semantics are preserved.
- Added two tests that fail on the old source. One counts large typed-array constructions. The other asserts that `String.prototype.split` is never called.

### WR-02: The gzip-bomb cap is looser than the decoder's own cap, and peak memory is doubled

**Files modified:** `src/lib/geo/city-table.ts`, `tests/unit/geo/city-table.test.ts`
**Commit:** c972de0
**Applied fix:** `MAX_CITY_INFLATED_BYTES` is now `MAX_CITY_TABLE_BYTES` (96 MB, down from 200 MB). `inflateIfGzip` inflates into a single preallocated `Uint8Array(maxBytes)` and returns `subarray(0, total)`, which removes the chunk list and the final copy. Added a test pinning the two caps together. `city-table.ts` imports `MAX_CITY_TABLE_BYTES` from `range-table.ts`, which it already imported from. It is worker-only, so the import rule is not affected.

### WR-07: The city loader's documented plain-body path is unreachable in production

**Files modified:** `src/lib/geo/city-fetch.ts`, `src/lib/geo/city-table.ts`, `src/lib/worker/ingest.worker.ts`, `src/lib/features/logins/CityOptIn.svelte`
**Commit:** 7834948
**Applied fix:** I took the review's "gzip-only (simplest)" option. The comments in all four files now state that the manifest `bytes` and `sha256` describe the gzipped file and that a host which decodes `Content-Encoding` is refused by the length and hash checks. The "host strips gzip" claims are gone. The plain branch of `inflateIfGzip` is documented as reachable only with `sha256: null` or from tests. No behaviour changed. This is a documentation-only fix, flagged for human verification of the chosen contract.

## Skipped Issues

None.

---

_Fixed: 2026-10-05_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
