import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { ESLint } from 'eslint';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// =============================================================================
// Lint-guard probes
// =============================================================================
//
// Why this file exists (01-02-PLAN Task 2, RED then GREEN):
//   Playwright proves the *running* app makes zero network requests after
//   initial load. That assertion is missing the worker context, which
//   playwright/request observation cannot reach (01-RESEARCH Pitfall 4).
//   The only way to close that blind spot is to ban the network APIs at lint
//   time so they cannot be introduced at all under src/, including
//   src/lib/worker/. Adding a lint rule without proving it fires is unsafe;
//   this file's tests are the proof.
//
// The probes never exist on disk. ESLint's Node API accepts a `filePath` so
// the resolved config can match its `files` glob; the literal `__lint_probe__`
// token only appears in the path, never as a real file. The asserts run
// against the REAL eslint.config.js at the repo root.
//
// This file lives under tests/, which is OUTSIDE the src/** rule scope, so
// its own code never trips the rules. The clean-control probe lives under
// src/lib/ to make sure the absence of guard rule ids there is real.
// =============================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

const GUARD_RULE_IDS = [
  'no-restricted-globals',
  'no-restricted-properties',
  'svelte/no-at-html-tags',
  'svelte/no-inline-styles',
  'no-restricted-imports',
] as const;

const PROBE_PATH = 'src/lib/__lint_probe__.ts';
const WORKER_PROBE_PATH = 'src/lib/worker/__lint_probe__.ts';
const SVELTE_PROBE_PATH = 'src/lib/shell/__lint_probe__.svelte';

const eslintState: { instance: ESLint | null } = { instance: null };
const lintTimeoutMs = 60_000;

beforeAll(async () => {
  eslintState.instance = new ESLint({
    cwd: REPO_ROOT,
    overrideConfigFile: path.join(REPO_ROOT, 'eslint.config.js'),
  });
});

afterAll(async () => {
  // ESLint holds its own resolved-config cache; resetting the reference is
  // sufficient — the GC reclaims the rest.
  eslintState.instance = null;
});

function eslint(): ESLint {
  if (!eslintState.instance) throw new Error('ESLint not initialized');
  return eslintState.instance;
}

/**
 * Run ESLint over an in-memory source string, reporting back ONLY the rule
 * IDs that fired at severity 2 (error). Warnings and the auto-attached
 * recommended-config rules are filtered out so the assertions are scoped
 * to the guards this plan adds.
 */
async function ruleIdsAtError(src: string, filePath: string): Promise<string[]> {
  const results = await eslint().lintText(src, { filePath });
  const ids: string[] = [];
  for (const result of results) {
    for (const message of result.messages) {
      if (message.severity === 2 && message.ruleId) {
        ids.push(message.ruleId);
      }
    }
  }
  return ids;
}

// -----------------------------------------------------------------------------
// Network ban: no-restricted-globals (raw identifiers)
// -----------------------------------------------------------------------------
const GLOBAL_CONSTRUCTS = [
  'fetch',
  'fetchLater',
  'XMLHttpRequest',
  'WebSocket',
  'WebTransport',
  'EventSource',
  'RTCPeerConnection',
  'importScripts',
] as const;

describe('network ban — no-restricted-globals', () => {
  test.each(GLOBAL_CONSTRUCTS)(
    '%s as a raw identifier in src/lib fires no-restricted-globals',
    async (name) => {
      const src = `${name};`;
      const ids = await ruleIdsAtError(src, PROBE_PATH);
      expect(ids).toContain('no-restricted-globals');
    },
    lintTimeoutMs,
  );

  test.each(GLOBAL_CONSTRUCTS)(
    '%s as a raw identifier also fires inside src/lib/worker (worker code is not exempt)',
    async (name) => {
      const src = `${name};`;
      const ids = await ruleIdsAtError(src, WORKER_PROBE_PATH);
      expect(ids).toContain('no-restricted-globals');
    },
    lintTimeoutMs,
  );
});

