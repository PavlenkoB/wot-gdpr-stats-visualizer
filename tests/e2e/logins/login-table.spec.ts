import '../_support/pin-locale';
import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
} from '@playwright/test';
import {
  SYNTHETIC_ZIP_NAME,
  gotoApp,
  importAndOpen,
  loginHistoryBlock,
  loginScroller,
  loginTable,
  openSection,
  startOver,
} from '../_support/helpers.ts';
import {
  LOGINS_UNREADABLE_IPS,
  LOGINS_WOT_ROWS,
  LOGINS_WOWS_ROWS,
  buildLoginsCsvOnlyExportWithoutUserInfo,
  buildLoginsOverCapSpec,
  buildLoginsScaleExport,
  buildLoginsScaleSpec,
  type LoginsScaleSpec,
} from '../../fixtures/logins-fixtures.ts';
import { SAMPLE_IP, buildCustomExport } from '../../fixtures/export-fixtures.ts';
import { buildRealShapeCsv } from '../../fixtures/playtime-real-shape-fixture.ts';
import { oracleCompare, oracleLogins } from '../../helpers/login-oracle.ts';
import { MAX_LOGIN_IPS } from '../../../src/lib/features/logins/login-shared.ts';
import { maskIp } from '../../../src/lib/geo/ip.ts';
import {
  ABOUT_NAME_LOGIN_TABLE,
  LOGIN_ACCOUNT_NOTE,
  LOGIN_ACCOUNT_TAG,
  LOGIN_HIDDEN_NOT_COUNTED,
  LOGIN_TABLE_FIND_HINT,
  LOGIN_UNKNOWN_COUNTRY,
  MASK_TOGGLE_SHOW,
  VEHICLE_SCROLL_HINT,
  formatAboutThis,
  formatGames,
  formatLoginCapLine,
  formatLoginCountLine,
  formatLoginDate,
  formatLoginExcludedPill,
  formatNumber,
} from '../../../src/lib/ui-copy.ts';

// =============================================================================
// Phase 06, plan 06-10 — the IP table, in a real browser
// =============================================================================
//
// WHY A BROWSER SPEC
// Vitest has no DOM, and the claims below are about what a user sees and what a
// page holds: how many rows are in the document, what `aria-rowcount` says, the
// first row after a sort, and the one that matters most here — that while masked
// no full address is anywhere in the page. Every expectation comes from the
// seeded fixture's independent oracle (`tests/helpers/login-oracle.ts`), which
// shares no primitive with the aggregator, and every sentence from `ui-copy`.
//
// WHY FIVE TESTS AND NOT TEN
// The CI e2e budget has room for five more browser tests across the rest of
// Phase 6 (06-08 recorded the arithmetic), and the guard prices by test count.
// The ten cases the plan lists are therefore grouped by what they share: three
// read ONE already-rendered 12,000-row import (a describe with a single
// `beforeAll`, so the expensive part is paid once), one reads the Account record
// row on a small archive, and one reads the over-cap archive. No case was
// dropped.
// =============================================================================

/** The seeded 12,000-row export's spec: 900 distinct documentation addresses. */
const SCALE: LoginsScaleSpec = buildLoginsScaleSpec();

/**
 * The scale export WITHOUT the sample's `User_Info` folder.
 *
 * `buildLoginsScaleExport` leaves the sample's Account_Info in place, and that
 * row becomes the pinned Account record row, which adds one to `aria-rowcount`.
 * The window and sort cases are about the LISTED rows, so they import an archive
 * with no account record; the account row has its own case.
 */
function buildScaleExportWithoutAccount(spec: LoginsScaleSpec): Uint8Array {
  const overrides: Record<string, string> = {};
  for (const file of spec.files) overrides[file.path] = file.text;
  return buildCustomExport({
    omitFolders: ['User_Info'],
    omitFiles: ['Activity_history/Sessions.csv', 'Activity_history/Logins.csv'],
    overrides,
  });
}

/** What the aggregate lists and ranks, from the independent oracle. */
const ORACLE = oracleLogins(SCALE, { countryOf: () => null, maxListed: MAX_LOGIN_IPS });

/** The listed addresses' logins, which is what the count line reads. */
const LISTED_LOGINS = ORACLE.addresses.reduce((sum, address) => sum + address.logins, 0);

// -----------------------------------------------------------------------------
// Small readers
// -----------------------------------------------------------------------------

