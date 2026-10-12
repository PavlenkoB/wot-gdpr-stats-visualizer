import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  LONG_NICKNAME,
  LONG_UNKNOWN_FOLDER,
  buildLongTextExport,
  buildNotAZipBytes,
  buildSampleExport,
} from '../../fixtures/export-fixtures.ts';
import { buildLoginsHandExport } from '../../fixtures/logins-fixtures.ts';
import { HAND_ROWS } from '../../fixtures/playtime-hand-fixture.ts';
import {
  buildSessionsCsvFromRows,
  buildSessionsExportFromCsv,
} from '../../fixtures/sessions-fixtures.ts';
import { PANE_IDS, PANE_SECTION, type PaneId } from '../../../src/lib/shell/selection-state.ts';
import {
  SYNTHETIC_ZIP_NAME,
  cityOptIn,
  countryList,
  detailPane,
  ensureListScreen,
  gotoApp,
  importAndOpen,
  importExport,
  loginHistoryBlock,
  loginMap,
  loginScroller,
  openSection,
  playerStatsBlock,
  playtimeBlock,
  replaceExport,
  startOver,
} from '../_support/helpers.ts';

/**
 * The D-04 sweep: nothing on the finished dashboard scrolls the PAGE sideways
 * at phone width (PLATFORM-01, SC1).
 *
 * Why this measures the DOCUMENT and not the scrollers. A scroller is designed
 * to overflow inside its own box — the calendar, the hour grid and both tables
 * are all wider than a phone and every one of them has its own horizontal
 * scroll. Reading those boxes and calling the result "no overflow" would prove
 * nothing; the page-level number is the one a reader feels as the whole
 * dashboard sliding under their thumb, header and nav included.
 *
 * Why this runs on the plain `chromium` project rather than on the touch
 * project. `chromium-mobile` is Desktop Chrome with `isMobile` + `hasTouch`,
 * and a mobile-emulated context reports `scrollWidth` through different
 * layout metrics than a mouse-capable one at the same declared viewport — so
 * the two projects could disagree about the same page. The touch project keeps
 * its own specs (`tests/e2e/shell/touch-*.spec.ts`), which assert hit sizes
 * rather than overflow. The viewport is set here with `test.use` so both
 * projects would exercise identical CSS at 375x812.
 *
 * The shell is two screens at 375px (the list, then one pane's detail), so the
 * sweep walks both: the list screen, then every pane in `PANE_IDS` opened in
 * turn. Content is only in the DOM while its pane is open (R4), so each test
 * opens the pane that owns what it measures before it measures it.
 *
 * Why `expectPresent` exists. A sweep that measured a locator matching nothing
 * would pass silently, so a section deleted in a later phase would turn this
 * file into a green no-op. Every surface is asserted to EXIST before it is
 * measured, which makes a missing section a failure instead of a skip.
 */

test.use({ viewport: { width: 375, height: 812 } });

/** The amount by which the document (or the body) is wider than its viewport. */
async function overflowBy(page: Page): Promise<{ html: number; body: number }> {
  return page.evaluate(() => ({
    html: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    body: document.body.scrollWidth - document.body.clientWidth,
  }));
}

/** Assert the PAGE does not scroll sideways. Both numbers go in the failure. */
async function expectNoPageOverflow(page: Page, label: string): Promise<void> {
  const { html, body } = await overflowBy(page);
  expect(
    Math.max(html, body),
    `${label}: the page scrolls sideways at 375px (document ${html}px, body ${body}px)`,
  ).toBeLessThanOrEqual(0);
}

/** Assert the locator matches at least one element, naming it when it does not. */
async function expectPresent(locator: Locator, name: string): Promise<void> {
  // Polled, because a block inside an open pane mounts when its worker answer
  // lands. A surface that never appears still fails here, after the poll budget.
  await expect
    .poll(() => locator.count(), {
      message: `${name} is not on the page, so the sweep could not measure it`,
    })
    .toBeGreaterThan(0);
}