// -----------------------------------------------------------------------------
// Network ban holes a name denylist cannot see (WR-04): code from a string,
// dynamic import(), and worker-only escape hatches (nested Worker, Cache API)
// -----------------------------------------------------------------------------
describe('network ban — string-to-code and dynamic import', () => {
  const PROBES: Array<[string, string, string]> = [
    ['dynamic import(url)', `const u = 'x'; import(u);`, 'no-restricted-syntax'],
    ['eval', `eval('1');`, 'no-eval'],
    ['new Function', `new Function('return 1');`, 'no-new-func'],
    ['setTimeout with a string', `setTimeout('1', 0);`, 'no-implied-eval'],
  ];
  test.each(PROBES)(
    '%s fires in src/lib and in src/lib/worker',
    async (_label, src, ruleId) => {
      expect(await ruleIdsAtError(src, PROBE_PATH)).toContain(ruleId);
      expect(await ruleIdsAtError(src, WORKER_PROBE_PATH)).toContain(ruleId);
    },
    lintTimeoutMs,
  );
});

describe('network ban — worker-only escape hatches', () => {
  const PROBES: Array<[string, string]> = [
    ['new Worker', `new Worker('x');`],
    ['new SharedWorker', `new SharedWorker('x');`],
    ['caches', `caches.open('x');`],
    ['self.caches', `self.caches.open('x');`],
    ['globalThis.Worker', `new globalThis.Worker('x');`],
  ];
  test.each(PROBES)(
    '%s fires inside src/lib/worker',
    async (_label, src) => {
      const ids = await ruleIdsAtError(src, WORKER_PROBE_PATH);
      expect(ids.some((id) => id.startsWith('no-restricted-'))).toBe(true);
    },
    lintTimeoutMs,
  );

  test(
    'the main-thread worker client may still construct a Worker',
    async () => {
      const ids = await ruleIdsAtError(`new Worker('x');`, 'src/lib/import/ingest-client.ts');
      expect(ids).not.toContain('no-restricted-globals');
    },
    lintTimeoutMs,
  );

  test(
    'the worker block keeps the full network list (an override replaces, it does not merge)',
    async () => {
      expect(await ruleIdsAtError(`fetch('/x');`, WORKER_PROBE_PATH)).toContain(
        'no-restricted-globals',
      );
      expect(await ruleIdsAtError(`self.fetch('/x');`, WORKER_PROBE_PATH)).toContain(
        'no-restricted-properties',
      );
    },
    lintTimeoutMs,
  );
});

// -----------------------------------------------------------------------------
// Network ban: no-restricted-properties (window./self./globalThis. prefixes +
// navigator.sendBeacon)
// -----------------------------------------------------------------------------
type PropertyTest = { prefix: string; name: string };

const PROPERTY_CONSTRUCTS: PropertyTest[] = (
  ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource'] as const
).flatMap((name) => [
  { prefix: 'window.', name },
  { prefix: 'self.', name },
  { prefix: 'globalThis.', name },
]);

PROPERTY_CONSTRUCTS.push({ prefix: 'navigator.', name: 'sendBeacon' });

describe('network ban — no-restricted-properties', () => {
  test.each(PROPERTY_CONSTRUCTS)(
    'window/self/globalThis/navigator prefix in src/lib fires no-restricted-properties',
    async ({ prefix, name }) => {
      const src = `${prefix}${name};`;
      const ids = await ruleIdsAtError(src, PROBE_PATH);
      expect(ids).toContain('no-restricted-properties');
    },
    lintTimeoutMs,
  );

  test.each(PROPERTY_CONSTRUCTS)(
    'window/self/globalThis/navigator prefix in src/lib/worker also fires (worker code is not exempt)',
    async ({ prefix, name }) => {
      const src = `${prefix}${name};`;
      const ids = await ruleIdsAtError(src, WORKER_PROBE_PATH);
      expect(ids).toContain('no-restricted-properties');
    },
    lintTimeoutMs,
  );
});

// -----------------------------------------------------------------------------
// Markup ban: svelte/no-at-html-tags and svelte/no-inline-styles
// -----------------------------------------------------------------------------
describe('markup ban — Svelte rules', () => {
  test(
    '{@html expression} fires svelte/no-at-html-tags',
    async () => {
      const src = `<p>{@html unsafe}</p>`;
      const ids = await ruleIdsAtError(src, SVELTE_PROBE_PATH);
      expect(ids).toContain('svelte/no-at-html-tags');
    },
    lintTimeoutMs,
  );

  test(
    'style="..." attribute fires svelte/no-inline-styles',
    async () => {
      const src = `<div style="color: red">x</div>`;
      const ids = await ruleIdsAtError(src, SVELTE_PROBE_PATH);
      expect(ids).toContain('svelte/no-inline-styles');
    },
    lintTimeoutMs,
  );
});

