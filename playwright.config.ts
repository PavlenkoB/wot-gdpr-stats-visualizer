import { defineConfig, devices } from '@playwright/test';

/**
 * Phase 1 has a single end-to-end spec (tests/e2e/zero-network.spec.ts).
 * It always runs against the BUILT app served by `vite preview`, never
 * against `vite dev`. The dev server has an HMR websocket and no CSP,
 * so a zero-network assertion there would be meaningless.
 *
 * webServer.reuseExistingServer is `false` on purpose: a stale preview
 * build from a prior run must never be tested against the current
 * source. CI never has an existing server, so this costs nothing; on
 * a developer machine a hot `pnpm test:e2e` re-runs the build.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/*.spec.ts',
  // CI runs on a self-hosted runner where multi-worker test execution
  // hits resource contention (one per-test timeout cascade → global
  // cancel with no per-test output). 1 worker is ~5.5 min locally and
  // is the only configuration that has produced complete, traceable
  // CI runs. Locally we keep Playwright's default (CPU-count) workers
  // for faster feedback.
  workers: process.env.CI ? 1 : undefined,
  retries: 0,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Global timeout inside Playwright: fail loudly with diagnostics
  // (which test, which step) instead of waiting for the shell `timeout
  // 10m` wrapper to fire and produce "operation canceled" with no
  // context. 8 min gives 2 min of headroom under the 10 min wrapper.
  globalTimeout: 8 * 60 * 1000,
  timeout: 120000,
  webServer: {
    // Direct binary invocation (NOT `pnpm run build && pnpm run preview`).
    // pnpm's script runner spawns the target binary into its OWN process
    // group, separate from the shell Playwright itself spawns. Playwright's
    // default teardown (no `gracefulShutdown` configured) SIGKILLs only the
    // process GROUP of the shell it spawned, so a pnpm-wrapped `vite preview`
    // survives as an orphan holding the shell's inherited stdio pipes open —
    // Node's 'close' event then never fires, hanging teardown until
    // globalTimeout. Invoking the vite binary directly keeps it in the same
    // process group as the spawned shell, so the group-kill reaches it and
    // 'close' fires immediately. See .planning/debug/resolved/ci-e2e-cancel.md
    // and tests/unit/webserver-teardown.test.ts.
    command: './node_modules/.bin/vite build && ./node_modules/.bin/vite preview',
    url: 'http://localhost:4173',
    reuseExistingServer: false,
    timeout: 120000,
  },
});
