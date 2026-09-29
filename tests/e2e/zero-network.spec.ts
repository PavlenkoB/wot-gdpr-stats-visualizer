import { expect, test } from '@playwright/test';
import { SAMPLE_NICKNAME, buildSampleExport } from '../fixtures/export-fixtures.ts';

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
});
