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
// tests/unit/import/ingest-client.test.ts imports `IngestClient` from
// src/lib/import/worker-client.svelte.ts. That class uses Svelte 5 runes
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
// .testTimeout (flakiness fix, 2026-10-02)
// =============================================================================
//
// Vitest's default per-test timeout is 5 s, which this suite was never
// budgeted against: it runs ~46 files across ~10 parallel workers, and one of
// those files (ci-budget.test.ts) shells out to `playwright test --list` while
// every other worker competes for the same ten cores. Two tests then fail on
// STARVATION rather than on anything they assert — measured in isolation they
// take 770 ms and 512 ms respectively, and roughly one full-suite run in four
// pushed either past 5 s:
//
//   Error: Test timed out in 5000ms.
//     FAIL tests/unit/guards/ci-budget.test.ts > playwright test --list ...
//     FAIL tests/unit/playtime/playtime-model.test.ts > agrees with the oracle across a
//          seeded random export spanning two years
//
// 20 s leaves the slowest legitimate test (~0.8 s) an order of magnitude of
// headroom while still failing a genuine hang. It is a ceiling, not an
// expectation: nothing in this suite is meant to take anywhere near it.
//
// This does NOT paper over a slow test becoming slow — it only stops a busy
// machine from failing a test that is correct. The one flake that was a REAL
// defect (a fixture whose zip bytes changed every two seconds, so the dedup
// gate's hash-identical re-drop stopped matching) is fixed at its source in
// tests/fixtures/export-fixtures.ts, with a guard in sample-export-shape.
// =============================================================================

export default defineConfig({
  tsconfig: './tsconfig.test.json',
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['tests/unit/setup.ts'],
    testTimeout: 20_000,
  },
});