// -----------------------------------------------------------------------------
// Worker-boundary import ban: no-restricted-imports (fflate outside the worker)
// -----------------------------------------------------------------------------
describe('worker-boundary import ban — no-restricted-imports (fflate)', () => {
  test(
    'importing fflate from src/lib (non-worker) fires no-restricted-imports',
    async () => {
      const src = `import { unzipSync } from 'fflate';`;
      const ids = await ruleIdsAtError(src, PROBE_PATH);
      expect(ids).toContain('no-restricted-imports');
    },
    lintTimeoutMs,
  );

  test(
    'importing fflate from src/lib/worker does NOT fire no-restricted-imports',
    async () => {
      const src = `import { unzipSync } from 'fflate';`;
      const ids = await ruleIdsAtError(src, WORKER_PROBE_PATH);
      expect(ids).not.toContain('no-restricted-imports');
    },
    lintTimeoutMs,
  );
});

// -----------------------------------------------------------------------------
// Worker-boundary import ban: no-restricted-imports (the geo worker-only modules)
// -----------------------------------------------------------------------------
// 06-06. D-12 puts the range table inside the worker: the main thread must
// never load it, never hold it and never scan raw rows to work out a country.
// A module a main-thread import could reach is a module whose table a
// main-thread bundle would one day pull in — a 3.4 MB table on a phone, for a
// lookup the main thread has no rows to feed.
//
// These probes are the proof the rule fires. The fflate probes above stay in
// this file unmodified: the two bans live in the SAME `no-restricted-imports`
// block, and when two blocks match a file the later one's options replace the
// earlier one's, so a careless second block would silently drop the fflate
// restriction. That failure is invisible unless the fflate probe is asserted
// again next to the new one, which is why it is here rather than left alone.
const WORKER_ONLY_GEO_IMPORTS = [
  { name: 'country-table', specifier: '../geo/country-table.ts' },
  { name: 'country-lookup', specifier: '../geo/country-lookup.ts' },
  { name: 'city-table', specifier: '../geo/city-table.ts' },
] as const;

describe('worker-boundary import ban — no-restricted-imports (geo worker-only modules)', () => {
  test.each(WORKER_ONLY_GEO_IMPORTS)(
    'importing geo/$name from src/lib (non-worker) fires no-restricted-imports',
    async ({ specifier }) => {
      const src = `import { lookupCountry } from '${specifier}';\nlookupCountry;`;
      const ids = await ruleIdsAtError(src, PROBE_PATH);
      expect(ids).toContain('no-restricted-imports');
    },
    lintTimeoutMs,
  );

  test.each(WORKER_ONLY_GEO_IMPORTS)(
    'importing geo/$name from src/lib/worker does NOT fire no-restricted-imports',
    async ({ specifier }) => {
      const src = `import { lookupCountry } from '${specifier}';\nlookupCountry;`;
      const ids = await ruleIdsAtError(src, WORKER_PROBE_PATH);
      expect(ids).not.toContain('no-restricted-imports');
    },
    lintTimeoutMs,
  );

  // WR-03: a file inside src/lib/geo/ names its sibling as `./country-table.ts`,
  // which has no `geo/` segment. A main-thread sibling (country-names.ts, ip.ts,
  // city-fetch.ts) importing it would pull the table into the main bundle.
  test.each([
    { name: 'country-table', specifier: './country-table.ts' },
    { name: 'country-lookup', specifier: './country-lookup.ts' },
    { name: 'city-table', specifier: './city-table.ts' },
  ])(
    'a sibling-relative import of $name from src/lib/geo fires no-restricted-imports',
    async ({ specifier }) => {
      const src = `import { lookupCountry } from '${specifier}';\nlookupCountry;`;
      const ids = await ruleIdsAtError(src, 'src/lib/geo/__lint_probe__.ts');
      expect(ids).toContain('no-restricted-imports');
    },
    lintTimeoutMs,
  );

  test(
    'the login aggregator, which runs only in the worker, may import the lookup',
    async () => {
      // `login-aggregate.ts` is the one module outside `src/lib/worker/` that
      // reaches a worker-only module, and it does so for `geoTableId()` alone
      // — the staleness stamp, which is a string and carries no table. It is
      // named in the block's `ignores` beside `src/lib/worker/**`, and this
      // probe is what stops that exemption widening into a hole: the rule has
      // to be told about exactly this file, and a NEIGHBOUR in the same
      // directory must still be restricted.
      const src = `import { geoTableId } from '../geo/country-lookup.ts';\ngeoTableId;`;
      expect(await ruleIdsAtError(src, 'src/lib/features/logins/login-aggregate.ts')).not.toContain(
        'no-restricted-imports',
      );
      expect(await ruleIdsAtError(src, 'src/lib/features/logins/__lint_probe__.ts')).toContain(
        'no-restricted-imports',
      );
    },
    lintTimeoutMs,
  );

  test(
    'an unrelated module is still allowed to import fflate-free geo helpers',
    async () => {
      // `country-names.ts` holds no table — it is pure `Intl` — and is the one
      // geo module the main thread may use. Nothing here asserts a name; the
      // case exists so a future "restrict the whole `geo/` directory" rewrite
      // of the pattern below is caught as a failure rather than as a decision
      // nobody noticed.
      const src = `import { countryName } from '../geo/country-names.ts';\ncountryName;`;
      const ids = await ruleIdsAtError(src, PROBE_PATH);
      expect(ids).not.toContain('no-restricted-imports');
    },
    lintTimeoutMs,
  );
});

