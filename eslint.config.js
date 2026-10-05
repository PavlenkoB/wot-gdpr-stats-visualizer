// ESLint flat config for the WG Data Export Viewer.
//
// Five configs cooperate here:
//   1. The toolchain baseline (js + typescript-eslint + eslint-plugin-svelte +
//      eslint-config-prettier) — installed from the gate-approved package list
//      during 01-02 Task 1.
//   2. Per-area globals (browser / worker / node).
//   3. Svelte parser wiring for .svelte and .svelte.ts modules.
//   4. The src/ guard rules — network-ban / raw-HTML / inline-style — covering
//      ALL of src/, including src/lib/worker/. These exist because Playwright's
//      zero-network assertion is blind to fetches issued from inside a worker
//      (RESEARCH Pitfall 4); a lint-time ban is the only guard for that path.
//   5. The fflate-outside-worker ban — a subset rule (src/**/*.ts AND NOT
//      src/lib/worker/**) that catches imports of fflate outside the worker,
//      since unzipping on the main thread would freeze the page under large
//      exports (PROJECT.md worker-boundary decision).
//
// Each rule message cites either PLATFORM-02 (the project's private-by-
// construction contract) or CSP / worker-boundary context, so a future
// contributor can grep the rule id back to the threat-model register and the
// plan that introduced it.
//
// All five layers are stitched together via `defineConfig` from "eslint/config"
// so editor tooling (eslint.configs.recommended, etc.) understands the array
// shape.

import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

const PLATFORM02_MESSAGE =
  'PLATFORM-02: the app must make zero network requests after page load. Use Worker-only message passing or read files via the File API.';

const NETWORK_GLOBALS = [
  { name: 'fetch', message: PLATFORM02_MESSAGE },
  { name: 'fetchLater', message: PLATFORM02_MESSAGE },
  { name: 'XMLHttpRequest', message: PLATFORM02_MESSAGE },
  { name: 'WebSocket', message: PLATFORM02_MESSAGE },
  { name: 'WebTransport', message: PLATFORM02_MESSAGE },
  { name: 'EventSource', message: PLATFORM02_MESSAGE },
  { name: 'RTCPeerConnection', message: PLATFORM02_MESSAGE },
  { name: 'importScripts', message: PLATFORM02_MESSAGE },
];

const NETWORK_PROPERTIES = [
  // navigator.sendBeacon — distinct namespace from the window.* globals
  // because it's a Navigator-API method, not a global constructor.
  {
    object: 'navigator',
    property: 'sendBeacon',
    message: PLATFORM02_MESSAGE,
  },
  // The four "real" network APIs accessed through the explicit-global
  // prefixes. ESLint's no-restricted-properties only fires on access
  // (i.e. the bare identifier reference is not detected).
  { object: 'window', property: 'fetch', message: PLATFORM02_MESSAGE },
  {
    object: 'window',
    property: 'XMLHttpRequest',
    message: PLATFORM02_MESSAGE,
  },
  { object: 'window', property: 'WebSocket', message: PLATFORM02_MESSAGE },
  { object: 'window', property: 'EventSource', message: PLATFORM02_MESSAGE },
  { object: 'self', property: 'fetch', message: PLATFORM02_MESSAGE },
  { object: 'self', property: 'XMLHttpRequest', message: PLATFORM02_MESSAGE },
  { object: 'self', property: 'WebSocket', message: PLATFORM02_MESSAGE },
  { object: 'self', property: 'EventSource', message: PLATFORM02_MESSAGE },
  {
    object: 'globalThis',
    property: 'fetch',
    message: PLATFORM02_MESSAGE,
  },
  {
    object: 'globalThis',
    property: 'XMLHttpRequest',
    message: PLATFORM02_MESSAGE,
  },
  {
    object: 'globalThis',
    property: 'WebSocket',
    message: PLATFORM02_MESSAGE,
  },
  {
    object: 'globalThis',
    property: 'EventSource',
    message: PLATFORM02_MESSAGE,
  },
];

