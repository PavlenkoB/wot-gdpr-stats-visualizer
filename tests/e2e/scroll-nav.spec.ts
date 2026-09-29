import { expect, test, type Page } from '@playwright/test';
import {
  buildLongTextExport,
  buildMissingPaymentHistoryExport,
  buildOnlySupportedExport,
  buildSampleExport,
  buildZeroRowPaymentExport,
} from '../fixtures/export-fixtures.ts';
import { NAV_ORDER } from '../../src/lib/dashboard-status.ts';
import { NAV_STATUS_SUFFIX, SECTION_TITLES } from '../../src/lib/ui-copy.ts';

// =============================================================================
// 03-05 — sticky anchor nav, scroll-spy, status-bearing accessible names
// =============================================================================
//
// Three properties are asserted here and none of them can be read off a
// class name, because each is a claim about what a user SEES at a moment in
// time:
//
//   1. WHERE the highlight is. `aria-current="location"` is the only signal
//      a screen reader gets, and it is the single source of truth the
//      observer maintains — a click never sets it (D-05). So the tests drive
//      the PAGE (scroll, hash) and read the attribute, never the other way
//      round.
//   2. EXACTLY ONE link is current. Two current links is a nav that has
//      stopped being a position marker and started being decoration.
//   3. WHAT a muted link says. The weight change is a visual cue and the
//      hidden suffix is the one that survives a screen reader, so the name
//      is asserted with `exact: true` — a stray space, a missing comma or an
//      `aria-label` that overrode the visible text all fail here (D-03).
//
// The nav id list is imported from `NAV_ORDER` rather than re-typed: the
// order is D-02's contract, and a spec that hard-codes a second copy of it
// would keep passing after the real list changed.
// =============================================================================

/**
 * Reduced motion plus a short, wide viewport.
 *
 * The short height is deliberate: at 1280x400 the five Phase 3 section cards
 * cannot all fit on screen, so the page scrolls and the top/bottom rules are
 * actually reachable. Reduced motion is the other half — `scroll-behavior:
 * smooth` is gated on `prefers-reduced-motion: no-preference`, and Playwright
 * defaults to no-preference, which would make every scroll an animation and
 * every assertion a race (RESEARCH Q5 finding 6).
 */
test.use({ reducedMotion: 'reduce', viewport: { width: 1280, height: 400 } });

const FIRST_ID = NAV_ORDER[0];
const LAST_ID = NAV_ORDER[NAV_ORDER.length - 1];

/** The nav landmark itself. */
function nav(page: Page) {
  return page.getByTestId('dashboard-nav');
}

/** One nav link, by section id. */
function navLink(page: Page, id: string) {
  return page.getByTestId(`nav-link-${id}`);
}

/** Every link that currently claims to be the section in view, in DOM order. */
function currentLinks(page: Page) {
  return nav(page).locator('a[aria-current="location"]');
}

/** Import in-memory zip bytes through the dropzone's real file input. */
async function importZip(page: Page, bytes: Uint8Array, name: string): Promise<void> {
  await page.getByTestId('file-input').setInputFiles({
    name,
    mimeType: 'application/zip',
    buffer: Buffer.from(bytes),
  });
}

/**
 * Scroll the window instantly.
 *
 * `behavior: 'instant'` is passed explicitly rather than relying on the
 * reduced-motion emulation: it states the intent at the call site, and it
 * keeps working if a test ever drops the emulation.
 */
async function scrollTo(page: Page, top: number): Promise<void> {
  await page.evaluate((y: number) => {
    window.scrollTo({ top: y, left: 0, behavior: 'instant' });
  }, top);
}

/** `scrollHeight` — the number the bottom rule is arithmetic over. */
function pageHeight(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollHeight);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('main')).toHaveAttribute('data-worker-ready', 'true', {
    timeout: 10_000,
  });
});

// -----------------------------------------------------------------------------
// Task 1 — the tracer: the nav exists, and the spy tracks top, bottom, top
// -----------------------------------------------------------------------------

test('(tracer) the spy marks the first link on load, the last at the bottom, and the first again', async ({
  page,
}) => {
  await importZip(page, buildSampleExport(), 'sample.zip');
  await expect(page.getByTestId('identity-nickname')).toBeVisible({ timeout: 30_000 });

  // The nav exists at all, with all five links, in NAV_ORDER.
  await expect(navLink(page, FIRST_ID)).toHaveCount(1, { timeout: 10_000 });
  expect(await nav(page).locator('a').count()).toBe(NAV_ORDER.length);

  // 1. On load the first section is the one in view, and it is the ONLY
  //    link claiming to be. A page short enough not to scroll must not jump
  //    to the last link (RESEARCH Q5 finding 4's guard).
  await expect(navLink(page, FIRST_ID)).toHaveAttribute('aria-current', 'location', {
    timeout: 10_000,
  });
  await expect(currentLinks(page)).toHaveCount(1);

  // 2. The very bottom of the page belongs to the last link, whatever the
  //    band says — the short "Not yet supported" block is the one section
  //    that could otherwise never be reached.
  await scrollTo(page, await pageHeight(page));
  await expect(navLink(page, LAST_ID)).toHaveAttribute('aria-current', 'location', {
    timeout: 10_000,
  });
  await expect(currentLinks(page)).toHaveCount(1);

  // 3. And scrolling back to the top hands the highlight back to the first
  //    link: the spy is a function of scroll position in both directions,
  //    not a one-way latch.
  await scrollTo(page, 0);
  await expect(navLink(page, FIRST_ID)).toHaveAttribute('aria-current', 'location', {
    timeout: 10_000,
  });
  await expect(currentLinks(page)).toHaveCount(1);
});