test('padding: the detail pane has 16px at 375px and 40px at 481px, and neither state scrolls the page sideways', async ({
  page,
}) => {
  await gotoApp(page);

  // The empty first visit shows the detail screen (the drop target lives in it).
  await expectPresent(detailPane(page), 'detail-pane');
  const padding = await detailPane(page).evaluate((node) => {
    const style = getComputedStyle(node);
    return { left: style.paddingLeft, right: style.paddingRight };
  });
  expect(padding.left).toBe('16px');
  expect(padding.right).toBe('16px');

  await expectPresent(page.getByTestId('import-bar'), 'import-bar');
  await expectPresent(page.getByTestId('dropzone'), 'dropzone');
  await expectNoPageOverflow(page, 'empty first visit at 375px');

  // The breakpoint sits EXACTLY on 480: one pixel wider and the desktop
  // padding is back. If this fails the block is matching above 480.
  await page.setViewportSize({ width: 481, height: 812 });
  const wide = await detailPane(page).evaluate((node) => getComputedStyle(node).paddingLeft);
  expect(wide).toBe('40px');
  await expectNoPageOverflow(page, 'empty first visit at 481px');

  // Back at 375px, an imported dataset lands on the list screen and must not
  // scroll sideways either.
  await page.setViewportSize({ width: 375, height: 812 });
  await importExport(page, SYNTHETIC_ZIP_NAME, buildSampleExport());
  await expect(page.getByTestId('list-pane')).toBeVisible();
  await expectNoPageOverflow(page, 'sample export at 375px, list screen');
});

// -----------------------------------------------------------------------------
// The full dashboard
// -----------------------------------------------------------------------------

/**
 * What each pane must show before it is measured: the section root (or Overview)
 * and the named blocks that live inside it. A block carrying `data-state` is
 * also waited out of `loading`, so its disclosures exist before they are opened.
 */
const PANE_EXPECTATIONS: Record<PaneId, { testIds: string[]; settled: string[] }> = {
  overview: { testIds: ['overview'], settled: [] },
  playtime: { testIds: ['dashboard-section-activity-history'], settled: ['playtime'] },
  'login-history': {
    testIds: ['dashboard-section-activity-history'],
    settled: ['login-history'],
  },
  vehicles: {
    testIds: ['dashboard-section-player-statistics', 'player-stats', 'vehicle-scroller'],
    settled: ['player-stats'],
  },
  finance: {
    testIds: ['dashboard-section-financial-data', 'premium-block', 'currency-block'],
    settled: ['premium-block', 'currency-block'],
  },
  payments: {
    testIds: ['dashboard-section-payment-history', 'spend-block'],
    settled: ['spend-block'],
  },
  'device-info': {
    testIds: ['dashboard-section-device-info', 'device-info-block'],
    settled: ['device-info-block'],
  },
  account: { testIds: ['dashboard-section-user-info'], settled: [] },
  'not-yet-supported': { testIds: ['dashboard-section-not-yet-supported'], settled: [] },
};

test('the full dashboard: the list screen and every pane, every disclosure open and the confirm panel open, none scrolls the page sideways, and the header and list sit above the fold', async ({
  page,
}) => {
  await gotoApp(page);
  await importExport(page, SYNTHETIC_ZIP_NAME, buildSampleExport());

  // The list screen. The testable part of the UI-SPEC focal point: the identity
  // header and the list are both fully above the fold of a 375x812 viewport.
  await expect(page.getByTestId('list-pane')).toBeVisible();
  await expectPresent(page.getByTestId('identity-header'), 'identity-header');
  await expectPresent(page.getByTestId('list-nav'), 'list-nav');
  await expectNoPageOverflow(page, 'the list screen');
  await page.evaluate(() => window.scrollTo(0, 0));
  for (const testId of ['identity-header', 'list-nav']) {
    const box = await page.getByTestId(testId).boundingBox();
    expect(box, `${testId} has a box`).not.toBeNull();
    expect(box!.y + box!.height, `${testId} ends above the 812px fold`).toBeLessThanOrEqual(812);
  }

  let disclosuresOpened = 0;

  // Every pane, opened in turn. Each opens its own screen, shows what it owns,
  // and has every disclosure inside it opened one at a time, measuring after each.
  expect([...PANE_IDS], 'the sweep covers every pane').toEqual(Object.keys(PANE_EXPECTATIONS));
  for (const pane of PANE_IDS) {
    await openSection(page, pane);
    const { testIds, settled } = PANE_EXPECTATIONS[pane];
    const section = PANE_SECTION[pane];
    expect(testIds[0], `${pane} names its section root`).toBe(
      section === null ? 'overview' : `dashboard-section-${section}`,
    );
    for (const testId of testIds) await expectPresent(page.getByTestId(testId), testId);
    for (const testId of settled) {
      await expect(page.getByTestId(testId)).not.toHaveAttribute('data-state', 'loading', {
        timeout: 30_000,
      });
    }
    await expectNoPageOverflow(page, `the ${pane} pane`);

    const closed = detailPane(page).locator('details:not([open]) > summary');
    for (let opened = 0; (await closed.count()) > 0; opened += 1) {
      expect(opened, `a disclosure in ${pane} that will not open would loop forever`).toBeLessThan(
        40,
      );
      await closed.first().click();
      disclosuresOpened += 1;
      await expectNoPageOverflow(page, `${pane}: after opening disclosure #${opened + 1}`);
    }
  }
  expect(disclosuresOpened, 'the sweep opened at least one disclosure').toBeGreaterThan(0);

  // The confirm panel, open and then cancelled, on the list screen.
  await ensureListScreen(page);
  await page.getByTestId('start-over').click();
  await expectPresent(page.getByTestId('confirm-panel'), 'confirm-panel');
  await expectNoPageOverflow(page, 'the confirm panel open');
  await page.getByTestId('confirm-cancel').click();
  await expect(page.getByTestId('confirm-panel')).toHaveCount(0);
  await expectNoPageOverflow(page, 'the confirm panel cancelled');
});

