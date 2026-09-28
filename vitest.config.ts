import { defineConfig } from 'vitest/config';

// =============================================================================
// Vitest config for `pnpm run test:unit`.
// =============================================================================
//
// Scoped to tests/unit/**/*.test.ts via an explicit test.include. The default
// Vitest glob also matches tests/e2e/*.spec.ts, which causes Playwright spec
// files to be collected and crash when loaded under the Vitest runner — so
// the include is load-bearing and must stay explicit.
//
// Tests run in the Node environment.
//
// =============================================================================
// .svelte.ts files under test (01-04)
// =============================================================================
//
// tests/unit/ingest-client.test.ts imports `IngestClient` from
// src/lib/worker-client.svelte.ts. That class uses Svelte 5 runes
// (`$state(...)`). The Svelte 5 runes compiler rewrites those calls
// at compile time; in a plain Node test we have no compile pass and
// `$state` would throw ReferenceError at module load.
//
// We avoid the compile pass entirely: tests/unit/setup.ts defines
// `$state` as a passthrough global, so the file loads as ordinary ES
// module source and `$state(x)` returns `x`. The unit tests exercise
// state transitions through the public field reads and postMessage
// call log; reactivity is irrelevant for these assertions.
//
// The alternative — adding the Svelte plugin to this config — was
// tried and rejected. With the plugin active, Vite's prebundle pass
// follows `svelte/internal/client` (browser export condition) and
// reaches `rolldown/runtime.js`, which imports `node:module`. Under
// browser conditions that import is unresolvable, and Vite errors at
// startup with a `node:module / Tsconfig not found` resolver crash
// before any test runs. Disabling optimizeDeps does not help: the
// Svelte plugin forces `optimizeDeps.disabled: 'build'`, which still
// prebundles during the SSR build pass Vitest uses.
//
// tsconfig is pointed at tsconfig.test.json (standalone, no extends)
// so the OXC resolver stays happy.
// =============================================================================

export default defineConfig({
  tsconfig: './tsconfig.test.json',
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['tests/unit/setup.ts'],
  },
});
