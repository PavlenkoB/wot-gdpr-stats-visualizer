import { createHash } from 'node:crypto';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import {
  validateCityManifest,
  type CityManifestFile,
} from '../../scripts/geo/lib/city-manifest.ts';
import { buildSampleExport, SAMPLE_NICKNAME } from '../fixtures/export-fixtures.ts';
import { buildLoginsHandExport } from '../fixtures/logins-fixtures.ts';
import {
  SYNTHETIC_ZIP_NAME,
  importExport,
  loginHistoryBlock,
  openSection,
} from '../e2e/_support/helpers.ts';

/**
 * The deployed-build proof (phase 07, plans 07-01 and 07-02, D-11, D-14,
 * T-07-03, T-07-04).
 *
 * ## This file is deliberately shared
 *
 * Plan 07-01 runs it against a local `vite preview` of the built `dist`, under
 * the real Pages subpath. Plan 07-02 runs the SAME file against the live URL,
 * by pointing `baseURL` at it. One set of assertions, two servers: what the
 * pre-deploy gate proves is exactly what the live site is held to, and there is
 * no second copy of the expectations to drift.
 *
 * ## Why the base is read from `baseURL` and never written here
 *
 * Every assertion below is about the base path, and every one of them derives
 * that path from the `baseURL` test option — the pathname of whatever this run
 * was pointed at. Nothing in this file contains a second copy of the string
 * `/wot-gdpr-stats-visualizer/`, so switching servers cannot leave one test
 * asserting a path the others are not using. That is the difference between a
 * shared spec and two specs that agree today.
 */