// -----------------------------------------------------------------------------
// Activity and logins
// -----------------------------------------------------------------------------

test('activity and logins: the charts, the map and the login table, then the addresses revealed, a sort and the country list, none scrolls the page sideways', async ({
  page,
}) => {
  await gotoApp(page);
  // One export carries both: the hand logins export's session files feed the
  // Playtime block and the Login history block alike.
  await importAndOpen(page, SYNTHETIC_ZIP_NAME, buildLoginsHandExport(), 'playtime');
  await expect(playtimeBlock(page)).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });

  await expectPresent(page.getByTestId('calendar-chart'), 'calendar-chart');
  await expectPresent(page.getByTestId('hour-chart'), 'hour-chart');
  await expectPresent(page.getByTestId('duration-chart'), 'duration-chart');
  await expectNoPageOverflow(page, 'the Playtime pane');

  // The Login history block is its own pane now (R4).
  await openSection(page, 'login-history');
  await expect(loginHistoryBlock(page)).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });
  await expectPresent(loginMap(page), 'login-map');
  await expectPresent(page.getByTestId('login-table'), 'login-table');
  await expect(cityOptIn(page)).toHaveAttribute('data-state', 'idle');
  await expectNoPageOverflow(page, 'the Login history pane');

  const toggle = page.getByTestId('login-mask-toggle');
  await expectPresent(toggle, 'login-mask-toggle');
  await toggle.click();
  await expect(toggle).toHaveAttribute('data-masked', 'false');
  await expectNoPageOverflow(page, 'addresses revealed');

  const sort = page.getByTestId('login-sort-country');
  await expectPresent(sort, 'login-sort-country');
  await sort.click();
  await expectNoPageOverflow(page, 'login table sorted by country');

  await expectPresent(countryList(page), 'country-list');
  await countryList(page).locator(':scope > summary').click();
  await expect(countryList(page)).toHaveAttribute('open', '');
  await expectNoPageOverflow(page, 'the country list open');
});

// -----------------------------------------------------------------------------
// Banners and long text
// -----------------------------------------------------------------------------

