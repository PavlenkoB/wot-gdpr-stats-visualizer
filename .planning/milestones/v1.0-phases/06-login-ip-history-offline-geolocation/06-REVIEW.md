---
phase: 06-login-ip-history-offline-geolocation
reviewed: 2026-10-04T00:00:00Z
depth: standard
files_reviewed: 51
files_reviewed_list:
  - .github/workflows/ci.yml
  - eslint.config.js
  - package.json
  - playwright.config.ts
  - scripts/geo/build-city-dataset.ts
  - scripts/geo/build-country-table.ts
  - scripts/geo/build-world-map.ts
  - scripts/geo/lib/city-manifest.ts
  - scripts/geo/lib/csv-ranges.ts
  - scripts/geo/lib/download.ts
  - scripts/geo/lib/geo-alias.ts
  - src/lib/core/types/worker-messages.ts
  - src/lib/core/windowing.ts
  - src/lib/features/logins/CityList.svelte
  - src/lib/features/logins/CityOptIn.svelte
  - src/lib/features/logins/CountryList.svelte
  - src/lib/features/logins/LoginHistory.svelte
  - src/lib/features/logins/LoginMapSection.svelte
  - src/lib/features/logins/LoginSummary.svelte
  - src/lib/features/logins/LoginTable.svelte
  - src/lib/features/logins/WorldMap.svelte
  - src/lib/features/logins/city-client.ts
  - src/lib/features/logins/city-shared.ts
  - src/lib/features/logins/city-state.ts
  - src/lib/features/logins/login-aggregate.ts
  - src/lib/features/logins/login-model.ts
  - src/lib/features/logins/login-shared.ts
  - src/lib/features/logins/login-state.ts
  - src/lib/features/logins/map-model.ts
  - src/lib/features/playtime/Playtime.svelte
  - src/lib/features/vehicles/vehicle-model.ts
  - src/lib/geo/city-fetch.ts
  - src/lib/geo/city-manifest.d.ts
  - src/lib/geo/city-table.ts
  - src/lib/geo/country-lookup.ts
  - src/lib/geo/country-names.ts
  - src/lib/geo/country-table.ts
  - src/lib/geo/geo-assets.d.ts
  - src/lib/geo/ip.ts
  - src/lib/geo/range-table.ts
  - src/lib/import/worker-client.svelte.ts
  - src/lib/shell/Dashboard.svelte
  - src/lib/ui-copy.ts
  - src/lib/worker/data-queries.ts
  - src/lib/worker/db.ts
  - src/lib/worker/identity.ts
  - src/lib/worker/ingest.worker.ts
  - tsconfig.node.json
  - tsconfig.test.json
  - vite.config.ts
  - vitest.config.ts
findings:
  critical: 2
  warning: 7
  info: 6
  total: 15
status: issues_found
---

# Phase 6: Code Review Report

**Reviewed:** 2026-10-04
**Depth:** standard
**Files Reviewed:** 51
**Status:** issues_found

## Summary

The privacy-critical paths hold up. `city-fetch.ts` is the only `fetch(` in `src/`. Its URL is built from the page origin, a validated base path and a manifest file name that matches a strict pattern, with no query, fragment, header or body. The worker has no network call. Every address string that reaches the DOM goes through `displayIp`/`maskIp`. The IP cell of the account record is parsed and stored canonical, and its country and city text is screened by `looksLikeAddress` before display. Worker error details are fixed strings or the error name only. Stale-write guards (`importedAt` stamps, `writeLoginsIfCurrent`, per-load abort and `loadId` supersession) are coherent. I found no way for a full address to reach the DOM, a live region, an attribute or an error string without the user pressing Reveal.

The two Critical findings are verified incorrect behavior in the shared IP and city-lookup code, not security holes: valid addresses are silently dropped, malformed ones are accepted, and a country-resolved address gets a wrong "City unknown". Neither leaks data. The seven warnings are untrusted-input gaps in the container reader and inflate cap, guard gaps (lint denylist, CI type gate), a build-script misuse path, and a documented-versus-actual contract mismatch in the city loader. Everything except WR-07 was verified by reading the code or running it; WR-07 is a design inconsistency.