// -----------------------------------------------------------------------------
// Task 2 — depth: stickiness, the band rule, names, anchors, phone, long text
// -----------------------------------------------------------------------------

/** `--nav-offset`, read from the page rather than repeated as a literal. */
function navOffset(page: Page): Promise<number> {
  return page.evaluate(() =>
    Number.parseInt(
      getComputedStyle(document.documentElement).getPropertyValue('--nav-offset'),
      10,
    ),
  );
}

/** The computed font weight of one link, as the number it declares. */
function fontWeight(page: Page, id: string): Promise<string> {
  return navLink(page, id).evaluate((el) => getComputedStyle(el).fontWeight);
}

/** Import, then wait until the identity header is showing a real nickname. */
async function loadSample(page: Page, bytes = buildSampleExport()): Promise<void> {
  await importZip(page, bytes, 'export.zip');
  await expect(page.getByTestId('identity-nickname')).toBeVisible({ timeout: 30_000 });
}

/**
 * Import bytes, then wait for THAT import to be the one on screen.
 *
 * The wait is the nav name rather than the identity nickname because the app
 * restores the previous export from its cache: a nickname is already visible
 * while a freshly dropped file is still being read, so waiting on it can
 * return a page showing the wrong dataset. A name only this export can
 * produce cannot be stale.
 */
async function loadWith(page: Page, bytes: Uint8Array, expectedName: string): Promise<void> {
  await importZip(page, bytes, 'export.zip');
  await expect(page.getByRole('link', { name: expectedName, exact: true })).toHaveCount(1, {
    timeout: 30_000,
  });
}

test('(sticky) the nav pins to the top of the viewport once the page scrolls', async ({ page }) => {
  await loadSample(page);
  const natural = (await nav(page).boundingBox())!.y;
  expect(natural).toBeGreaterThan(0);

  // Sticky only engages once the element's own position would have gone past
  // the top edge, so the scroll has to clear the nav's natural position — a
  // smaller scroll leaves it on screen and proves nothing.
  await scrollTo(page, natural + 200);
  const after = (await nav(page).boundingBox())!;
  expect(Math.abs(after.y)).toBeLessThanOrEqual(1);
});

test('(band-mirror) the extremes give the first and last links', async ({ page }) => {
  await loadSample(page);

  await scrollTo(page, 0);
  await expect(navLink(page, FIRST_ID)).toHaveAttribute('aria-current', 'location', {
    timeout: 10_000,
  });
  await expect(currentLinks(page)).toHaveCount(1);

  await scrollTo(page, await pageHeight(page));
  await expect(navLink(page, LAST_ID)).toHaveAttribute('aria-current', 'location', {
    timeout: 10_000,
  });
  await expect(currentLinks(page)).toHaveCount(1);
});

test('(band-mirror) each section takes the highlight, or yields it to the bottom rule', async ({
  page,
}) => {
  await loadSample(page);

  for (const id of NAV_ORDER) {
    // `scrollIntoView` honours the section's own scroll-margin-top, so this
    // lands the section exactly where a click on its link would.
    await page.evaluate((sectionId: string) => {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: 'instant', block: 'start' });
    }, id);

    // The rule, mirrored rather than re-implemented: the section in the band
    // wins, and the bottom of the page is the one documented exception to it.
    // At Phase 3 content heights a short section cannot always pull the band
    // onto itself, and "the highlight is somewhere sane" is the guarantee the
    // reader actually gets (RESEARCH Q5 finding 5).
    await expect
      .poll(
        async () =>
          page.evaluate((sectionId: string) => {
            const current = Array.from(
              document.querySelectorAll('[data-testid="dashboard-nav"] a[aria-current="location"]'),
            ).map((a) => a.getAttribute('data-testid'));
            const atBottom =
              window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 1;
            if (current.length !== 1) return `count:${current.length}`;
            if (current[0] === `nav-link-${sectionId}`) return 'own';
            if (atBottom && current[0] === `nav-link-${NAV_ORDER[NAV_ORDER.length - 1]}`) {
              return 'bottom';
            }
            return `other:${String(current[0])}`;
          }, id),
        { timeout: 10_000, message: `the spy settles after scrolling to ${id}` },
      )
      .toMatch(/^(own|bottom)$/);

    // Whatever the outcome, the nav never has zero or two current links.
    await expect(currentLinks(page)).toHaveCount(1);
  }
});

// One test per export rather than one long chain. Each test gets its own
// browser context, so there is no cached dataset to be restored underfoot and
// no replace-confirmation to answer (D-13) — a second import into the same
// context would test that flow instead of the nav.

