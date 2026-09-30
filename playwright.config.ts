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
  // cancel with no per-test output). 1 worker is the only configuration
  // that has produced complete, traceable CI runs. Measured at 1 worker
  // on the development machine: 109 tests in 1.8 min (Phase 1's 20-test
  // suite was ~5.5 min). The runner's own cost is still an ESTIMATE, not
  // a measurement — no CI run has executed the phase-4 suite. Locally we
  // keep Playwright's default (CPU-count) workers for faster feedback:
  // 40.9 s for the same 109 tests.
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
  // 17m` wrapper to fire and produce "operation canceled" with no
  // context. 15 min is 1.67x the 540 s the 109 listed tests project to
  // (330 s pre-phase baseline + 5 s per added test + a 120 s allowance
  // for the 60,000-session scale spec). The 1.3x floor
  // tests/unit/ci-budget.test.ts enforces would pass at 12 min; the
  // extra three minutes are deliberate headroom, not slack the suite is
  // expected to use, because the 330 s baseline is an estimate.
  globalTimeout: 15 * 60 * 1000,
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