// -----------------------------------------------------------------------------
// Worker-boundary import ban: no-restricted-imports (the tank table)
// -----------------------------------------------------------------------------
// 13-02. D-08 puts the generated vehicle table inside the worker chunk, the
// way the geo country table is inlined: the page has no rows to feed a lookup,
// and a dynamic import of the table would be a post-load request the
// zero-network contract counts (T-13-09).
//
// The fflate probe and the geo probes stay where they are, and one is
// repeated here, because the tank table's ban lives in the SAME
// `no-restricted-imports` block: when two blocks match a file the later one's
// options REPLACE the earlier one's, so a careless second block would
// silently drop the fflate restriction. That failure is invisible unless the
// fflate probe is asserted again next to the new one.
describe('worker-boundary import ban — no-restricted-imports (the tank table)', () => {
  test(
    'importing the tank table from src/lib (non-worker) fires no-restricted-imports',
    async () => {
      const src = `import { defaultVehicleLookup } from '../features/overview/vehicle-table.ts';\ndefaultVehicleLookup;`;
      const ids = await ruleIdsAtError(src, PROBE_PATH);
      expect(ids).toContain('no-restricted-imports');
    },
    lintTimeoutMs,
  );

  test(
    'importing the tank table from src/lib/worker does NOT fire no-restricted-imports',
    async () => {
      const src = `import { defaultVehicleLookup } from '../features/overview/vehicle-table.ts';\ndefaultVehicleLookup;`;
      const ids = await ruleIdsAtError(src, WORKER_PROBE_PATH);
      expect(ids).not.toContain('no-restricted-imports');
    },
    lintTimeoutMs,
  );

  test(
    'a sibling-relative import of the tank table from src/lib/features/overview fires',
    async () => {
      // WR-03's shape: a file inside the feature folder names its sibling as
      // `./vehicle-table.ts`, which has no `features/overview/` segment.
      const src = `import { defaultVehicleLookup } from './vehicle-table.ts';\ndefaultVehicleLookup;`;
      const ids = await ruleIdsAtError(src, 'src/lib/features/overview/__lint_probe__.ts');
      expect(ids).toContain('no-restricted-imports');
    },
    lintTimeoutMs,
  );

  test(
    'the one module that imports the generated table is exempt',
    async () => {
      // `vehicle-table.ts` imports its generated sibling and hands the rows to
      // the lookup. It is named in the block's `ignores`, and this probe is
      // what stops that exemption widening into a hole: the rule has to be
      // told about exactly this file, and a NEIGHBOUR in the same directory
      // must still be restricted.
      const src = `import { VEHICLE_TABLE } from './vehicle-table.generated.ts';\nVEHICLE_TABLE;`;
      expect(await ruleIdsAtError(src, 'src/lib/features/overview/vehicle-table.ts')).not.toContain(
        'no-restricted-imports',
      );
      expect(await ruleIdsAtError(src, 'src/lib/features/overview/__lint_probe__.ts')).toContain(
        'no-restricted-imports',
      );
    },
    lintTimeoutMs,
  );

  test(
    'the fflate ban still fires from src/lib, in the same block',
    async () => {
      const src = `import { unzipSync } from 'fflate';`;
      const ids = await ruleIdsAtError(src, PROBE_PATH);
      expect(ids).toContain('no-restricted-imports');
    },
    lintTimeoutMs,
  );
});