test('banners and long text: a failure, a duplicate, the excluded rows, an unknown folder with a very long name, a very long nickname and the cleared acknowledgement', async ({
  page,
}) => {
  await gotoApp(page);

  // A failure banner: a file the app rejects before anything is posted.
  await page.getByTestId('file-input').setInputFiles({
    name: 'notes.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from(buildNotAZipBytes()),
  });
  await expectPresent(page.getByTestId('failure-banner'), 'failure-banner');
  await expectNoPageOverflow(page, 'the failure banner');

  // A duplicate notice: the identical zip again, confirmed.
  const sample = buildSampleExport();
  await importExport(page, SYNTHETIC_ZIP_NAME, sample);
  await page.getByTestId('file-input').setInputFiles({
    name: 'again.zip',
    mimeType: 'application/zip',
    buffer: Buffer.from(sample),
  });
  await page.getByTestId('confirm-commit').click();
  await expect(page.getByTestId('duplicate-notice').first()).toBeVisible({ timeout: 30_000 });
  await expectPresent(page.getByTestId('duplicate-notice'), 'duplicate-notice');
  await expectNoPageOverflow(page, 'the duplicate notice');

  // The excluded-rows notice: the hand export holds two unusable session rows.
  await replaceExport(
    page,
    'hand.zip',
    buildSessionsExportFromCsv(buildSessionsCsvFromRows(HAND_ROWS)),
    'playtime',
  );
  await expect(playtimeBlock(page)).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });
  await expect(page.getByTestId('playtime-excluded')).toBeVisible({ timeout: 30_000 });
  await expectPresent(page.getByTestId('playtime-excluded'), 'playtime-excluded');
  await expectNoPageOverflow(page, 'the excluded-rows notice');

  // An unknown folder with a 60+ character unbroken name, and a very long
  // nickname: neither may widen the page.
  await replaceExport(page, 'long-text.zip', buildLongTextExport(), 'not-yet-supported');
  await expect(page.getByTestId('unsupported-banner').first()).toBeVisible({ timeout: 30_000 });
  await expectPresent(page.getByTestId('unsupported-banner'), 'unsupported-banner');
  await expect(page.getByTestId('banner-folder').filter({ hasText: 'Future_category' })).toHaveText(
    LONG_UNKNOWN_FOLDER,
  );
  await expectNoPageOverflow(page, 'the long folder name');

  // The nickname lives in the list pane's identity header.
  await ensureListScreen(page);
  await expect(page.getByTestId('identity-nickname')).toHaveText(LONG_NICKNAME);
  await expectNoPageOverflow(page, 'the long nickname');

  // The acknowledgement after Start over.
  await startOver(page);
  await expect(page.getByTestId('cleared-ack').first()).toBeVisible({ timeout: 30_000 });
  await expectPresent(page.getByTestId('cleared-ack'), 'cleared-ack');
  await expectNoPageOverflow(page, 'the cleared acknowledgement');
});

// -----------------------------------------------------------------------------
// The city opt-in in every state
// -----------------------------------------------------------------------------

const FIXTURES = join(process.cwd(), 'tests/fixtures/geo');
const CITY_FIXTURE_BYTES = readFileSync(join(FIXTURES, 'city-fixture.gz'));
const CITY_ASSET_GLOB = '**/geo-city-data/*.citydb.bin';

test('the city opt-in at 375px in every state: idle states its size, downloading, cancelled, error and ready each fit', async ({
  page,
}) => {
  // The download is held until the test lets it go, so `downloading` is a
  // state the page really sits in, answered by the same routing the opt-in's
  // own spec uses (D-17: no live network, the committed fixture bytes).
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  await page.route(CITY_ASSET_GLOB, async (route) => {
    await gate;
    await route
      .fulfill({ status: 200, contentType: 'application/gzip', body: CITY_FIXTURE_BYTES })
      .catch(() => undefined);
  });

  await gotoApp(page);
  await importAndOpen(page, SYNTHETIC_ZIP_NAME, buildLoginsHandExport(), 'login-history');
  await expect(loginHistoryBlock(page)).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });
  const optIn = cityOptIn(page);

  // idle: the size is stated twice, in the intro and on the button (D-16). The
  // PATTERN is asserted and no copy is imported: the wording is the existing
  // `formatCityIntro` / `formatCityLoadLabel`.
  await expect(optIn).toHaveAttribute('data-state', 'idle');
  await expectPresent(page.getByTestId('city-intro'), 'city-intro');
  await expect(page.getByTestId('city-intro')).toHaveText(/about [\d,]+ MB/);
  await expectPresent(page.getByTestId('city-load'), 'city-load');
  await expect(page.getByTestId('city-load')).toHaveText(/\(~[\d,]+ MB\)/);
  await expectNoPageOverflow(page, 'city opt-in: idle');

  // downloading
  await page.getByTestId('city-load').click();
  await expect(optIn).toHaveAttribute('data-state', 'downloading');
  await expectPresent(page.getByTestId('city-progress'), 'city-progress');
  await expectPresent(page.getByTestId('city-cancel'), 'city-cancel');
  await expectNoPageOverflow(page, 'city opt-in: downloading');

  // cancelled
  await page.getByTestId('city-cancel').click();
  await expect(optIn).toHaveAttribute('data-state', 'cancelled');
  await expectPresent(page.getByTestId('city-cancelled'), 'city-cancelled');
  await expectNoPageOverflow(page, 'city opt-in: cancelled');
  release();

  // error: a response that is not the file
  await page.unroute(CITY_ASSET_GLOB);
  await page.route(CITY_ASSET_GLOB, (route) =>
    route.fulfill({ status: 500, body: Buffer.from('not the city file') }),
  );
  await page.getByTestId('city-load').click();
  await expect(optIn).toHaveAttribute('data-state', 'error', { timeout: 15_000 });
  await expectPresent(page.getByTestId('city-error'), 'city-error');
  await expectNoPageOverflow(page, 'city opt-in: error');

  // ready: the City column and the ranked place list join the page
  await page.unroute(CITY_ASSET_GLOB);
  await page.route(CITY_ASSET_GLOB, (route) =>
    route.fulfill({ status: 200, contentType: 'application/gzip', body: CITY_FIXTURE_BYTES }),
  );
  await page.getByTestId('city-load').click();
  await expect(optIn).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });
  await expectPresent(page.getByTestId('city-ready'), 'city-ready');
  await expectPresent(page.getByTestId('login-sort-city'), 'login-sort-city');
  await expectNoPageOverflow(page, 'city opt-in: ready');
});