/** The `th` that holds one column's sort button. */
function header(page: Page, key: string): Locator {
  return page.locator('th').filter({ has: page.getByTestId(`login-sort-${key}`) });
}

const COLUMN_INDEX = { ip: 0, country: 1, logins: 2, first: 3, last: 4, games: 5 } as const;

/** One cell of one row, by column key. */
function cell(row: Locator, key: keyof typeof COLUMN_INDEX): Locator {
  return row.locator('td').nth(COLUMN_INDEX[key]);
}

/** Every drawn row's text for one column, whitespace collapsed. */
async function columnTexts(page: Page, key: keyof typeof COLUMN_INDEX): Promise<string[]> {
  const rows = loginTable(page).getByTestId('login-row');
  const count = await rows.count();
  const texts: string[] = [];
  for (let i = 0; i < count; i++) {
    texts.push(((await cell(rows.nth(i), key).textContent()) ?? '').replace(/\s+/g, ' ').trim());
  }
  return texts;
}

/** Assert which header carries `aria-sort`, and that every other one says none. */
async function expectSortedBy(
  page: Page,
  key: string,
  direction: 'ascending' | 'descending',
): Promise<void> {
  for (const other of ['ip', 'country', 'logins', 'first', 'last', 'games']) {
    await expect(header(page, other)).toHaveAttribute(
      'aria-sort',
      other === key ? direction : 'none',
    );
  }
}

/** Scroll the scroller and wait for the window to follow. */
async function scrollTo(page: Page, top: number): Promise<void> {
  await loginScroller(page).evaluate((el, y) => {
    el.scrollTop = y;
  }, top);
  if (top > 0) {
    await expect
      .poll(async () =>
        Number(
          await loginTable(page).getByTestId('login-row').first().getAttribute('aria-rowindex'),
        ),
      )
      .toBeGreaterThan(2);
  }
}

/** The scroller's current offset. */
function scrollTopOf(page: Page): Promise<number> {
  return loginScroller(page).evaluate((el) => el.scrollTop);
}

/** The whole table as one selection, which is what a reader would copy. */
async function selectedTableText(page: Page): Promise<string> {
  return loginScroller(page).evaluate((root) => {
    const range = document.createRange();
    range.selectNodeContents(root);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    return selection?.toString() ?? '';
  });
}

/** Every attribute value inside the scroller, scroller included, joined. */
async function attributeText(page: Page): Promise<string> {
  return loginScroller(page).evaluate((root) => {
    const values: string[] = [];
    for (const element of [root, ...root.querySelectorAll('*')]) {
      for (const name of element.getAttributeNames()) {
        values.push(element.getAttribute(name) ?? '');
      }
    }
    return values.join('\n');
  });
}

/** True when no full fixture address appears in `text`. */
function holdsNoAddress(text: string): boolean {
  return !SCALE.addresses.some((address) => text.includes(address));
}

// =============================================================================
// One 12,000-row import, read three times
// =============================================================================

