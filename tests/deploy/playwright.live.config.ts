import { defineConfig, devices } from '@playwright/test';

/**
 * The POST-DEPLOY smoke (phase 07, plan 07-02, D-14, T-07-12).
 *
 * It runs the same `deployed-build.spec.ts` the pre-deploy gate runs, against
 * the live GitHub Pages URL instead of a local preview. One set of assertions,
 * two servers: what the gate proved about the artifact is what the live site is
 * held to, and there is no second copy of the expectations to drift.
 *
 * ## The only difference from the gate config is the baseURL
 *
 * The spec derives every path from the `baseURL` test option, so pointing it at
 * another origin changes nothing in the spec. That is what makes the two runs
 * comparable, and it is why nothing here re-states the subpath.
 *
 * ## No server, and no build
 *
 * There is nothing to serve: the site is already live, and a local server here
 * would be a second copy of a site that is the thing under test. So this config
 * launches nothing. `tests/unit/guards/deploy-workflow.test.ts` reads it and
 * fails if a server key ever appears.
 *
 * ## No test-data table, ever
 *
 * The live site has no test-data table, and this config must never be able to
 * select one — the same rule the gate config is held to, for the same reason.
 * Nothing in this directory may name or set the switch, and the guard asserts
 * its absence.
 *
 * ## One retry, and it is reported
 *
 * A freshly published Pages site can take a few seconds to serve the new files,
 * so `retries: 1` absorbs that without hiding it: a test that passes on retry
 * is reported as `flaky`, which is a signal, not a silence. One worker, because
 * this is a serial proof over one site and the smoke is not on the pull-request
 * path.
 */

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1']);

/** The deployed URL, as the `deploy` job's step output. */
const LIVE_URL = process.env.LIVE_URL;

if (!LIVE_URL) {
  throw new Error(
    'LIVE_URL is required: the post-deploy smoke runs against the deployed site, and there is ' +
      "no sensible default. The Deploy workflow sets it from the deploy job's page_url output; " +
      'a local run sets it to a served build, e.g. http://localhost:4173/wot-gdpr-stats-visualizer/.',
  );
}

let parsed: URL;
try {
  parsed = new URL(LIVE_URL);
} catch {
  throw new Error(`LIVE_URL is not a parseable URL (got ${JSON.stringify(LIVE_URL)}).`);
}

// http is accepted ONLY for the loopback names. The local case exists so this
// config can be proven against a preview server before it is trusted against
// the real site; anything else over http would put the assertions on a site
// that is not the one being deployed.
if (parsed.protocol === 'http:') {
  if (!LOOPBACK_HOSTS.has(parsed.hostname)) {
    throw new Error(
      `LIVE_URL must be https, except on localhost or 127.0.0.1 (got ${JSON.stringify(LIVE_URL)}).`,
    );
  }
} else if (parsed.protocol !== 'https:') {
  throw new Error(`LIVE_URL must be an http or https URL (got ${JSON.stringify(LIVE_URL)}).`);
}

// ONE trailing slash, because the spec navigates with `goto('./')`, which
// Playwright resolves against baseURL: without the slash that resolves to the
// origin root, which the Pages project also serves — so a missing slash would
// produce a confusing partial failure rather than an obvious one.
const baseURL =
  parsed.origin + (parsed.pathname.endsWith('/') ? parsed.pathname : `${parsed.pathname}/`);

export default defineConfig({
  // This config's own directory, so it can only ever list the specs that belong
  // to the deploy smoke.
  testDir: '.',
  // The shared served spec, and NOT the artifact spec: that one reads a build's
  // filesystem, and a live URL has no filesystem. A spec added here is a
  // decision someone had to make, which is why the name is written out rather
  // than globbed.
  testMatch: /deployed-build\.spec\.ts/,
  workers: 1,
  retries: 1,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  globalTimeout: 15 * 60 * 1000,
  // The opt-in test's own 240 s budget leaves room here; this is the per-test
  // ceiling for everything else.
  timeout: 120000,
  use: {
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
});

export { baseURL };
