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
  // TWO projects, and the routing between them is the point (07-03, D-04).
  //
  // A spec whose file name starts with `touch-` runs ONLY on `chromium-mobile`,
  // and every other spec runs ONLY on `chromium` — so every spec in the
  // repository still runs exactly once, and the touch specs really do run with
  // a touch pointer instead of quietly asserting mouse behaviour on a
  // mouse-capable browser. A `touch-` spec left off this split would run on
  // the desktop project and pass while testing nothing about touch.
  projects: [
    {
      name: 'chromium',
      testIgnore: '**/touch-*.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      // Desktop Chrome at 375x812 with touch enabled, NOT one of Playwright's
      // phone descriptors: those carry a WebKit default browser, WebKit is not
      // installed in CI, and this project is Chrome-first (D-04). `isMobile`
      // and `hasTouch` are what make `tap()` and a real touch `pointerover`
      // possible; the viewport is what makes the layout the phone one.
      name: 'chromium-mobile',
      testMatch: '**/touch-*.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 375, height: 812 },
        isMobile: true,
        hasTouch: true,
      },
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
  //
  // 26 min is 06-12's raise, for the country-map browser specs. 218 tests
  // projected 1150 s and a floor of 1495 s against 1500 s; one more test failed
  // the guard. The map specs add seven, so 225 tests project
  // 330 + 5 * (225 - 96) + 210 = 1185 s, a floor of 1540.5 s, and
  // ceil(1540.5 / 60) = 26 min. The wrapper is 28 min and the job 36 min, the
  // same G + 2 and W + 8 relationship as before; 26 min holds up to 228 tests.
  //
  // 27 min is 06-14's raise, for the login scale spec and the Phase 6
  // zero-network test. The scale spec is priced as a block, like the other two:
  // five tests that share one 12,000-row import, measured at 4.2 s for the whole
  // file and allowed 13 s (the runner factor the guard already uses, rounded
  // up; an ESTIMATE until a CI run measures it). 234 tests project
  // 330 + 5 * (234 - 86 - 5 - 5 - 5) + 120 + 90 + 13 = 1218 s, a floor of
  // 1583.4 s, and ceil(1583.4 / 60) = 27 min. The wrapper is 29 min and the job
  // 37 min, the same G + 2 and W + 8; 27 min holds up to 239 tests.
  //
  // 27 min is UNCHANGED for 07-03, and this line is the record of that. The
  // plan added the `chromium-mobile` project and five touch specs, and
  // `playwright test --list` counts BOTH projects — the `touch-` routing took
  // nothing away from the desktop project, it gave the five a project of their
  // own, so the count is 239 in 23 files. MEASURED:
  //
  //   E = 330 + 5 * (239 - 86 - 5 - 5 - 5) + 120 + 90 + 13
  //     = 1243 s
  //   1.3 * E = 1615.9 s, and ceil(1615.9 / 60) = 27 min
  //
  // G = 27, W = 29, J = 37: no limit moved, and 07-03 raised nothing. It was
  // also the LAST count 27 min covers — 240 tests project 1248 s and a floor of
  // 1622.4 s against this 1620 s — so the next browser test added anywhere in
  // the repository fails tests/unit/guards/ci-budget.test.ts and forces the
  // same raise, all three together.
  //
  // 28 min is 07-04's raise, and this comment is where its arithmetic lives.
  // The three touch specs that put the tooltip on the remaining chart surfaces
  // are three more LISTED tests, because `playwright test --list` counts BOTH
  // projects and the `touch-` routing took nothing away from the desktop one.
  // 242 tests in 23 files, MEASURED:
  //
  //   E = 330 + 5 * (242 - 86 - 5 - 5 - 5) + 120 + 90 + 13
  //     = 1258 s
  //   1.3 * E = 1635.4 s, and ceil(1635.4 / 60) = 28 min
  //
  // G = 28, W = 30 and J = 38: all three moved together, which is the same
  // relationship as every raise before it (the wrapper is G + 2 and the job is
  // W + 8). 28 min holds up to 248 tests.
  //
  // 29 min is 07-05's raise, and this comment is where its arithmetic lives.
  // The plan added one sweep test for the padding block, three bounding-box
  // touch-target specs and five more sweep tests (the full dashboard, activity
  // and logins, banners and long text, the city opt-in's five states, and the
  // tables-and-map test) — nine listed tests. The first four (243 after the
  // tracer, 246 after the touch specs) still fit 28 min and the last five are
  // what crossed it: 251 tests in 25 files, MEASURED:
  //
  //   E = 330 + 5 * (251 - 86 - 5 - 5 - 5) + 120 + 90 + 13
  //     = 1303 s
  //   1.3 * E = 1693.9 s, and ceil(1693.9 / 60) = 29 min
  //
  // G = 29, W = 31 and J = 39: all three moved together, the same G + 2 and
  // W + 8 relationship as every raise before it. 29 min holds up to 258
  // listed tests (258 project 1338 s and a floor of 1739.4 s against 1740 s).
  //
  // 30 min is 09-06's raise, and this comment is where its arithmetic lives.
  // Phase 9 added two listed tests, and both run far longer than the 5 s a
  // browser test is credited with, so they are held back from the per-test
  // count and priced as one block — together with the stage the Phase 5
  // zero-network test gained, which is not a listed test at all. 258 tests in
  // 28 files, MEASURED:
  //
  //   E = 330 + 5 * (258 - 86 - 5 - 5 - 5 - 2) + 120 + 90 + 13 + 32
  //     = 1360 s
  //   1.3 * E = 1768 s, and ceil(1768 / 60) = 30 min
  //
  // G = 30, W = 32 and J = 40: all three moved together, the same G + 2 and
  // W + 8 relationship as every raise before it. 30 min holds up to 262
  // listed tests. Left unpriced, 258 would have projected 1338 s and a floor of
  // 1739.4 s — 0.6 s of slack under the 1740 s this line replaced.
  //
  // 31 min is 10-06's raise, and this comment is where its arithmetic lives.
  // The plan added two listed tests, the large three-account import and its
  // game-filter flow, in one serial describe that imports a 1.4 MB archive (a
  // 54,000-row currency file, 20,000 sessions, 7,000 vehicle rows) ONCE. They are
  // priced as a block with the growth of the two Phase 9 multi-account tests,
  // which gained steps in plans 10-02 to 10-05, so they are held back from the
  // per-test count and added back as one allowance. 260 tests in 29 files,
  // MEASURED (`playwright test --list`):
  //
  //   E = 330 + 5 * (260 - 86 - 5 - 5 - 5 - 2 - 2) + 120 + 90 + 13 + 32 + 49
  //     = 1409 s
  //   1.3 * E = 1831.7 s, and ceil(1831.7 / 60) = 31 min
  //
  // The 49 s is MEASURED on this machine, one worker, slowest of three runs,
  // times the 3x runner factor the guard already uses, rounded up: the new file
  // takes 8.1 s end to end, and the two Phase 9 tests grew from 3.6 s and 5.7 s
  // to 10.1 s and 7.2 s, +8.0 s, so (8.1 + 8.0) * 3 = 48.4 s.
  //
  // G = 31, W = 33 and J = 41: all three moved together, the same G + 2 and
  // W + 8 relationship as every raise before it. 31 min holds up to 264 listed
  // tests (264 project 1429 s and a floor of 1857.7 s against 1860 s). Left
  // unpriced (Phase 9's formula alone), 260 would have projected 1370 s and a
  // floor of 1781 s, 19 s under the 1800 s this raise replaces: it looks
  // passable and is not, because the measured cost of the large import and of the
  // grown Phase 9 tests is nowhere in it.
  globalTimeout: 31 * 60 * 1000,
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
    // The ONE place in this repository that selects the geo fixture table.
    // Every RFC 5737 / RFC 3849 documentation address is `ZZ` in the real
    // DB-IP data, so the browser fixtures would otherwise shade no country at
    // all (D-17, RESEARCH Pitfall 2). The recorded checkpoint decision
    // (option-a) keeps D-17's "no real IPs committed" literally true and points
    // the build at the committed 377-byte fixture instead — see
    // `scripts/geo/lib/geo-alias.ts`.
    //
    // `env` MERGES with `process.env` rather than replacing it, so the build
    // and the preview inherit this AND the developer's own environment; that is
    // why `playwright.config.ts` gaining a stray `GEO_FIXTURE` outside this
    // object would be a defect, and `tests/unit/guards/geo-seam.test.ts` reads
    // the file to prove it does not.
    env: { GEO_FIXTURE: '1' },
  },
});