The shipped `connect-src 'self'` CSP and the lint ban are defence in depth, as the repo documents.

## Critical Issues

### CR-01: IPv6 dotted-tail group count is wrong in both directions (valid rejected, invalid accepted)

**File:** `src/lib/geo/ip.ts:204-238`
**Issue:** The group count is checked before the dotted tail is expanded to two words, and the expanded count is only re-checked for the compressed case (line 233). I ran it:
- `1:2:3:4:5:6:1.2.3.4` is a legal address (6 hex groups plus a dotted tail, 8 words). It returns `null`, because `groups.length` is 7, not 8. It is counted as an unreadable row and drops out of every figure. This includes the expanded IPv4-mapped form `0:0:0:0:0:ffff:192.0.2.1`.
- `1:2:3:4:5:6:7:1.2.3.4` (7 groups plus a tail, 9 words) is accepted. Its `canonical` is the 9-group string `1:2:3:4:5:6:7:102:304`, which becomes the stored grouping key, and `bytes` silently drops the ninth word, so the country lookup runs on a truncated, wrong address. `maskIp(canonical)` re-parses it, fails, and returns the fixed `xxx`. Revealing it shows a malformed 9-group "address" and breaks the "canonical is the grouping key" invariant.

Both are incorrect behavior on the single entry point that every address passes through, which is why this is Critical rather than a quality warning. It is not a privacy leak: a rejected cell is only counted, and the accepted one is masked as `xxx`.

**Fix:** Count words after expansion and apply the same rule to both branches.
```ts
// after building `values`
if (compressed ? values.length >= IPV6_GROUP_COUNT : values.length !== IPV6_GROUP_COUNT) return null;
```
Drop the pre-expansion `groups.length` checks, or keep only the cheap early bound `groups.length > IPV6_GROUP_COUNT` returning null.

### CR-02: City lookup skips the IPv4 plane for IPv4-mapped IPv6 addresses

**File:** `src/lib/worker/ingest.worker.ts:588-598` (`familiesOf`), interacting with `src/lib/geo/range-table.ts:1248-1251` (`lookupIp`)
**Issue:** `lookupIp` resolves `::ffff:a.b.c.d` through the IPv4 section, and the country table does the same, so the address gets a country. `familiesOf` classifies it as `family === 6`, so an account whose listed addresses are only mapped IPv6 decodes with `{ ipv4: false, ipv6: true }`. `v4Starts` is left empty, `lookupV4` returns -1, and `buildCityView` treats it as "no record". The user sees a country but "City unknown", with no error. The wrong answer is silent, and it appears whenever no plain IPv4 address is in the list.
**Fix:** In `familiesOf`, mark IPv4 as needed for a mapped address. `ingest.worker.ts` must also import `mappedIpv4` from `../geo/ip.ts` (it currently imports only `parseIp`).
```ts
import { mappedIpv4, parseIp } from '../geo/ip.ts';
// ...
const ip = parseIp(address.ip);
if (ip === null) continue;
const mapped = ip.family === 6 && mappedIpv4(ip) !== null;
if (ip.family === 4 || mapped) ipv4 = true;
if (ip.family === 6 && !mapped) ipv6 = true;
```

## Warnings

### WR-01: Container reader allocates from header counts before validating them, and `split('\n')` amplifies memory

**File:** `src/lib/geo/range-table.ts:1040-1041, 1059-1061, 1077` and `1151-1153`
**Issue:** The file header says the reader validates before it trusts a length (T-06-16), but two places do not.
1. `v4Count`/`v6Count` are checked only against `MAX_RANGE_TABLE_RANGES` (8M per family). `new Uint32Array(v4Count)` x2, `BigUint64Array(v6Count)` x2, `Uint32Array(v6Count)` x1 and `Uint8Array(v6Count)` are allocated before a single varint is read. That is about 230 MB for a header claiming 8M ranges per family, on a file of tens of bytes. Every range needs at least one varint per plane, so `bytes.length - pos >= v4Count*2 + v6Count*3` is a free pre-check.
2. `decodePlaces` calls `body.split('\n')` before comparing against `placeCount`. `placeBytes` is only bounded by the buffer (up to 96 MB). I measured 48 MB of `\n` becoming a 48M-element array at about 905 MB RSS and 1.3 s, so 96 MB would be about 1.8 GB in a worker. The count check that would reject it runs after the allocation.