// -----------------------------------------------------------------------------
// The single sanctioned fetch (06-11, D-16, T-06-43, RESEARCH Pitfall 6)
// -----------------------------------------------------------------------------
//
// The override in eslint.config.js exempts the platform fetch for ONE exact
// path. An override REPLACES a rule's options, so the failure to guard against
// is the opposite of the obvious one: not "fetch is still banned there" but
// "the exemption quietly un-banned something else, or a loose glob un-banned
// fetch somewhere it must never be". Every edge of the glob is probed.
const CITY_FETCH_PATH = 'src/lib/geo/city-fetch.ts';

describe('the single sanctioned fetch', () => {
  test.each([
    ['a main-thread feature path', 'src/lib/features/logins/__lint_probe__.ts'],
    ['the worker directory', WORKER_PROBE_PATH],
    ['a nested worker path', 'src/lib/worker/geo/__lint_probe__.ts'],
    ['a different file under src/lib/geo', 'src/lib/geo/__lint_probe__.ts'],
    ['a near-miss name beside the exempt file', 'src/lib/geo/city-fetch-2.ts'],
    ['the exempt file name in another directory', 'src/lib/worker/city-fetch.ts'],
    ['a Svelte component', SVELTE_PROBE_PATH],
  ])(
    'the platform fetch is reported in %s',
    async (_label, filePath) => {
      const src = filePath.endsWith('.svelte')
        ? `<script lang="ts">\n  fetch('/x');\n</script>\n`
        : `fetch('/x');\n`;
      expect(await ruleIdsAtError(src, filePath)).toContain('no-restricted-globals');
    },
    lintTimeoutMs,
  );

  test(
    'the platform fetch is NOT reported in the exempt file',
    async () => {
      const ids = await ruleIdsAtError(`fetch('/x');\n`, CITY_FETCH_PATH);
      expect(ids).not.toContain('no-restricted-globals');
    },
    lintTimeoutMs,
  );

  test.each(['XMLHttpRequest', 'WebSocket', 'WebTransport', 'EventSource', 'RTCPeerConnection'])(
    'the exemption leaves %s banned in the exempt file',
    async (name) => {
      expect(await ruleIdsAtError(`${name};\n`, CITY_FETCH_PATH)).toContain(
        'no-restricted-globals',
      );
    },
    lintTimeoutMs,
  );

  test(
    'the exemption leaves the deferred-fetch API and importScripts banned too',
    async () => {
      for (const name of ['fetchLater', 'importScripts']) {
        expect(await ruleIdsAtError(`${name};\n`, CITY_FETCH_PATH), name).toContain(
          'no-restricted-globals',
        );
      }
    },
    lintTimeoutMs,
  );

  test.each(['window.fetch', 'self.fetch', 'globalThis.fetch', 'navigator.sendBeacon'])(
    'the explicit-global form %s is still reported in the exempt file',
    async (expression) => {
      expect(await ruleIdsAtError(`${expression};\n`, CITY_FETCH_PATH)).toContain(
        'no-restricted-properties',
      );
    },
    lintTimeoutMs,
  );

  test(
    'the real module is clean under its own override',
    async () => {
      const [result] = await eslint().lintFiles([CITY_FETCH_PATH]);
      expect(result?.messages.filter((m) => m.severity === 2)).toEqual([]);
    },
    lintTimeoutMs,
  );
});

// -----------------------------------------------------------------------------
// Clean control: a benign file under src/lib reports none of the guard ids.
// -----------------------------------------------------------------------------
describe('clean control', () => {
  test(
    'a benign exported constant reports none of the guard rule ids',
    async () => {
      const src = `export const x = 1;`;
      const ids = await ruleIdsAtError(src, PROBE_PATH);
      const guardHits = ids.filter((id) => (GUARD_RULE_IDS as readonly string[]).includes(id));
      expect(guardHits).toEqual([]);
    },
    lintTimeoutMs,
  );
});