export default [
  // 1. Global ignores. ESLint 10 does not read .gitignore on its own, so
  //    build / report / planning / agent / IDE directories that are already
  //    .gitignored are listed explicitly here.
  {
    ignores: [
      'dist/**',
      'playwright-report/**',
      'test-results/**',
      'blob-report/**',
      'coverage/**',
      '.planning/**',
      '.claude/**',
      '.idea/**',
      'node_modules/**',
    ],
  },

  // 2. Base recommended sets. The typescript-eslint "recommended" preset is
  //    the non-type-checked variant; the type-checked version would need
  //    projectService wiring across three tsconfigs and is deferred (FA-01-
  //    02-1 — reversible, see 01-02-RESEARCH and 01-02-PLAN FA).
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // 3. Svelte plugin, applied to both .svelte and .svelte.ts modules so
  //    runes files also get the plugin's parser-aware recommendations.
  ...svelte.configs.recommended,

  // 4. Prettier compat LAST. It turns off conflicting stylistic rules so
  //    Prettier (the source of truth for formatting) does not fight ESLint.
  //    The svelte/prettier block below extends the same intent to .svelte.
  prettier,
  ...svelte.configs.prettier,

  // 5. Per-area globals. src/** uses browser globals (window, document, ...);
  //    the worker files live in the SAME browser global scope and read
  //    `self`, so they also get browser globals. *.config.{js,ts} and
  //    svelte.config.js run under Node. tests/** runs under Node too.
  {
    files: ['src/**/*.{js,ts,svelte}'],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
  {
    files: ['src/lib/worker/**/*.{js,ts,svelte}'],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
  {
    files: [
      '*.config.{js,ts}',
      'svelte.config.js',
      'eslint.config.js',
      'vitest.config.ts',
      'playwright.config.ts',
      'tests/**/*.ts',
      // The geo build scripts (06-04). They run in Node, never in a browser,
      // and they are the only place in the repository allowed to open a file
      // or reach the network — which is exactly why they live under scripts/
      // and outside the src/ network ban rather than beside the worker.
      'scripts/**/*.ts',
    ],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },

  // 6. Svelte parser wiring. Both .svelte and .svelte.ts modules need the
  //    typescript-eslint parser plus the .svelte extension declared, per the
  //    eslint-plugin-svelte flat-config guidance.
  {
    files: ['**/*.svelte', '**/*.svelte.ts'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: ['.svelte'],
      },
    },
  },

  // 7. Source-level guard rules — network ban and unsafe-markup ban. ALL of
  //    src/ is in scope, including src/lib/worker/**: Playwright can't see a
  //    fetch that happens inside the worker, so the only guaranteed way to
  //    catch one is at lint time. Each entry's message cites PLATFORM-02
  //    (the project's "zero network requests after page load" contract)
  //    so future contributors can grep the rule id back to the threat
  //    register and the privacy-by-construction story.
  {
    files: ['src/**/*.ts', 'src/**/*.svelte'],
    rules: {
      'no-restricted-globals': ['error', ...NETWORK_GLOBALS],
      'no-restricted-properties': ['error', ...NETWORK_PROPERTIES],
      // Code-from-string and dynamic `import(url)` can reach the network (or
      // rebuild any banned API from a string) without naming a banned global, so
      // a denylist of names alone is not enough. No file under src/ needs any of
      // them.
      'no-eval': 'error',
      'no-new-func': 'error',
      'no-implied-eval': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ImportExpression',
          message:
            'PLATFORM-02: a dynamic import() is a network request the page makes after load.',
        },
      ],
      // Svelte rules — error severity under src/. folder and file names
      // come from untrusted zip entries (the user picks the file), so the
      // {@html} tag is unsafe by default. inline styles collide with the
      // build-time CSP (default-src 'self'; no `unsafe-inline` allowance
      // for style-src), so styling must live in component style blocks.
      'svelte/no-at-html-tags': 'error',
      'svelte/no-inline-styles': 'error',
    },
  },

  // 7b. The worker holds the raw rows and the meta CSP is blind to worker
  //     traffic (06-09 measurement), so lint is the only guard there. On top of
  //     block 7's list, a worker may not construct another worker (a Blob-URL
  //     worker can rebuild any API from a string) or open the Cache API
  //     (`Cache.add(url)` performs a fetch). The one legitimate `new Worker`
  //     is the main-thread client in src/lib/import/, which is outside this
  //     glob. An override REPLACES a rule's options, so block 7's lists are
  //     re-spread, not restated.
  {
    files: ['src/lib/worker/**/*.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        ...NETWORK_GLOBALS,
        { name: 'Worker', message: PLATFORM02_MESSAGE },
        { name: 'SharedWorker', message: PLATFORM02_MESSAGE },
        { name: 'caches', message: PLATFORM02_MESSAGE },
      ],
      'no-restricted-properties': [
        'error',
        ...NETWORK_PROPERTIES,
        ...['self', 'globalThis'].flatMap((object) =>
          ['Worker', 'SharedWorker', 'caches'].map((property) => ({
            object,
            property,
            message: PLATFORM02_MESSAGE,
          })),
        ),
      ],
    },
  },

  // 8. Worker-boundary import rule. Scoped to src/**/*.ts and src/**/*.svelte
  //    but EXCLUDING the worker-side modules listed below.
  //
  //    Two bans share this ONE block on purpose. `no-restricted-imports` takes a
  //    single options object, and when two config blocks both match a file the
  //    later one's options REPLACE the earlier one's — a second block for the
  //    geo modules would have silently dropped the fflate restriction. That
  //    failure is invisible unless both bans are probed in the same test file,
  //    which is why the fflate probes and the geo probes sit side by side in
  //    tests/unit/guards/lint-guards.test.ts.
  //
  //    fflate: the only place it is imported is inside src/lib/worker/
  //    (ingest.worker.ts does path-only unzip + classify there). Anywhere else
  //    the page would block on large exports, since unzipping would run on the
  //    main thread.
  //
  //    The geo worker-only modules (D-12, T-06-23): the range table is inlined
  //    into the worker chunk and is 3.4 MB of base64 on the wire. A main-thread
  //    import would pull it into the main bundle — on a phone, for a lookup the
  //    main thread has no rows to feed, since the raw rows never leave the
  //    worker either. `city-table.ts` is named before it exists (plan 06-09),
  //    so the rule is already in force for the module that will be added.
  {
    files: ['src/**/*.ts', 'src/**/*.svelte'],
    ignores: [
      'src/lib/worker/**',
      // The worker-only modules may import each other, and so may the one
      // aggregator that lives outside src/lib/worker/ and reaches them:
      // `login-aggregate.ts` is imported only by worker files, and takes
      // `geoTableId()` — a provenance string — not the table. A probe in
      // lint-guards.test.ts names it, so the exemption cannot quietly widen.
      'src/lib/geo/country-table.ts',
      'src/lib/geo/country-lookup.ts',
      'src/lib/geo/city-table.ts',
      'src/lib/features/logins/login-aggregate.ts',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'fflate',
              message:
                'fflate is worker-only; unzip work runs inside src/lib/worker/ so the main thread stays responsive on large exports.',
            },
          ],
          patterns: [
            {
              // The bare-name entries catch the sibling spelling (`./country-table.ts`
              // from a file inside src/lib/geo/), which has no `geo/` segment.
              group: [
                '**/geo/country-table*',
                '**/geo/country-lookup*',
                '**/geo/city-table*',
                '**/country-table*',
                '**/country-lookup*',
                '**/city-table*',
              ],
              message:
                'D-12: the range table is worker-only. It is inlined into the worker chunk and the raw rows never leave the worker, so a main-thread import would pull a multi-megabyte table into the page bundle for a lookup it cannot feed. Resolve countries in the worker and send the codes across.',
            },
          ],
        },
      ],
    },
  },

  // 9. THE single sanctioned network call (phase 06, plan 06-11, D-16, T-06-43).
  //
  //    The opt-in city file is fetched from the MAIN thread by exactly one
  //    module, per the decision recorded at the end of plan 06-09 (option-a).
  //    This override is scoped to that one exact path and re-declares the whole
  //    `no-restricted-globals` list from block 7 MINUS the platform fetch entry:
  //    an override REPLACES a rule's options, it does not merge them, so listing
  //    only the delta would silently un-ban everything else in this file. The
  //    legacy request object, the socket, the transport, the event source, the
  //    peer connection, importScripts and the deferred-fetch API all stay banned
  //    here. Block 7's `no-restricted-properties` list is untouched, so the
  //    explicit-global spellings (`window.fetch`, `self.fetch`,
  //    `globalThis.fetch`) stay banned even in this file: it must use the bare
  //    call, which keeps the exemption one spelling wide.
  //
  //    `src/lib/worker/**` is NOT touched and never gets an exemption: it holds
  //    the raw rows. `tests/unit/guards/fetch-scan.test.ts` asserts that the
  //    platform fetch call appears in exactly one file under `src/`, this one,
  //    and `tests/unit/guards/lint-guards.test.ts` probes every edge of this
  //    glob. Keep this block AFTER block 7: later entries win.
  {
    files: ['src/lib/geo/city-fetch.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'fetchLater', message: PLATFORM02_MESSAGE },
        { name: 'XMLHttpRequest', message: PLATFORM02_MESSAGE },
        { name: 'WebSocket', message: PLATFORM02_MESSAGE },
        { name: 'WebTransport', message: PLATFORM02_MESSAGE },
        { name: 'EventSource', message: PLATFORM02_MESSAGE },
        { name: 'RTCPeerConnection', message: PLATFORM02_MESSAGE },
        { name: 'importScripts', message: PLATFORM02_MESSAGE },
      ],
    },
  },
];