In production the manifest SHA-256 check runs before decode: `validateCityManifest` requires a 64-character hex hash and `CityOptIn` always passes it. So this is defence in depth, reachable only through a tampered same-origin asset together with its manifest, or a future caller that passes `sha256: null`. The reader is documented as the untrusted-input boundary and should be safe on its own.

**Fix:**
```ts
// before allocating the planes
const minBody = v4Count * 2 + v6Count * 3;
if (RANGE_TABLE_HEADER_BYTES + placeBytes + minBody > bytes.length) fail();

// in decodePlaces, before split: count separators first
let newlines = 0;
for (let i = start; i < end; i++) if (bytes[i] === 0x0a) newlines++;
if (newlines !== placeCount - 1 && newlines !== placeCount) fail(); // trailing-newline leniency
```

### WR-02: The gzip-bomb cap is looser than the decoder's own cap, and peak memory is doubled

**File:** `src/lib/geo/city-table.ts:71, 127-146`
**Issue:** `MAX_CITY_INFLATED_BYTES` is 200 MB, but `decodeRangeTable` refuses any city container over `MAX_CITY_TABLE_BYTES` (96 MB). A bomb is therefore inflated to 200 MB, collected in `chunks`, then copied into a second 200 MB `out` buffer (about 400 MB peak), and only then rejected by the decoder. The streaming cap exists to stop the allocation, so it should be the strictest bound that could ever succeed. As with WR-01 this is defence in depth: the SHA-256 check runs before the inflate, so a bomb needs a tampered asset plus manifest.
**Fix:** Cap at the decoder's limit, and avoid the second copy.
```ts
import { MAX_CITY_TABLE_BYTES } from './range-table.ts';
export const MAX_CITY_INFLATED_BYTES = MAX_CITY_TABLE_BYTES;
```
Preallocate a single `Uint8Array(maxBytes)` and `set` chunks into it, then `subarray(0, total)`. That removes the chunk list and the final copy.

### WR-03: The worker-only import ban misses sibling relative imports (verified)

**File:** `eslint.config.js:247-255`
**Issue:** The restricted-import patterns are `**/geo/country-table*`, `**/geo/country-lookup*` and `**/geo/city-table*`, matched against the import specifier. The specifier from a file inside `src/lib/geo/` is `./country-table.ts`, which has no `geo/` segment. I ran ESLint on stdin:
- `import … from './country-table.ts'` as `src/lib/geo/country-names.ts` produced no error.
- The same import written `../geo/country-table.ts` from `src/lib/features/logins/` is flagged.

`country-names.ts`, `ip.ts` and `city-fetch.ts` are main-thread modules in that directory. A sibling import there would pull the roughly 4.7 MB country table, or the city decoder, into the main bundle with the guard green. The unit probes appear to exercise only the `../geo/...` spelling.
**Fix:** Add the relative spellings to the same `patterns` group and probe them in `lint-guards.test.ts`.
```js
group: ['**/geo/country-table*', '**/geo/country-lookup*', '**/geo/city-table*',
        './country-table*', './country-lookup*', './city-table*'],
```

### WR-04: The worker's network ban is a denylist with real holes (verified)

**File:** `eslint.config.js:132-199` (block 7) and `src/lib/worker/**`
**Issue:** The project's own measurement says the meta CSP does not govern worker traffic, so lint is the only guard for the worker that holds the raw rows. I ran ESLint on probe files under `src/lib/worker/`:
- `self['fetch']` and `const { fetch } = self` are caught.
- `await import(url)`, `new Function(s)`, `eval(s)` and `new Worker(blobUrl)` are not caught. `js.configs.recommended` does not enable `no-eval`.
- `caches.open('x').then((c) => c.add('https://example.com/x'))` is not caught. `Cache.add` performs a fetch and `caches` is available in workers.