// -----------------------------------------------------------------------------
// The tables keep their own box, and the map only scales
// -----------------------------------------------------------------------------

test('the vehicle and login tables scroll inside their own boxes with the first column held, and the world map only scales', async ({
  page,
}) => {
  await gotoApp(page);
  await importAndOpen(page, SYNTHETIC_ZIP_NAME, buildLoginsHandExport(), 'login-history');
  await expect(loginHistoryBlock(page)).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });

  // D-01: no reflow to cards and no hidden column. The login table still has
  // all six of its sortable columns on a phone.
  await expectPresent(page.getByTestId('login-table'), 'login-table');
  expect(await page.locator('[data-testid^="login-sort-"]').count()).toBe(6);

  // Each table lives in its own pane (R4), so each is measured with its pane open.
  const scrollers: [PaneId, Locator, string, string][] = [
    [
      'vehicles',
      page.getByTestId('vehicle-scroller'),
      '[data-testid="vehicle-row"]',
      'the vehicle table',
    ],
    ['login-history', loginScroller(page), '[data-testid="login-row"]', 'the login table'],
  ];
  for (const [pane, scroller, rowSelector, name] of scrollers) {
    await openSection(page, pane);
    if (pane === 'vehicles') {
      await expect(playerStatsBlock(page)).toHaveAttribute('data-state', 'ready', {
        timeout: 30_000,
      });
    } else {
      await expect(loginHistoryBlock(page)).toHaveAttribute('data-state', 'ready', {
        timeout: 30_000,
      });
    }
    await expectPresent(scroller, `${name}'s scroller`);
    await expectPresent(scroller.locator(rowSelector), `${name}'s rows`);

    // The scroller overflows INSIDE its own box while the page does not.
    const before = await scroller.evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }));
    expect(before.scrollWidth, `${name} is wider than its own box at 375px`).toBeGreaterThan(
      before.clientWidth,
    );
    await expectNoPageOverflow(page, `${name} at rest`);

    // Scrolled to its far edge: the page still does not move, and the first
    // column is held at the scroller's own left edge (it is sticky).
    await scroller.evaluate((el) => {
      el.scrollLeft = el.scrollWidth;
    });
    const held = await scroller.evaluate((el, selector) => {
      const cell = el.querySelector(selector)?.firstElementChild;
      if (!cell) return null;
      return {
        scrolled: el.scrollLeft,
        gap: cell.getBoundingClientRect().left - (el.getBoundingClientRect().left + el.clientLeft),
      };
    }, rowSelector);
    expect(held, `${name} has a first column`).not.toBeNull();
    expect(held!.scrolled, `${name} really scrolled sideways`).toBeGreaterThan(0);
    expect(Math.abs(held!.gap), `${name}'s first column drifted from the box's edge`).toBeLessThan(
      1.5,
    );
    await expectNoPageOverflow(page, `${name} scrolled to its far edge`);
  }

  // D-02: the map only scales. Its svg fits the card (the viewport less the
  // two 16px page paddings), and nothing above it is a horizontal scroller.
  await expectPresent(loginMap(page), 'login-map');
  const map = await loginMap(page).boundingBox();
  expect(map, 'the map has a box').not.toBeNull();
  expect(map!.width, 'the map fits inside the page padding at 375px').toBeLessThanOrEqual(375 - 32);
  const scrollingAncestors = await loginMap(page).evaluate((svg) => {
    const found: string[] = [];
    for (let node = svg.parentElement; node && node !== document.body; node = node.parentElement) {
      const overflowX = getComputedStyle(node).overflowX;
      if (overflowX === 'auto' || overflowX === 'scroll') found.push(node.tagName.toLowerCase());
    }
    return found;
  });
  expect(scrollingAncestors, 'the map has no zoom or pan box around it').toEqual([]);
});
