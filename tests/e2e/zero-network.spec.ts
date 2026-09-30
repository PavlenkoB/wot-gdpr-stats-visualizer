import { expect, test } from '@playwright/test';
import { SAMPLE_NICKNAME, buildSampleExport } from '../fixtures/export-fixtures.ts';
import { SCALE_5K_SPEC, buildSessionsExport } from '../fixtures/sessions-fixtures.ts';

/**
 * PLATFORM-02 — zero network requests after initial page load, plus
 * the CSP meta tag is present in the served HTML.
 *
 * The "initial load" baseline includes the eager worker script fetch
 * (Pitfall 3 in RESEARCH: spawn at app init, not on first drop).
 * Playwright's `page.on('request')` reliably captures the worker's
 * own script load (a page-initiated resource fetch); it does NOT
 * reliably capture fetches made from inside the worker's execution
 * context (RESEARCH Pitfall 4). That distinction is irrelevant here
 * because this app's worker never calls fetch().
 */

test.describe('zero-network and CSP', () => {
  test('no network requests after initial load, including the worker script fetch', async ({
    page,
    context,
  }) => {
    const requests: string[] = [];
    const workerUrls: string[] = [];
    context.on('request', (req) => requests.push(req.url()));
    page.on('worker', (worker) => workerUrls.push(worker.url()));

    await page.goto('/');

    // Eager spawn: the worker must have reported ready before the baseline.
    await expect(page.locator('main')).toHaveAttribute('data-worker-ready', 'true', {
      timeout: 10_000,
    });

    await page.waitForLoadState('networkidle');

    const baselineCount = requests.length;
    expect(baselineCount).toBeGreaterThan(0);

    // The page-initiated worker fetch should be inside the baseline.
    expect(workerUrls).toHaveLength(1);
    const pageOrigin = new URL(page.url()).origin;
    for (const url of workerUrls) {
      expect(new URL(url).origin).toBe(pageOrigin);
    }
    for (const url of requests) {
      expect(new URL(url).origin).toBe(pageOrigin);
    }

    await page.getByTestId('file-input').setInputFiles({
      name: 'sample-export.zip',
      mimeType: 'application/zip',
      buffer: Buffer.from(buildSampleExport()),
    });

    // 03-04: the account heading is retired (D-23); the identity header's
    // nickname `<h2>` is the dashboard's title now. Asserted on a test id
    // rather than on a role+level heading, because the dashboard renders six
    // `<h2>` elements and a role query would be ambiguous.
    await expect(page.getByTestId('identity-nickname')).toHaveText(SAMPLE_NICKNAME);

    // Give any microtask-queued work a chance to settle before we assert
    // the count.
    await page.waitForTimeout(500);

    const postSubmitCount = requests.length;
    expect(
      postSubmitCount,
      `unexpected requests after submit: ${requests.slice(baselineCount).join(', ')}`,
    ).toBe(baselineCount);
  });

  test('served HTML carries the CSP meta tag with default-src and connect-src none', async ({
    page,
  }) => {
    await page.goto('/');
    const csp = await page
      .locator('meta[http-equiv="Content-Security-Policy"]')
      .first()
      .getAttribute('content');
    expect(csp).not.toBeNull();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("connect-src 'none'");
  });

  test('no network requests, no second worker and no CSP violation through a 5,000-session import, every selector value and chart interaction', async ({
    page,
    context,
  }) => {
    // Explicit rather than inherited: this test imports a 5,000-session
    // archive, sweeps every selector value and then interacts with two
    // charts, which is more than the configured default allows for on a slow
    // CI runner. A timeout here would look like a network failure.
    test.setTimeout(180_000);

    // Before navigation, so it catches a violation raised by the first
    // application script as well as by anything the playtime flow does.
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

    await page.goto('/');
    await expect(page.locator('main')).toHaveAttribute('data-worker-ready', 'true', {
      timeout: 10_000,
    });
    await page.waitForLoadState('networkidle');

    // The eager worker script fetch and the module graph are inside the
    // baseline, so anything after it is the app asking for something it was
    // not served.
    const baselineCount = requests.length;
    expect(baselineCount).toBeGreaterThan(0);
    expect(workerUrls).toHaveLength(1);

    const { bytes } = buildSessionsExport(SCALE_5K_SPEC);
    await page.getByTestId('file-input').setInputFiles({
      name: 'scale-export.zip',
      mimeType: 'application/zip',
      buffer: Buffer.from(bytes),
    });
    await expect(page.getByTestId('playtime')).toHaveAttribute('data-state', 'ready', {
      timeout: 30_000,
    });

    // Every split value, waiting for the charts to settle on each. The wait is
    // on the block's own state attribute, so a value that never answered would
    // fail here rather than be measured against the previous slice.
    const selector = page.getByTestId('playtime-selector');
    const optionCount = await selector.locator('option').count();
    expect(optionCount, 'All plus at least one server name').toBeGreaterThan(1);
    for (let index = 0; index < optionCount; index += 1) {
      await selector.selectOption({ index });
      await expect(page.getByTestId('playtime')).toHaveAttribute('data-state', 'ready', {
        timeout: 10_000,
      });
    }

    // Two different interaction paths over the charts: a pointer (which opens
    // the shared tooltip) and the keyboard (which moves the roving tab stop
    // through the calendar).
    await page.getByTestId('hour-cell').first().hover();
    await page.getByTestId('calendar-cell').first().focus();
    await page.keyboard.press('ArrowRight');

    // The same short settle the first test uses, so a request queued by the
    // interaction has reached the network stack before the count is read.
    await page.waitForTimeout(500);

    const postBaseline = requests.slice(baselineCount);
    expect(postBaseline, `requests after the playtime flow: ${postBaseline.join(', ')}`).toEqual(
      [],
    );

    // Still the single long-lived worker, on the same origin as the page.
    expect(workerUrls, 'no second worker for the playtime flow').toHaveLength(1);
    const pageOrigin = new URL(page.url()).origin;
    for (const url of [...requests, ...workerUrls]) {
      expect(new URL(url).origin).toBe(pageOrigin);
    }

    // The half that counting requests cannot see: nothing was even ATTEMPTED.
    const violations = await page.evaluate(
      () => (window as unknown as { __cspViolations: string[] }).__cspViolations,
    );
    expect(violations, `violated CSP directives: ${violations.join(', ')}`).toEqual([]);
  });
});