test.describe('the IP table on the seeded 12,000-row export', () => {
  test.describe.configure({ mode: 'serial' });

  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }: { browser: Browser }) => {
    test.setTimeout(120_000);
    context = await browser.newContext();
    page = await context.newPage();
    await gotoApp(page);
    await importAndOpen(
      page,
      SYNTHETIC_ZIP_NAME,
      buildScaleExportWithoutAccount(SCALE),
      'login-history',
    );
    await expect(loginHistoryBlock(page)).toHaveAttribute('data-state', 'ready', {
      timeout: 60_000,
    });
    await expect(loginTable(page).getByTestId('login-row').first()).toBeVisible();
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test('tracer: windowed, ranked, and no full address or hostile cell anywhere while masked', async () => {
    const table = loginTable(page);
    const rows = table.getByTestId('login-row');

    // D-05: windowed ALWAYS. The DOM holds the window and two spacers, not the
    // 900 listed addresses.
    const drawn = await rows.count();
    expect(drawn).toBeGreaterThan(0);
    expect(drawn).toBeLessThanOrEqual(30);

    // The table tells the truth about its own size: the listed addresses plus
    // the header row, with no Account record in this archive. The count line
    // reads the listed addresses and the logins of those addresses.
    expect(ORACLE.addresses.length).toBe(SCALE.distinctAddresses);
    await expect(table).toHaveAttribute('aria-rowcount', String(ORACLE.addresses.length + 1));
    await expect(page.getByTestId('login-count')).toHaveText(
      formatLoginCountLine(ORACLE.addresses.length, LISTED_LOGINS),
    );
    await expect(page.getByTestId('login-cap-line')).toHaveCount(0);
    await expect(page.getByTestId('login-account-row-group')).toHaveCount(0);
    await expect(page.getByTestId('login-account-note')).toHaveCount(0);

    // Every rendered row says where it is in the full table: the header is 1.
    await expect(table.locator('thead tr')).toHaveAttribute('aria-rowindex', '1');
    await expect(rows.first()).toHaveAttribute('aria-rowindex', '2');

    // Case 1: the default order is Logins descending, the first drawn row
    // carries the oracle's largest count, and only that header is sorted.
    await expect(rows.first()).toHaveAttribute('data-logins', String(ORACLE.addresses[0]!.logins));
    await expectSortedBy(page, 'logins', 'descending');

    // The three hints under the table, and no Account record note.
    await expect(loginHistoryBlock(page)).toContainText(VEHICLE_SCROLL_HINT);
    await expect(loginHistoryBlock(page)).toContainText(LOGIN_TABLE_FIND_HINT);

    // quick 261009-qbo: both hints live in one "About this table" disclosure
    // directly under the table: closed by default, a 44px summary, text
    // unchanged, shown only after the summary is pressed.
    const about = page.getByTestId('about-login-table');
    await expect(about).toHaveCount(1);
    await expect(about).not.toHaveAttribute('open', /.*/);
    const aboutSummary = about.locator('summary');
    await expect(aboutSummary).toHaveText(formatAboutThis(ABOUT_NAME_LOGIN_TABLE));
    expect((await aboutSummary.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await expect(about.getByText(VEHICLE_SCROLL_HINT)).toBeHidden();
    await expect(about.getByText(LOGIN_TABLE_FIND_HINT)).toBeHidden();
    const scrollerBox = (await loginScroller(page).boundingBox())!;
    expect((await about.boundingBox())!.y).toBeGreaterThanOrEqual(
      scrollerBox.y + scrollerBox.height - 1,
    );
    await aboutSummary.click();
    await expect(about.getByText(VEHICLE_SCROLL_HINT)).toBeVisible();
    await expect(about.getByText(LOGIN_TABLE_FIND_HINT)).toBeVisible();
    await aboutSummary.click();
    await expect(about.getByText(LOGIN_TABLE_FIND_HINT)).toBeHidden();

    // Case 5: while masked, no full address exists in the DOM, in any attribute
    // inside the scroller, in the document title or in the selection over the
    // whole table. The browser cannot observe an OS clipboard manager or a
    // screen reader's virtual buffer; the selection is the nearest it can see.
    const titleBefore = await page.title();
    const html = await page.evaluate(() => document.body.innerHTML);
    expect(holdsNoAddress(html), 'a full address is in the DOM while masked').toBe(true);
    expect(holdsNoAddress(await attributeText(page)), 'an attribute holds an address').toBe(true);
    expect(holdsNoAddress(await selectedTableText(page)), 'the selection holds an address').toBe(
      true,
    );
    expect(await page.title()).toBe(titleBefore);

    // The prohibition: an IP cell that does not parse (an email, a name, markup)
    // is nowhere in the page in any form, and the pill reports only its count.
    for (const hostile of [
      'player@example.invalid',
      'alert(1)',
      'bold markup',
      '192.0.2.1 and',
      '0xc0.0.2.10',
      'fe80::1%eth0',
      '9'.repeat(200),
    ]) {
      expect(LOGINS_UNREADABLE_IPS.some((value) => value.includes(hostile))).toBe(true);
      expect(html, `${hostile} is in the DOM`).not.toContain(hostile);
    }
    await expect(page.getByTestId('login-excluded')).toContainText(
      formatLoginExcludedPill(ORACLE.unreadableRows),
    );
    expect(ORACLE.unreadableRows).toBeGreaterThan(0);

    // And revealing is the only way an address appears: cell text only, never an
    // attribute.
    const toggle = page.getByTestId('login-mask-toggle');
    await toggle.click();
    const revealedCell = (await cell(rows.first(), 'ip').textContent())?.trim() ?? '';
    expect(SCALE.addresses).toContain(revealedCell);
    expect(holdsNoAddress(await attributeText(page)), 'an attribute holds an address').toBe(true);
    await toggle.click();
    await expect(toggle).toHaveText(MASK_TOGGLE_SHOW);
  });

  test('sorts by every column with the specified first direction, scrolling back to the top, and keeps its state through the mask', async () => {
    const rows = loginTable(page).getByTestId('login-row');
    const first = rows.first();

    // What the oracle says each extreme is.
    const firsts = ORACLE.addresses.flatMap((a) => (a.first === null ? [] : [a.first]));
    const lasts = ORACLE.addresses.flatMap((a) => (a.last === null ? [] : [a.last]));
    const gamesTexts = ORACLE.addresses
      .filter((a) => a.games.length > 0)
      .map((a) => formatGames(a.games))
      .sort();
    const byAddress = ORACLE.addresses.map((a) => a.ip).sort(oracleCompare);
    const loginCounts = ORACLE.addresses.map((a) => a.logins);

    /** Click a header after scrolling away from the top; the sort scrolls back. */
    const sortBy = async (key: string): Promise<void> => {
      await scrollTo(page, 600);
      await page.getByTestId(`login-sort-${key}`).click();
      await expect.poll(() => scrollTopOf(page), { message: `after sorting by ${key}` }).toBe(0);
    };

    // First seen: descending on the first click, ascending on the second.
    await sortBy('first');
    await expectSortedBy(page, 'first', 'descending');
    await expect(cell(first, 'first')).toHaveText(formatLoginDate(Math.max(...firsts)));
    await sortBy('first');
    await expectSortedBy(page, 'first', 'ascending');
    await expect(cell(first, 'first')).toHaveText(formatLoginDate(Math.min(...firsts)));

    // Last seen: descending first.
    await sortBy('last');
    await expectSortedBy(page, 'last', 'descending');
    await expect(cell(first, 'last')).toHaveText(formatLoginDate(Math.max(...lasts)));

    // IP address: ascending first, numeric, IPv4 before IPv6. The IP column is
    // sortable while masked (section 3 Decision), so the check reads the masked
    // prefix of the oracle's extreme addresses.
    await sortBy('ip');
    await expectSortedBy(page, 'ip', 'ascending');
    await expect(cell(first, 'ip')).toHaveText(maskIp(byAddress[0]!));
    await sortBy('ip');
    await expectSortedBy(page, 'ip', 'descending');
    await expect(cell(first, 'ip')).toHaveText(maskIp(byAddress[byAddress.length - 1]!));

    // Games: ascending first, by the displayed text in code-unit order.
    await sortBy('games');
    await expectSortedBy(page, 'games', 'ascending');
    await expect(cell(first, 'games')).toHaveText(gamesTexts[0]!);
    await sortBy('games');
    await expectSortedBy(page, 'games', 'descending');
    await expect(cell(first, 'games')).toHaveText(gamesTexts[gamesTexts.length - 1]!);

    // Country, case 4: ascending first, the names in code-unit order, and the
    // special value (Unknown country) last in BOTH directions.
    const checkCountry = async (direction: 'ascending' | 'descending'): Promise<void> => {
      await expectSortedBy(page, 'country', direction);
      await scrollTo(page, 0);
      const texts = await columnTexts(page, 'country');
      // No special value above a name, and the names in code-unit order.
      const firstUnknown = texts.indexOf(LOGIN_UNKNOWN_COUNTRY);
      if (firstUnknown !== -1) {
        expect(texts.slice(firstUnknown).every((t) => t === LOGIN_UNKNOWN_COUNTRY)).toBe(true);
      }
      const names = texts.filter((t) => t !== LOGIN_UNKNOWN_COUNTRY);
      expect(names.length).toBeGreaterThan(0);
      const ascending = [...names].sort();
      expect(names).toEqual(direction === 'ascending' ? ascending : ascending.reverse());
      // And the very last row of the whole table is the special value.
      await scrollTo(page, 10_000_000);
      const bottom = await columnTexts(page, 'country');
      expect(bottom[bottom.length - 1], `the last row under country ${direction}`).toBe(
        LOGIN_UNKNOWN_COUNTRY,
      );
    };
    await sortBy('country');
    await checkCountry('ascending');
    await sortBy('country');
    await checkCountry('descending');

    // Logins: descending first (a NEW key), ascending on the second click.
    await sortBy('logins');
    await expectSortedBy(page, 'logins', 'descending');
    await expect(first).toHaveAttribute('data-logins', String(Math.max(...loginCounts)));
    await sortBy('logins');
    await expectSortedBy(page, 'logins', 'ascending');
    await expect(first).toHaveAttribute('data-logins', String(Math.min(...loginCounts)));

    // Case 10: toggling the mask keeps the sort, the scroll position and the
    // focus, and reorders nothing under the reader's hands.
    await scrollTo(page, 4_000);
    const before = await rows.evaluateAll((all) =>
      all.map((row) => row.getAttribute('data-logins') ?? ''),
    );
    const scrolled = await scrollTopOf(page);
    const toggle = page.getByTestId('login-mask-toggle');
    await toggle.click();
    await expect(toggle).toBeFocused();
    await expectSortedBy(page, 'logins', 'ascending');
    expect(await scrollTopOf(page)).toBe(scrolled);
    expect(
      await rows.evaluateAll((all) => all.map((row) => row.getAttribute('data-logins') ?? '')),
    ).toEqual(before);
    // The cells now show full addresses, as text.
    const shown = await columnTexts(page, 'ip');
    expect(shown.every((text) => SCALE.addresses.includes(text))).toBe(true);
    await toggle.click();
    await expect(toggle).toBeFocused();
    expect((await columnTexts(page, 'ip')).some((text) => SCALE.addresses.includes(text))).toBe(
      false,
    );
    expect(await scrollTopOf(page)).toBe(scrolled);
  });

  test('scrolls inside its own region with sticky axes, by keyboard, and never widens the page at 375px', async () => {
    await page.setViewportSize({ width: 375, height: 812 });
    // At phone width the list and the detail are separate screens (R2): the
    // narrowing leaves the list screen showing and the detail unmounted, so the
    // pane is opened again here and the scroller is measured at its mount.
    await openSection(page, 'login-history');
    await expect(loginHistoryBlock(page)).toHaveAttribute('data-state', 'ready');
    await expect(loginTable(page).getByTestId('login-row').first()).toBeVisible();
    const scroller = loginScroller(page);
    const table = loginTable(page);
    await scroller.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await scrollTo(page, 0);

    // The page never scrolls sideways; the scroller does.
    const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(pageWidth, `the page widened to ${pageWidth}px at 375px`).toBeLessThanOrEqual(375);
    const overflow = await scroller.evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      minWidth: el.querySelector('table')?.style.minWidth ?? '',
    }));
    expect(overflow.scrollWidth).toBeGreaterThan(overflow.clientWidth);
    // The six default columns sum to 720px, written through the CSSOM.
    expect(overflow.minWidth).toBe('720px');

    // The header stays at the scroller's top after a vertical scroll, and the
    // first column at its left after a horizontal one.
    await scroller.evaluate((el) => {
      el.scrollTop = 400;
      el.scrollLeft = 200;
    });
    const head = table.locator('th').first();
    const firstCell = table.getByTestId('login-row').first().locator('td').first();
    const gap = async (which: 'top' | 'left'): Promise<number> => {
      const scrollerBox = await scroller.boundingBox();
      const headBox = await head.boundingBox();
      const cellBox = await firstCell.boundingBox();
      if (scrollerBox === null || headBox === null || cellBox === null) {
        return Number.POSITIVE_INFINITY;
      }
      return which === 'top'
        ? Math.abs(headBox.y - scrollerBox.y)
        : Math.abs(cellBox.x - scrollerBox.x);
    };
    await expect.poll(() => gap('top'), { message: 'the sticky header at 375px' }).toBeLessThan(3);
    await expect
      .poll(() => gap('left'), { message: 'the sticky first column at 375px' })
      .toBeLessThan(3);

    // The keyboard: the region is one focus stop, and Page Down scrolls it.
    await scroller.evaluate((el) => {
      el.scrollTop = 0;
      el.scrollLeft = 0;
    });
    await scroller.focus();
    await page.keyboard.press('PageDown');
    await expect.poll(() => scrollTopOf(page)).toBeGreaterThan(0);
  });
});

