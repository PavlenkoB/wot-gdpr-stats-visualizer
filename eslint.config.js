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
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: PLATFORM02_MESSAGE },
        { name: 'fetchLater', message: PLATFORM02_MESSAGE },
        { name: 'XMLHttpRequest', message: PLATFORM02_MESSAGE },
        { name: 'WebSocket', message: PLATFORM02_MESSAGE },
        { name: 'WebTransport', message: PLATFORM02_MESSAGE },
        { name: 'EventSource', message: PLATFORM02_MESSAGE },
        { name: 'RTCPeerConnection', message: PLATFORM02_MESSAGE },
        { name: 'importScripts', message: PLATFORM02_MESSAGE },
      ],
      'no-restricted-properties': [
        'error',
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

  // 8. fflate worker-boundary rule. Scoped to src/**/*.ts and src/**/*.svelte
  //    but EXCLUDING src/lib/worker/** — that's the only place fflate is
  //    imported (ingest.worker.ts does path-only unzip + classify inside
  //    the worker). Anywhere else, the page would block on large exports
  //    since unzipping runs on the main thread.
  {
    files: ['src/**/*.ts', 'src/**/*.svelte'],
    ignores: ['src/lib/worker/**'],
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
        },
      ],
    },
  },
];