Dynamic `import(url)` and `Cache.add` are themselves network requests, and `new Function`/`eval` or a nested `Worker` over a Blob URL can reconstruct any API from a string. This is unreachable today (no such code exists), but the guard's stated purpose is "the worker has no network API".
**Fix:** Add to block 7, or a worker-scoped block:
```js
'no-eval': 'error', 'no-new-func': 'error', 'no-implied-eval': 'error',
'no-restricted-syntax': ['error', { selector: 'ImportExpression',
  message: 'PLATFORM-02: dynamic import() is a network request.' }],
// no-restricted-globals additions for src/lib/worker/**: Worker, SharedWorker, caches
```
The `Worker` constructor is legitimately used in `src/lib/import/ingest-client.ts`, so scope the `Worker` ban to `src/lib/worker/**`. Do not ban `Request` or `BroadcastChannel`: constructing them sends nothing.

### WR-05: The typecheck gate skips `.svelte`, and this phase ships a real type error behind it

**File:** `src/lib/features/logins/LoginHistory.svelte:4`; `package.json:12` (`"check": "tsc -b"`); `.github/workflows/ci.yml:122-123`
**Issue:** `LoginHistory.svelte` imports `LoginsView` from `core/types/worker-messages.ts`, which imports the type but does not export it. `tsc -b` does not read `.svelte` files and CI runs only `pnpm run check`, so nothing fails. `svelte-check --tsconfig ./tsconfig.app.json` reports:

> `LoginHistory.svelte 4:33 Module '"../../core/types/worker-messages.ts"' declares 'LoginsView' locally, but it is not exported.`

It also reports two phase-5 errors in `PlayerStats.svelte` (lines 156 and 757) that have been invisible for the same reason. `svelte-check` is a devDependency and AGENTS.md calls it a CI gate. The runtime is unaffected because the type import is erased.
**Fix:** Import from `./login-shared.ts`, add `svelte-check` to the gate, and fix the two phase-5 errors.
```ts
import type { ClassifyResult } from '../../core/types/worker-messages.ts';
import type { LoginsView } from './login-shared.ts';
```
```json
"check": "tsc -b && svelte-check --tsconfig ./tsconfig.app.json --threshold warning"
```

### WR-06: `build-city-dataset.ts --fixture --download` overwrites the committed fixture with real data

**File:** `scripts/geo/build-city-dataset.ts:135-157, 402-411`
**Issue:** In `parseArgs`, `--fixture` is handled first and the `else if (options.download)` branch is skipped, but `options.download` stays true. `main` then downloads the real file, overwrites `csvPath`, `month` and `source`, and writes it to `tests/fixtures/geo/` with `fixture: true` and `source: 'fixture'`. That puts about 42 MB of licensed data into the committed fixture path under a fixture label. The country script refuses `--download` with `--fixture` (build-country-table.ts:129-131); this one does not.
**Fix:**
```ts
if (options.fixture && options.download) usage('--fixture marks a table as test data; a downloaded file is not');
```

### WR-07: The city loader's documented plain-body path is unreachable in production, and the failure is unexplained

**File:** `src/lib/worker/ingest.worker.ts:541-548`; `src/lib/geo/city-fetch.ts:68-75`; `src/lib/geo/city-table.ts:89-97`
**Issue:** The headers state that a host which strips or re-encodes the gzip layer is handled (the plain-body sniff, "headroom for a host that strips the gzip layer"). The worker, however, rejects any body whose length differs from `expectedBytes`, which the manifest defines as the GZIPPED size, and it hashes the gzipped bytes. A host that transparently decodes `Content-Encoding` hands the browser the 42.8 MB plain container, so length and hash both mismatch and the user gets the generic `CITY_ERROR` on every attempt. The plain branch of `inflateIfGzip` is only reachable from tests. Either the doc claim or the check is wrong.
**Fix:** Pick one contract and state it in both places.
- Gzip-only (simplest): delete the "host strips gzip" claims and the plain-body promise.
- Plain tolerated: also record the raw container size and its hash in the manifest, and verify against whichever form arrived.