// =============================================================================
// The pinned Account record row, and an address too long for one line
// =============================================================================

/** The longest canonical IPv6 address: 39 characters, no group compressible. */
const WORST_CASE_IPV6 = '2001:db8:abcd:ef01:2345:6789:abcd:ef01';

/**
 * The hand rows plus one worst-case IPv6 row, with the SAMPLE's own
 * Account_Info left in place: its address is 192.0.2.10, which the committed
 * fixture table resolves to Germany, and its recorded country is `US`. That is
 * the disagreement D-02 is about, so the export is chosen for it rather than
 * built around it.
 */
function buildAccountExport(): Uint8Array {
  return buildCustomExport({
    omitFiles: ['Activity_history/Sessions.csv', 'Activity_history/Logins.csv'],
    overrides: {
      'Activity_history/WOT_Game_Sessions.csv': buildRealShapeCsv([
        ...LOGINS_WOT_ROWS,
        ['20.04.2021 10:00', '20.04.2021 10:30', WORST_CASE_IPV6],
      ]),
      'Activity_history/WOWS_Game_Sessions.csv': buildRealShapeCsv(LOGINS_WOWS_ROWS),
    },
  });
}

test('the Account record row is pinned, not counted, follows the mask, and shows what was recorded', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await gotoApp(page);
  await importAndOpen(page, SYNTHETIC_ZIP_NAME, buildAccountExport(), 'login-history');
  await expect(loginHistoryBlock(page)).toHaveAttribute('data-state', 'ready');

  const table = loginTable(page);
  const rows = table.getByTestId('login-row');
  const account = page.getByTestId('login-account-row');

  // Four listed addresses (HOME, WORK, THIRD and the IPv6 one) and eight
  // logins. The Account record is in neither figure, in no tile and in no row
  // of the windowed body; the table counts it once, as its own row.
  await expect(page.getByTestId('login-tile-ips')).toHaveText(formatNumber(4));
  await expect(page.getByTestId('login-count')).toHaveText(formatLoginCountLine(4, 8));
  await expect(rows).toHaveCount(4);
  await expect(table).toHaveAttribute('aria-rowcount', '6');
  await expect(account).toHaveCount(1);
  await expect(account).toHaveAttribute('aria-rowindex', '2');

  // It sits in its own tbody, before the windowed one, and stays there after
  // every sort.
  await expect(table.locator('tbody').first()).toHaveAttribute(
    'data-testid',
    'login-account-row-group',
  );
  for (const key of ['country', 'logins', 'ip']) {
    await page.getByTestId(`login-sort-${key}`).click();
    await expect(table.locator('tbody').first()).toHaveAttribute(
      'data-testid',
      'login-account-row-group',
    );
    await expect(table.locator('tbody tr').nth(0)).toHaveAttribute(
      'data-testid',
      'login-account-row',
    );
  }

  // Its cells: the masked address, the RECORDED country (the account file says
  // US while the offline table resolves this very address to Germany), dashes
  // with hidden text for the three figures, and the tag.
  await expect(cell(account, 'ip')).toHaveText(maskIp(SAMPLE_IP));
  await expect(cell(account, 'country')).toHaveText('United States');
  for (const key of ['logins', 'first', 'last'] as const) {
    await expect(cell(account, key)).toContainText('—');
    await expect(cell(account, key)).toContainText(LOGIN_HIDDEN_NOT_COUNTED);
  }
  await expect(cell(account, 'games')).toContainText(LOGIN_ACCOUNT_TAG);
  const listedHome = rows.filter({ hasText: maskIp(SAMPLE_IP) }).first();
  await expect(cell(listedHome, 'country')).toHaveText('Germany');

  // Follows the mask like every other address.
  expect(await page.evaluate(() => document.body.innerHTML)).not.toContain(SAMPLE_IP);
  await page.getByTestId('login-mask-toggle').click();
  await expect(cell(account, 'ip')).toHaveText(SAMPLE_IP);
  await page.getByTestId('login-mask-toggle').click();
  await expect(cell(account, 'ip')).toHaveText(maskIp(SAMPLE_IP));

  // The note under the table says so, and only because the row exists.
  await expect(page.getByTestId('login-account-note')).toHaveText(LOGIN_ACCOUNT_NOTE);
  await expect(loginHistoryBlock(page)).toContainText(LOGIN_TABLE_FIND_HINT);
  // Amendment A-3 still holds with the hints in a disclosure: the note is
  // outside every details element and ends above the table's scroller.
  const accountNote = page.getByTestId('login-account-note');
  expect(await accountNote.evaluate((el) => el.closest('details') === null)).toBe(true);
  const noteBox = (await accountNote.boundingBox())!;
  const tableBox = (await loginScroller(page).boundingBox())!;
  expect(noteBox.y + noteBox.height).toBeLessThanOrEqual(tableBox.y + 1);

  // Case 7: a 39-character IPv6 address wraps to at most two lines inside the
  // fixed 40px row and is never ellipsised. Sorted by address descending the
  // IPv6 row leads, and revealed its whole text is on screen.
  await page.getByTestId('login-sort-ip').click();
  await expect(header(page, 'ip')).toHaveAttribute('aria-sort', 'descending');
  await page.getByTestId('login-mask-toggle').click();
  const long = rows.first();
  await expect(cell(long, 'ip')).toHaveText(WORST_CASE_IPV6);
  const geometry = await long.evaluate((row) => {
    const td = row.querySelector('td')!;
    const inner = td.querySelector('.ip') as HTMLElement;
    return {
      row: row.getBoundingClientRect().height,
      tdScroll: td.scrollHeight,
      innerHeight: inner.getBoundingClientRect().height,
      innerScroll: inner.scrollHeight,
      innerClient: inner.clientHeight,
    };
  });
  expect(geometry.row).toBe(40);
  expect(geometry.innerHeight, 'a 39-character address wraps').toBeGreaterThan(30);
  expect(geometry.innerHeight).toBeLessThanOrEqual(40);
  expect(geometry.innerScroll, 'the address is not clipped').toBeLessThanOrEqual(
    geometry.innerClient + 1,
  );
  expect(geometry.tdScroll).toBeLessThanOrEqual(40);
  await page.getByTestId('login-mask-toggle').click();

  // Absent when the export has no account address: an archive with no
  // User_Info folder has no row, no group and no note, and the table's size is
  // the listed rows plus the header alone.
  await startOver(page);
  await importAndOpen(
    page,
    'no-account.zip',
    buildLoginsCsvOnlyExportWithoutUserInfo(),
    'login-history',
  );
  await expect(loginHistoryBlock(page)).toHaveAttribute('data-state', 'ready');
  await expect(page.getByTestId('login-tile-ips')).toHaveText(formatNumber(2));
  await expect(page.getByTestId('login-account-row-group')).toHaveCount(0);
  await expect(page.getByTestId('login-account-note')).toHaveCount(0);
  await expect(loginTable(page)).toHaveAttribute('aria-rowcount', '3');
  await expect(loginTable(page).getByTestId('login-row')).toHaveCount(2);
  // A new dataset opens on the default order, not the one left behind by the
  // previous export (the sort rune resets with the mask).
  await expect(header(page, 'logins')).toHaveAttribute('aria-sort', 'descending');
});