test('(muted-names) with nothing loaded every link says so', async ({ page }) => {
  await expect(nav(page)).toBeVisible({ timeout: 10_000 });
  for (const id of NAV_ORDER) {
    await expect(
      page.getByRole('link', {
        name: `${SECTION_TITLES[id]}${NAV_STATUS_SUFFIX['not-loaded']}`,
        exact: true,
      }),
    ).toHaveCount(1);
  }
});

test('(muted-names) an absent category mutes its link and says why', async ({ page }) => {
  const missingName = `${SECTION_TITLES['payment-history']}${NAV_STATUS_SUFFIX['no-export']}`;
  await loadWith(page, buildMissingPaymentHistoryExport(), missingName);
  await expect(page.getByRole('link', { name: missingName, exact: true })).toHaveCount(1);
  expect(await fontWeight(page, 'payment-history')).toBe('400');

  // An unmuted link's name carries no suffix at all, and its weight is the
  // Label role's 600 — the muted state is weight, not only colour (UI-SPEC).
  await expect(page.getByRole('link', { name: SECTION_TITLES[FIRST_ID], exact: true })).toHaveCount(
    1,
  );
  expect(await fontWeight(page, FIRST_ID)).toBe('600');
});

test('(muted-names) a category with zero rows says so', async ({ page }) => {
  const emptyName = `${SECTION_TITLES['payment-history']}${NAV_STATUS_SUFFIX['empty']}`;
  await loadWith(page, buildZeroRowPaymentExport(), emptyName);
  await expect(page.getByRole('link', { name: emptyName, exact: true })).toHaveCount(1);
});

test('(muted-names) an export with no unsupported folders says so', async ({ page }) => {
  const noneName = `${SECTION_TITLES['not-yet-supported']}${NAV_STATUS_SUFFIX['none']}`;
  await loadWith(page, buildOnlySupportedExport(), noneName);
  await expect(page.getByRole('link', { name: noneName, exact: true })).toHaveCount(1);
});

test('(anchors) the links are native hash anchors and land below the sticky nav', async ({
  page,
}) => {
  await loadSample(page);

  const hrefs = await nav(page)
    .locator('a')
    .evaluateAll((links) => links.map((a) => a.getAttribute('href')));
  expect(hrefs).toEqual(NAV_ORDER.map((id) => `#${id}`));

  await navLink(page, 'payment-history').click();
  await expect.poll(() => page.evaluate(() => location.hash)).toBe('#payment-history');

  const landing = await page.evaluate(() => {
    const section = document.getElementById('payment-history')!.getBoundingClientRect();
    return {
      top: section.top,
      atBottom: window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 1,
    };
  });
  if (!landing.atBottom) {
    expect(Math.abs(landing.top - (await navOffset(page)))).toBeLessThanOrEqual(2);
  }
});

test('(reduced-motion) the smooth-scroll rule follows the reader preference', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe(
    'smooth',
  );

  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe(
    'auto',
  );
});

test.describe('phone width', () => {
  test.use({ viewport: { width: 375, height: 800 } });

  test('(phone-375) the nav scrolls inside itself and never widens the page', async ({ page }) => {
    await loadSample(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      375,
    );

    // The row is taller than the phone, so focus must scroll it into view.
    const last = navLink(page, LAST_ID);
    await last.focus();
    await expect
      .poll(() => nav(page).evaluate((el) => (el as HTMLElement).scrollLeft))
      .toBeGreaterThan(0);

    const linkBox = (await last.boundingBox())!;
    const navBox = (await nav(page).boundingBox())!;
    expect(linkBox.x).toBeGreaterThanOrEqual(navBox.x - 0.5);
    expect(linkBox.x + linkBox.width).toBeLessThanOrEqual(navBox.x + navBox.width + 0.5);

    // A wrapping row would change the nav's height, and --nav-offset is one
    // constant for the whole page — so the height must not depend on width.
    const phoneHeight = navBox.height;
    await page.setViewportSize({ width: 1280, height: 400 });
    const wideBox = (await nav(page).boundingBox())!;
    expect(Math.abs(phoneHeight - wideBox.height)).toBeLessThanOrEqual(4);
  });
});

test.describe('long untrusted text', () => {
  for (const width of [375, 720]) {
    test(`(long-text) nothing overflows the ${width}px viewport`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await loadSample(page, buildLongTextExport());

      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width,
      );

      const rightEdges = await page.evaluate(() => {
        const right = (selector: string): number | null => {
          const element = document.querySelector(selector);
          return element ? element.getBoundingClientRect().right : null;
        };
        return {
          nickname: right('[data-testid="identity-nickname"]'),
          banner: right('[data-testid="unsupported-banner"]'),
        };
      });
      expect(rightEdges.nickname).not.toBeNull();
      expect(rightEdges.banner).not.toBeNull();
      expect(rightEdges.nickname!).toBeLessThanOrEqual(width);
      expect(rightEdges.banner!).toBeLessThanOrEqual(width);
    });
  }
});
