import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'node:url';

/**
 * The PRE-DEPLOY gate (phase 07, plan 07-01, D-11, D-14, T-07-04).
 *
 * It serves the `dist/` that is ALREADY on disk, under the real GitHub Pages
 * project subpath, and runs the shared deployed-build spec against it. The spec
 * is deliberately the same file plan 07-02 points at the live URL: one set of
 * assertions, two base URLs, so what the gate proves is what the live site is
 * held to.
 *
 * ## No build, ever
 *
 * The `webServer` command is `vite preview` and nothing else. A gate that built
 * would test the build it made, not the artifact that gets uploaded — and the
 * artifact is what leaves this machine. So this config never runs a build, and
 * `tests/unit/guards/deploy-gate.test.ts` reads this file to prove it.
 *
 * ## No geo fixture, ever
 *
 * The browser tests run against the committed 377-byte documentation-range
 * country table, selected in exactly one place in this repository: the
 * `webServer.env` of the main `playwright.config.ts`, guarded by
 * `tests/unit/guards/geo-seam.test.ts`. A DEPLOY build must not carry that
 * table, and it must not carry the real one either unless the deploy job
 * generated it — this gate is here to check exactly that. So the deploy build
 * has no fixture, this config must never select one, and nothing in this
 * directory may name or set the switch (the same guard asserts its absence).
 *
 * ## The base must be absolute and slash-terminated
 *
 * `cityAssetUrl` validates `import.meta.env.BASE_URL` against a pattern that
 * admits a leading slash, a trailing slash, single path segments and no `.` or
 * `..` segment, and it concatenates the value onto the page origin. A base that
 * did not end in a slash, or that was relative, would produce a request URL one
 * path segment off. Failing fast here is far clearer than a 404 in the gate.
 */

const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));

/** The default base: the repository name, which is the Pages project subpath. */
const DEFAULT_BASE = '/wot-gdpr-stats-visualizer/';

function resolveBase(): string {
  const base = process.env.VITE_BASE || DEFAULT_BASE;
  if (!base.startsWith('/') || !base.endsWith('/') || base.length < 2) {
    throw new Error(
      `VITE_BASE must be an absolute path with exactly one leading and one trailing slash ` +
        `(got ${JSON.stringify(base)}). The Pages subpath looks like "/wot-gdpr-stats-visualizer/".`,
    );
  }
  if (
    base.includes('//') ||
    base.split('/').some((segment) => segment === '.' || segment === '..')
  ) {
    throw new Error(`VITE_BASE must be single path segments (got ${JSON.stringify(base)}).`);
  }
  return base;
}

const base = resolveBase();
const baseURL = `http://localhost:4173${base}`;

export default defineConfig({
  // This config's own directory, so it can only ever list the specs that belong
  // to the deploy gate. `testDir: '.'` resolves against the config file's
  // directory, which is what Playwright does for a `testDir` that is relative.
  testDir: '.',
  // BOTH specs, and the alternation is deliberate. `deployed-build.spec.ts` is
  // the served proof and is shared with plan 07-02's post-deploy smoke;
  // `dist-artifact.spec.ts` is the filesystem proof of what the artifact
  // contains, and it is what stops at a subpath test being mistaken for a
  // completeness test — a file can be unserved and still be uploaded. Naming
  // them as two alternatives rather than a bare `*.spec.ts` keeps the list
  // explicit, so a third spec added here is a decision someone had to make.
  testMatch: /(?:deployed-build|dist-artifact)\.spec\.ts/,
  // One worker: this is a serial proof over one served artifact, and the
  // resource contention a self-hosted CI runner suffers from is worse than the
  // wall time saved. The gate is not on the pull-request path.
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  // Global timeout: a hung teardown (see the main config's comment) must fail
  // with the test's own name attached rather than stalling until the runner's
  // own limit.
  globalTimeout: 10 * 60 * 1000,
  timeout: 120000,
  use: {
    // TRAILING SLASH, and it matters. `deployed-build.spec.ts` navigates with
    // `goto('./')`, which Playwright resolves against this value: with the
    // slash it stays inside the subpath, and a `goto('/')` would silently leave
    // it and hit the preview server's root instead of the app.
    baseURL,
    trace: 'retain-on-failure',
    locale: 'en-US',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // Direct binary invocation, for the same reason the main config's is:
    // Playwright spawns this command in its own process group and tears the
    // GROUP down with SIGKILL, so a pnpm-wrapped server survives as an orphan
    // holding the stdio pipes open and hangs teardown until globalTimeout. See
    // tests/unit/guards/webserver-teardown.test.ts.
    //
    // `preview` and NOTHING ELSE. This config tests the dist already on disk,
    // which is the dist that will be uploaded, so it must not build one.
    command: './node_modules/.bin/vite preview',
    // Playwright defaults `cwd` to the config file's directory, and this file
    // is two directories below the repository root — so without this, vite
    // would look for a `dist` inside `tests/deploy` and serve nothing.
    cwd: REPO_ROOT,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120000,
    // `env` MERGES with `process.env`, so the preview inherits the developer's
    // or the runner's own environment. Only the base is set here: the preview
    // has to mount at the same subpath the build used, or every asset URL baked
    // into the bundle would 404.
    env: { VITE_BASE: base },
  },
});

export { base, baseURL, REPO_ROOT };