// =============================================================================
// The cap
// =============================================================================

test('past the listing cap the table lists the cap, says how many it did not list, and stays windowed', async ({
  page,
}) => {
  test.setTimeout(180_000);
  const spec = buildLoginsOverCapSpec(20_500);
  const oracle = oracleLogins(spec, { countryOf: () => null, maxListed: MAX_LOGIN_IPS });
  expect(oracle.other.addresses).toBe(500);

  await gotoApp(page);
  await importAndOpen(page, SYNTHETIC_ZIP_NAME, buildLoginsScaleExport(spec), 'login-history');
  await expect(loginHistoryBlock(page)).toHaveAttribute('data-state', 'ready', {
    timeout: 120_000,
  });

  const table = loginTable(page);
  const rows = table.getByTestId('login-row');
  await expect(rows.first()).toBeVisible();
  expect(await rows.count()).toBeLessThanOrEqual(30);

  // The listed addresses, the header and the sample's Account record row.
  await expect(table).toHaveAttribute('aria-rowcount', String(MAX_LOGIN_IPS + 2));
  const listedLogins = oracle.addresses.reduce((sum, address) => sum + address.logins, 0);
  await expect(page.getByTestId('login-count')).toHaveText(
    formatLoginCountLine(MAX_LOGIN_IPS, listedLogins),
  );

  // The honest line: the unlisted addresses and their logins, so the listed
  // rows and the stated totals never silently disagree.
  await expect(page.getByTestId('login-cap-line')).toHaveText(
    formatLoginCapLine(oracle.other.addresses, oracle.other.logins),
  );
  await expect(page.getByTestId('login-tile-ips')).toHaveText(
    formatNumber(oracle.addresses.length + oracle.other.addresses),
  );
});
