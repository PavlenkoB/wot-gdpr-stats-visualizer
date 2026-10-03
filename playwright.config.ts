import { defineConfig, devices } from '@playwright/test';

/**
 * Phase 1 has a single end-to-end spec (tests/e2e/guards/zero-network.spec.ts).
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
    // The app groups numbers by the VIEWER's locale (05-08, D-25), so a spec
    // that asserts on a grouped number is otherwise asserting on whatever the
    // machine's locale happens to be. This pins the BROWSER side of that
    // assertion; the Node side — the formatter a spec calls to build its
    // expected string — is pinned by `tests/e2e/_support/pin-locale.ts`, which every
    // spec importing `ui-copy` loads. Both sides have to be pinned, and they
    // are pinned separately, because they are separate default locales.
    locale: 'en-US',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Global timeout inside Playwright: fail loudly with diagnostics
  // (which test, which step) instead of waiting for the shell `timeout
  // 20m` wrapper to fire and produce "operation canceled" with no
  // context.
  //
  // 19 min was raised from 18 for the 168 listed tests: the same arithmetic
  // (330 s pre-phase baseline + 5 s per added test + a 120 s allowance for
  // the 60,000-session scale spec) projects 835 s, and the 1.3x floor
  // tests/unit/guards/ci-budget.test.ts enforces wants 1085.5 s — so 18 min
  // (1080 s) no longer passed and the guard was right to fail.
  //
  // 20 min is 05-15's raise, for the ten new spend specs: 178 tests project
  // 885 s and the floor is 1150.5 s, so 19 min (1140 s) stopped passing. The
  // guard named the value rather than the plan, and the plan's own budget rule
  // said to raise all three together.
  //
  // 25 min is 05-16's raise, and this comment is where its arithmetic lives.
  // Every input below is either measured on this machine or an ESTIMATE
  // labelled as one; tests/unit/guards/ci-budget.test.ts holds the same constants and
  // enforces the 1.3x floor against them, so this comment cannot drift away
  // from the number that is actually compared.
  //
  //   L = 184 tests in 16 files   MEASURED (`playwright test --list`)
  //   E = 330                     pre-phase baseline, ESTIMATE (04-13)
  //     + 5 * (184 - 86 - 5 - 5)  88 ordinary tests at 5 s each  = 440
  //     + 120                    60,000-session scale spec, block
  //     +  90                    50,000-operation scale spec, block
  //     = 980 s
  //   G = ceil(1.3 * 980 / 60) + 3
  //     = ceil(21.23) + 3
  //     = 22 + 3
  //     = 25 min      (and 25 >= the rule's floor of 15)
  //
  // The two block allowances are subtracted from the per-test count because
  // each of those files imports its export ONCE and its other tests read the
  // same DOM — see the header of tests/unit/guards/ci-budget.test.ts. 20 min was the
  // value before this raise, which is what the guard rejected: 05-16 added one
  // zero-network test and five finance-scale tests, and the projection moved
  // from 885 s to 980 s, so the 1.3x floor moved from 1150.5 s to 1274 s and
  // 20 min (1200 s) no longer passed.
  //
  // The three limits are ONE relationship, not three numbers, and they move
  // together: the wrapper is globalTimeout + 90 s and the job is the wrapper +
  // 300 s. 05-14 raised all three for its eleven new specs, 05-15 for its ten,
  // and 05-16 for its six. The 330 s baseline is an ESTIMATE, and it is the
  // input most likely to be wrong.
  globalTimeout: 25 * 60 * 1000,
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
    // and tests/unit/guards/webserver-teardown.test.ts.
    command: './node_modules/.bin/vite build && ./node_modules/.bin/vite preview',
    url: 'http://localhost:4173',
    reuseExistingServer: false,
    timeout: 120000,
  },
});