## Info

### IN-01: `<p>` captions inside `dl > div` are invalid HTML

**File:** `src/lib/features/logins/LoginSummary.svelte:129-133, 146-150`
**Issue:** A `div` grouping inside a `dl` may contain only `dt` and `dd`. The share captions (`<p class="caption">`) sit between the `dd` and the end of the group, which can drop or misorder them in some screen readers.
**Fix:** Move each caption inside its `dd`, as a `span` or `div` under the value.

### IN-02: The city file's country code is not validated, unlike the country lookup

**File:** `src/lib/geo/city-table.ts:181-191`; `src/lib/features/logins/CityList.svelte:64`
**Issue:** `countryOf` in `country-lookup.ts` enforces `^[A-Z]{2}$` on a place because the table is untrusted. `placeFrom` accepts any string as `cc` (up to 1,024 characters), and `CityList` renders `nameOf(place.cc) ?? place.cc` verbatim. It is escaped text, so there is no XSS, but a bad file puts arbitrary text into a column that is meant to hold a country. The city file's country can also disagree with the address's own country.
**Fix:** In `buildCityView`, treat a place whose `cc` fails `^[A-Z]{2}$` as no record.

### IN-03: `new Uint8Array(msg.buffer)` runs outside the handler's try/catch

**File:** `src/lib/worker/ingest.worker.ts:129-131`
**Issue:** If `buffer` were not an `ArrayBuffer`, the constructor throws inside the async `onmessage`. There would be no `city-error` reply, and the main thread would sit in `decoding` with no Cancel until the worker dies. Not reachable from the current sender. `data-query` validates its message and `city-load` does not.
**Fix:** Move the construction into `handleCityLoad`'s try, or validate `msg.buffer instanceof ArrayBuffer && Number.isSafeInteger(msg.expectedBytes)` before dispatch.

### IN-04: The nested-overlap case in the normaliser silently drops the earlier range's tail

**File:** `src/lib/geo/range-table.ts:712-720`
**Issue:** The comment says "the earlier start keeps the part below this row; the row keeps the rest". When the later row is strictly inside the earlier one, the earlier range's remainder after the nested row is dropped and becomes unknown. I ran `10.0.0.0-100 AA` plus `10.0.0.10-20 BB`: addresses 21-100 resolve to `ZZ`. DB-IP's published files do not overlap, so this is latent, but the build prints no counter for it.
**Fix:** Either split the earlier range around the nested one, or fail the build on any overlap with a distinct place and say so.

### IN-05: Build and tooling robustness

**File:** `scripts/geo/lib/download.ts:172-201`, `scripts/geo/build-city-dataset.ts:403-411` and `build-country-table.ts:228-235`, `scripts/geo/lib/geo-alias.ts:83`
**Issue:**
1. `downloadToFile` checks that the first URL is `https`, but `redirect: 'follow'` can follow a redirect to `http`.
2. If the download throws midway, `tempPath` is set but the `try/finally` that removes it has not started, so a partial 86 MB temp file is left behind.
3. Neither build script fails on a source that parsed to zero or near-zero ranges. It only prints `skipped`.
4. `geoAliasEntries` builds `replacement` as `` `${table}$1` ``; a repository path containing `$&` or `$'` would be interpreted by the replace.

**Fix:** Use `redirect: 'manual'` or re-check `response.url` after the fetch. Move `downloadToFile` inside the `try`. Fail below a sanity floor of ranges. Escape `$` in the path (`table.replace(/\$/g, '$$$$')`).

### IN-06: CI runs PRs on a self-hosted runner (pre-existing, not introduced this phase)

**File:** `.github/workflows/ci.yml:13, 27`
**Issue:** `on: pull_request` plus `runs-on: self-hosted` executes fork PR code on the maintainer's machine if the repository is public. `permissions: contents: read` and `persist-credentials: false` limit token exposure but not host exposure.
**Fix:** Use GitHub-hosted runners for PRs, or require approval for all outside collaborators' workflow runs and isolate the runner (ephemeral, no ambient credentials).

---

_Reviewed: 2026-10-04_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