test.describe('the built app served under its base path', () => {
  /**
   * Open the app and wait for the shell and the worker.
   *
   * `'./'` rather than `'/'`: Playwright resolves a relative goto against
   * `baseURL`, so `'./'` lands inside the subpath while a leading slash would
   * resolve to the server root and silently leave the app the artifact is
   * actually served at.
   *
   * `data-worker-ready` is set by the ingest worker itself, so waiting on it is
   * waiting for the pipeline to exist — the same signal `tests/e2e` uses, and
   * the reason a build whose worker chunk 404s fails here instead of passing
   * silently.
   */
  async function openApp(page: Page): Promise<void> {
    await page.goto('./');
    await expect(page.locator('main')).toHaveAttribute('data-worker-ready', 'true', {
      timeout: 10_000,
    });
  }

  /**
   * The base path this run is pointed at: `baseURL`'s own pathname.
   *
   * The `string | undefined` is Playwright's own type for the `baseURL` option,
   * which is optional on a config. A missing one would mean a spec navigated by
   * absolute URL, so the assertion that it is present is the first half of
   * deriving the base from it rather than writing the path down here.
   */
  function basePathOf(baseURL: string | undefined): string {
    expect(
      baseURL,
      'this spec derives every path from baseURL; a run without one cannot',
    ).toBeTruthy();
    return new URL(baseURL as string).pathname;
  }

  test('the app loads, its worker and favicon resolve under the base, and no request leaves it', async ({
    page,
    context,
    baseURL,
  }) => {
    const base = basePathOf(baseURL);

    // Attached BEFORE navigation, so the module graph, the eager worker script
    // fetch and the favicon are all inside the collected set. A collector
    // attached after `goto` would miss exactly the requests most likely to
    // carry a wrong base.
    const requests: string[] = [];
    const workerUrls: string[] = [];
    const responseStatuses = new Map<string, number>();
    context.on('request', (req) => requests.push(req.url()));
    page.on('worker', (worker) => workerUrls.push(worker.url()));
    page.on('response', (res) => responseStatuses.set(res.url(), res.status()));

    await openApp(page);
    await page.waitForLoadState('networkidle');

    // The page itself is at the base. If the app were served at the origin root
    // instead, everything else here would still pass and the deployment would
    // still be wrong — so this is asserted first, on its own.
    expect(new URL(page.url()).pathname).toBe(base);

    // Exactly one worker, and it is served from the base — a worker chunk whose
    // URL was not rewritten is the classic subpath failure, and it is invisible
    // to a request count because the page still renders.
    expect(workerUrls).toHaveLength(1);
    const pageOrigin = new URL(page.url()).origin;
    expect(workerUrls[0]!.startsWith(`${pageOrigin}${base}assets/`)).toBe(true);
    const workerStatus = responseStatuses.get(workerUrls[0]!);
    expect(workerStatus, `no response recorded for the worker script ${workerUrls[0]}`).toBe(200);

    // The favicon resolves under the base too, and is actually served. The
    // `href` equality catches an unrewritten URL (it would read `/favicon.svg`
    // — the origin root, one path segment short); the fetch catches a rewrite
    // that points at something the host does not have.
    const iconHref = await page.locator('link[rel="icon"]').first().getAttribute('href');
    expect(iconHref).toBe(`${base}favicon.svg`);
    const iconResponse = await page.request.get(`${base}favicon.svg`);
    expect(iconResponse.status()).toBe(200);

    // Every request the load made is same-origin AND under the base. This is
    // the subpath invariant in one assertion: an unrewritten asset URL is
    // same-origin but escapes the base, and a CDN-hosted font or analytics
    // beacon would leave the origin.
    const escaped = requests.filter((url) => {
      const parsed = new URL(url);
      return parsed.origin !== pageOrigin || !parsed.pathname.startsWith(base);
    });
    expect(escaped, `requests outside the base or off-origin: ${escaped.join(', ')}`).toEqual([]);

    // Nothing 4xx'd or 5xx'd. A subpath deployment fails by 404, and a count of
    // requests proves nothing if one of them was the app asking for itself.
    const failed = [...responseStatuses.entries()].filter(([, status]) => status >= 400);
    expect(
      failed,
      `responses with status 400 or above: ${failed.map(([u, s]) => `${u} ${s}`).join(', ')}`,
    ).toEqual([]);
  });

  // ---------------------------------------------------------------------------
  // D-15 / T-07-03 — the policy itself
  // ---------------------------------------------------------------------------

  test("the served build carries the CSP meta tag with all five directives and connect-src exactly 'self'", async ({
    page,
  }) => {
    await openApp(page);
    const csp = await page
      .locator('meta[http-equiv="Content-Security-Policy"]')
      .first()
      .getAttribute('content');
    expect(csp, 'the built HTML must carry the CSP meta tag').not.toBeNull();

    const directives = new Map(
      csp!
        .split(';')
        .map((part) => part.trim())
        .filter((part) => part !== '')
        .map((part) => {
          const [name, ...value] = part.split(/\s+/);
          return [name!, value.join(' ')] as const;
        }),
    );

    // The NAME set, not just `connect-src`. A deploy build assembled differently
    // from the pull-request one could silently drop a directive, and asserting
    // only the one this phase cares about would let `base-uri` or
    // `form-action` disappear unnoticed. Five in, five out.
    expect([...directives.keys()].sort()).toEqual([
      'base-uri',
      'connect-src',
      'default-src',
      'form-action',
      'object-src',
    ]);

    // The one directive that is not a deny, because the product makes exactly
    // one sanctioned request: the opt-in city file, same-origin (D-16).
    expect(directives.get('connect-src')).toBe("'self'");
    expect(directives.get('default-src')).toBe("'self'");
    expect(directives.get('object-src')).toBe("'none'");
    expect(directives.get('base-uri')).toBe("'none'");
    expect(directives.get('form-action')).toBe("'none'");
  });

  // ---------------------------------------------------------------------------
  // D-14 / T-07-03 — nothing is requested after the load, at a subpath
  // ---------------------------------------------------------------------------

  test('no request follows the load baseline, through a real import, with no CSP violation', async ({
    page,
    context,
    baseURL,
  }) => {
    const base = basePathOf(baseURL);

    // Installed before navigation, so a violation raised by the first
    // application script is caught and not only one raised later.
    await page.addInitScript(() => {
      const w = window as unknown as { __cspViolations: string[] };
      w.__cspViolations = [];
      document.addEventListener(
        'securitypolicyviolation',
        (event) => {
          w.__cspViolations.push((event as SecurityPolicyViolationEvent).violatedDirective);
        },
        true,
      );
    });

    const requests: string[] = [];
    const workerUrls: string[] = [];
    context.on('request', (req) => requests.push(req.url()));
    page.on('worker', (worker) => workerUrls.push(worker.url()));

    await openApp(page);
    await page.waitForLoadState('networkidle');
    const baseline = requests.length;
    expect(
      baseline,
      'the baseline includes the module graph and the eager worker fetch',
    ).toBeGreaterThan(0);

    await page.getByTestId('file-input').setInputFiles({
      name: SYNTHETIC_ZIP_NAME,
      mimeType: 'application/zip',
      buffer: Buffer.from(buildSampleExport()),
    });
    await expect(page.getByTestId('identity-nickname')).toHaveText(SAMPLE_NICKNAME);
    await page.waitForTimeout(500);

    const after = requests.slice(baseline);
    expect(after, `requests after the import: ${after.join(', ')}`).toEqual([]);

    // Still the one long-lived worker, and every URL still inside the base.
    expect(workerUrls, 'no second worker for the import').toHaveLength(1);
    const pageOrigin = new URL(page.url()).origin;
    for (const url of [...requests, ...workerUrls]) {
      const parsed = new URL(url);
      expect(parsed.origin, url).toBe(pageOrigin);
      expect(parsed.pathname, url).toContain(base);
    }

    // The half that counting cannot see: nothing was even ATTEMPTED.
    const violations = await page.evaluate(
      () => (window as unknown as { __cspViolations: string[] }).__cspViolations,
    );
    expect(violations, `violated CSP directives: ${violations.join(', ')}`).toEqual([]);
  });

  // ---------------------------------------------------------------------------
  // D-13 / T-07-02 — the city file as the HOST serves it
  // ---------------------------------------------------------------------------

  test("the served city file is the manifest's file, with the manifest's bytes and sha256", async ({
    request,
  }) => {
    const manifest = await fetchServedManifest(request);

    // A fixture-sourced manifest would mean the deploy build shipped the
    // 377-byte documentation table, which is precisely what must never reach
    // the public internet. `dbip` is the only acceptable source here.
    expect(manifest.source, 'the artifact must carry the real DB-IP dataset').toBe('dbip');

    const response = await request.get(`geo-city-data/${manifest.file}`);
    expect(response.status(), `geo-city-data/${manifest.file} must be served under the base`).toBe(
      200,
    );
    const body = await response.body();

    // The contract is the GZIPPED bytes as served (WR-07). A host that
    // transparently decodes Content-Encoding hands the browser a plain body,
    // which the worker then refuses on its own length and hash checks — so
    // catching it here names the cause instead of leaving a generic error.
    expect(body.byteLength).toBe(manifest.bytes);
    expect(createHash('sha256').update(body).digest('hex')).toBe(manifest.sha256);
    expect([body[0], body[1]], 'gzip magic 0x1f 0x8b, not a transparently decoded body').toEqual([
      0x1f, 0x8b,
    ]);
  });

  // ---------------------------------------------------------------------------
  // D-14 / T-07-02 / D-16 — one press, one request, that file
  // ---------------------------------------------------------------------------

  test("one press of the opt-in makes exactly one request, for exactly the manifest's file", async ({
    page,
    context,
    request,
    baseURL,
  }) => {
    // Generous: the real container is ~12 MB and the decode runs in the worker.
    // A timeout here would be indistinguishable from a network failure.
    test.setTimeout(240_000);

    const manifest = await fetchServedManifest(request);
    const base = basePathOf(baseURL);

    const requests: string[] = [];
    context.on('request', (req) => requests.push(req.url()));

    await openApp(page);
    await importExport(page, SYNTHETIC_ZIP_NAME, buildLoginsHandExport());
    // Overview is the landing view since phase 8, so the Login history block is
    // not mounted until its pane is opened.
    await openSection(page, 'login-history');
    await expect(loginHistoryBlock(page)).toHaveAttribute('data-state', 'ready', {
      timeout: 60_000,
    });

    // `idle` with a real file name on offer is also the proof that the manifest
    // was baked into THIS build: a build that ran before the city file existed
    // offers nothing at all, and the opt-in is absent rather than idle.
    const optIn = page.getByTestId('city-optin');
    await expect(optIn).toHaveAttribute('data-state', 'idle');

    // The size copy already exists (D-16) and nothing here adds to it. Read
    // BEFORE the click, because the label is replaced by progress once pressed.
    const label = await page.getByTestId('city-load').innerText();
    expect(label, `the button must state the size it is about to fetch: ${label}`).toMatch(
      /~\s*[\d,]+\s*MB/,
    );

    const baseline = requests.length;
    const assetUrl = new URL(`geo-city-data/${manifest.file}`, baseURL).toString();

    // Armed BEFORE the click, so a fast localhost response cannot land before
    // the waiter exists and leave this test asserting on nothing.
    const served = page.waitForResponse((res) => res.url() === assetUrl, { timeout: 120_000 });
    await page.getByTestId('city-load').click();
    await expect(optIn).toHaveAttribute('data-state', 'ready', { timeout: 120_000 });

    const response = await served;
    expect(response.status()).toBe(200);

    const after = requests.slice(baseline);
    expect(after, `the opt-in must make exactly one request: ${after.join(', ')}`).toEqual([
      assetUrl,
    ]);
    expect(assetUrl.startsWith(`${new URL(page.url()).origin}${base}geo-city-data/`)).toBe(true);
    await expect(page.getByTestId('city-error')).toHaveCount(0);
  });
});

/**
 * The manifest as the HOST serves it, validated by the same function the build
 * used — `validateCityManifest` is imported, never re-typed, so a field the
 * build checks is a field this test checks.
 */
async function fetchServedManifest(request: APIRequestContext): Promise<CityManifestFile> {
  const response = await request.get('geo-city-data/manifest.json');
  expect(response.status(), 'geo-city-data/manifest.json must be served under the base').toBe(200);
  return validateCityManifest(await response.json());
}
