import '../_support/pin-locale';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Locator, type Page, type Request } from '@playwright/test';
import {
  SYNTHETIC_ZIP_NAME,
  cityOptIn,
  gotoApp,
  importExport,
  loginHistoryBlock,
  loginTable,
  replaceExport,
  startOver,
} from '../_support/helpers.ts';
import { buildLoginsScaleExport, buildLoginsScaleSpec } from '../../fixtures/logins-fixtures.ts';
import { buildCustomExport } from '../../fixtures/export-fixtures.ts';
import { buildRealShapeCsv } from '../../fixtures/playtime-real-shape-fixture.ts';
import { oracleLogins } from '../../helpers/login-oracle.ts';
import { MAX_LOGIN_IPS } from '../../../src/lib/features/logins/login-shared.ts';
import { maskIp } from '../../../src/lib/geo/ip.ts';
import {
  CITY_ACCURACY_NOTE,
  CITY_ANNOUNCE_CANCELLED,
  CITY_ANNOUNCE_DOWNLOADING,
  CITY_ANNOUNCE_READY,
  CITY_CANCELLED,
  CITY_CANCEL_LABEL,
  CITY_ERROR,
  LOGIN_CITY_UNKNOWN,
  LOGIN_NO_VALUE,
  MASK_TOGGLE_SHOW,
  formatCityMoreCities,
  formatCityNoCity,
  formatCityProgress,
  formatCityReady,
  formatNumber,
} from '../../../src/lib/ui-copy.ts';

// =============================================================================
// Phase 06, plan 06-13 — the city-level opt-in, in a real browser
// =============================================================================
//
// WHY A BROWSER SPEC
// The claims below are about what leaves the page and when: nothing until the
// button is pressed, then exactly one same-origin GET for the one file the
// build manifest names. A unit test cannot see a request, and the CSP cannot
// prove which asset it was (a meta CSP cannot be restricted to a path and is
// blind to worker traffic), so THESE assertions are the enforcement: they read
// the request itself.
//
// HERMETIC
// Every response is produced by `route.fulfill` from the committed fixture trio
// (D-17): no live network and no real data. `GEO_FIXTURE=1` is what makes the
// build bake the fixture manifest, so the file name and byte count below are
// read from the same JSON the page was built from and never typed here.
//
// WHERE THE EXPECTED CITIES COME FROM
// Not from the app. The SOURCE CSVs of the two fixture tables are re-read with a
// naive range scan over BigInt values. It shares no code with `range-table.ts`
// or the city decoder, so a bug in either cannot cancel against itself here.
// =============================================================================

// -----------------------------------------------------------------------------
// The committed fixture trio
// -----------------------------------------------------------------------------

const FIXTURES = join(process.cwd(), 'tests/fixtures/geo');

/** The manifest the build baked: file name, gzipped byte count, data month. */
const MANIFEST = JSON.parse(readFileSync(join(FIXTURES, 'city-fixture-manifest.json'), 'utf8')) as {
  file: string;
  bytes: number;
  month: string;
  sha256: string;
};

/** The bytes the route serves: the committed gzipped container. */
const FIXTURE_BYTES = readFileSync(join(FIXTURES, 'city-fixture.gz'));

/** The one path the opt-in may request. */
const ASSET_GLOB = '**/geo-city-data/*.citydb.bin';

/** An address as a number: IPv4 as 32 bits, IPv6 as 128, `::` expanded. */
function addressValue(text: string): bigint {
  if (text.includes(':')) {
    const [head = '', tail = ''] = text.split('::');
    const headGroups = head === '' ? [] : head.split(':');
    const tailGroups = tail === '' ? [] : tail.split(':');
    const missing = text.includes('::') ? 8 - headGroups.length - tailGroups.length : 0;
    const groups = [...headGroups, ...Array<string>(missing).fill('0'), ...tailGroups];
    return groups.reduce((acc, group) => (acc << 16n) | BigInt(parseInt(group, 16)), 0n);
  }
  return text.split('.').reduce((acc, octet) => (acc << 8n) | BigInt(Number(octet)), 0n);
}

/** One CSV line into cells, honouring double quotes and `""` inside them. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let value = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        value += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        value += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      out.push(value);
      value = '';
    } else {
      value += ch;
    }
  }
  out.push(value);
  return out;
}

interface FixtureRange {
  v6: boolean;
  start: bigint;
  end: bigint;
  cells: string[];
}

function readRanges(file: string): FixtureRange[] {
  return readFileSync(join(FIXTURES, file), 'utf8')
    .split(/\r?\n/)
    .filter((line) => line !== '' && !line.startsWith('#') && !line.startsWith('start,'))
    .map((line) => {
      const cells = splitCsvLine(line);
      return {
        v6: cells[0]!.includes(':'),
        start: addressValue(cells[0]!),
        end: addressValue(cells[1]!),
        cells,
      };
    });
}

const COUNTRY_RANGES = readRanges('country-fixture.csv');
const CITY_RANGES = readRanges('city-fixture.csv');

function rangeOf(ranges: readonly FixtureRange[], canonical: string): FixtureRange | undefined {
  const v6 = canonical.includes(':');
  const value = addressValue(canonical);
  return ranges.find((r) => r.v6 === v6 && r.start <= value && value <= r.end);
}

/**
 * The City cell the page must show for an address, from the CSVs alone.
 *
 * An address with no country (an explicit `ZZ`, or no row) is a dash: the
 * database does not get to place an address the account's own table could not
 * name. A country with no city name, or no city row, is `City unknown`.
 */
function expectedCityCell(canonical: string): string {
  const country = rangeOf(COUNTRY_RANGES, canonical);
  if (country === undefined || country.cells[2] === 'ZZ') return LOGIN_NO_VALUE;
  const city = rangeOf(CITY_RANGES, canonical);
  if (city === undefined) return LOGIN_CITY_UNKNOWN;
  const state = city.cells[4]!;
  const name = city.cells[5]!;
  if (name === '') return LOGIN_CITY_UNKNOWN;
  return state === '' ? name : `${name}, ${state}`;
}

// -----------------------------------------------------------------------------
// Request recording
// -----------------------------------------------------------------------------

/**
 * Record every request the CONTEXT makes, the worker's included (Playwright
 * does see a module worker's requests here, measured in 06-09).
 */
function recordRequests(page: Page): Request[] {
  const requests: Request[] = [];
  page.context().on('request', (request) => requests.push(request));
  return requests;
}

/** Poll until the request count has stopped moving, and return it. */
async function stableRequestCount(page: Page, requests: readonly Request[]): Promise<number> {
  let last = -1;
  for (;;) {
    const now = requests.length;
    if (now === last) return now;
    last = now;
    await page.waitForTimeout(400);
  }
}

/** Serve the fixture for the one city asset path. */
async function serveFixture(page: Page): Promise<void> {
  await page.route(ASSET_GLOB, (route) =>
    route.fulfill({ status: 200, contentType: 'application/gzip', body: FIXTURE_BYTES }),
  );
}

// -----------------------------------------------------------------------------
// The tracer
// -----------------------------------------------------------------------------

const SCALE = buildLoginsScaleSpec();
const ORACLE = oracleLogins(SCALE, { countryOf: () => null, maxListed: MAX_LOGIN_IPS });

test('tracer: nothing is requested before the click, then one click fetches the fixture and a City cell appears', async ({
  page,
}) => {
  const requests = recordRequests(page);
  await serveFixture(page);
  await gotoApp(page);
  await importExport(page, SYNTHETIC_ZIP_NAME, buildLoginsScaleExport(SCALE));
  await expect(loginHistoryBlock(page)).toHaveAttribute('data-state', 'ready', {
    timeout: 30_000,
  });
  await expect(cityOptIn(page)).toHaveAttribute('data-state', 'idle');

  // The page is idle: nothing further may be requested until the button is
  // pressed. The count is polled until it stops moving, then held.
  const before = await stableRequestCount(page, requests);
  await page.waitForTimeout(600);
  expect(requests.length).toBe(before);

  await page.getByTestId('city-load').click();
  await expect(cityOptIn(page)).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });

  // Exactly one request, for exactly the manifest's file, and nothing in it
  // that could carry the export: the CSP cannot prove this (a meta CSP cannot be
  // restricted to a path and is blind to workers), so the request itself is read.
  const after = requests.slice(before);
  expect(after).toHaveLength(1);
  const request = after[0]!;
  const url = new URL(request.url());
  expect(url.origin).toBe(new URL(page.url()).origin);
  expect(request.method()).toBe('GET');
  expect(url.pathname.endsWith(`/geo-city-data/${MANIFEST.file}`)).toBe(true);
  expect(url.search).toBe('');
  expect(url.hash).toBe('');
  expect(request.postData()).toBeNull();
  expect((await request.allHeaders())['referer']).toBeUndefined();

  // The City column exists, and the first drawn row's cell is what the CSVs say.
  const top = ORACLE.addresses[0]!;
  const firstRow = loginTable(page).getByTestId('login-row').first();
  await expect(firstRow).toHaveAttribute('data-logins', String(top.logins));
  const cityHeader = page.getByTestId('login-sort-city');
  await expect(cityHeader).toBeVisible();
  const cityIndex = await page
    .locator('th')
    .filter({ has: cityHeader })
    .evaluate((th) => Array.from(th.parentElement!.children).indexOf(th));
  await expect(firstRow.locator('td').nth(cityIndex)).toHaveText(expectedCityCell(top.ip));
});

// -----------------------------------------------------------------------------
// Small exports with addresses chosen on purpose
// -----------------------------------------------------------------------------

/** One address and how many logins it carries. */
type Entry = readonly [ip: string, logins: number];

/** A WOT session file with `logins` rows for each address, plus the sample's account. */
function buildEntriesExport(entries: readonly Entry[]): Uint8Array {
  const rows: [string, string, string][] = [];
  for (const [ip, logins] of entries) {
    for (let i = 0; i < logins; i++) rows.push(['13.03.2019 20:00', '13.03.2019 21:00', ip]);
  }
  return buildCustomExport({
    omitFiles: ['Activity_history/Sessions.csv', 'Activity_history/Logins.csv'],
    overrides: { 'Activity_history/WOT_Game_Sessions.csv': buildRealShapeCsv(rows) },
  });
}

/** DE (München, Bayern), AU with no city name, and an address with no country. */
const HOME = '192.0.2.10';
const NO_CITY = '198.51.100.10';
const NO_COUNTRY = '203.0.113.230';

/**
 * One address in every city range of the fixture that has a city name.
 *
 * The fixture's IPv6 section is sixty /48s, but the COUNTRY fixture covers only
 * forty of them, and an address with no country is never looked up. So the
 * places a list can reach are the forty plus the IPv4 cities, which together are
 * well past the fifty-row cap. The first five get more logins than the rest, so
 * the ranking is not one long tie.
 */
const RANGE_STARTS: readonly Entry[] = CITY_RANGES.filter((range) => range.cells[5] !== '').map(
  (range, n): Entry => [range.v6 ? `${range.cells[0]}1` : range.cells[0]!, n < 5 ? 5 - n : 1],
);

/** The list case: three leading addresses by logins, then one address per fixture city. */
const LIST_ENTRIES: readonly Entry[] = [
  [HOME, 20],
  [NO_CITY, 15],
  [NO_COUNTRY, 12],
  ...RANGE_STARTS,
];

/** The small export the lifecycle case replaces and re-imports. */
const FIRST_ENTRIES: readonly Entry[] = [
  [HOME, 5],
  [NO_CITY, 3],
  [NO_COUNTRY, 2],
];
const OTHER_ENTRIES: readonly Entry[] = [
  ['192.0.2.70', 4],
  ['203.0.113.64', 2],
];

/** One expected place row, from the CSVs alone. */
interface ExpectedPlace {
  cc: string;
  state: string;
  city: string;
  logins: number;
  ips: number;
}

/**
 * What the ranked list, its two captions and the table's City cells must be.
 *
 * Rules, from 06-UI-SPEC section 5: an address with no country is not looked up;
 * a country with no city NAME is counted, not listed; a place is one distinct
 * (country, state, city); the list is ranked by logins, then city, then country
 * code, and cut at fifty.
 */
function expectedList(entries: readonly Entry[]): {
  rows: ExpectedPlace[];
  more: number;
  noCity: number;
} {
  const places = new Map<string, ExpectedPlace>();
  let noCity = 0;
  for (const [ip, logins] of entries) {
    const country = rangeOf(COUNTRY_RANGES, ip);
    if (country === undefined || country.cells[2] === 'ZZ') continue;
    const city = rangeOf(CITY_RANGES, ip);
    if (city === undefined) continue;
    if (city.cells[5] === '') {
      noCity += 1;
      continue;
    }
    const key = [city.cells[3], city.cells[4], city.cells[5]].join('\t');
    const place = places.get(key) ?? {
      cc: city.cells[3]!,
      state: city.cells[4]!,
      city: city.cells[5]!,
      logins: 0,
      ips: 0,
    };
    place.logins += logins;
    place.ips += 1;
    places.set(key, place);
  }
  const ranked = [...places.values()].sort((a, b) => {
    if (a.logins !== b.logins) return b.logins - a.logins;
    if (a.city !== b.city) return a.city < b.city ? -1 : 1;
    return a.cc < b.cc ? -1 : a.cc > b.cc ? 1 : 0;
  });
  return { rows: ranked.slice(0, 50), more: Math.max(0, ranked.length - 50), noCity };
}

/** The English region name, as the page's own `Intl` answers it, for a 2-letter code. */
const REGION_NAMES = new Intl.DisplayNames(['en'], { type: 'region' });

/** The column index of City in the table, once the column is drawn. */
async function cityColumnIndex(page: Page): Promise<number> {
  const header = page.getByTestId('login-sort-city');
  return page
    .locator('th')
    .filter({ has: header })
    .evaluate((th) => Array.from(th.parentElement!.children).indexOf(th));
}

/** A drawn row's City cell text, whitespace collapsed. */
async function cityCellOf(page: Page, row: Locator): Promise<string> {
  const index = await cityColumnIndex(page);
  return ((await row.locator('td').nth(index).textContent()) ?? '').replace(/\s+/g, ' ').trim();
}

/** The country view, as text and attributes: what a cancelled or failed load must leave alone. */
async function countryView(page: Page): Promise<string> {
  const block = loginHistoryBlock(page);
  const tiles = await block.getByTestId('login-summary-counts').innerText();
  const facts = await block.getByTestId('login-summary-facts').innerText();
  const count = await block.getByTestId('login-count').innerText();
  const map = await block
    .getByTestId('login-country')
    .evaluateAll((els) =>
      els.map((el) => [el.getAttribute('data-iso'), el.getAttribute('data-logins')]),
    );
  const rows = await block
    .getByTestId('login-row')
    .evaluateAll((els) => els.slice(0, 6).map((el) => el.textContent?.replace(/\s+/g, ' ').trim()));
  return JSON.stringify({ tiles, facts, count, map, rows });
}

/** Everything the page could have written somewhere: stores, cookies and the URL. */
async function everythingStored(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const parts: string[] = [
      JSON.stringify({ ...localStorage }),
      JSON.stringify({ ...sessionStorage }),
      document.cookie,
      location.href,
    ];
    const dbs = (await indexedDB.databases()).map((info) => info.name!).filter(Boolean);
    for (const name of dbs) {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const open = indexedDB.open(name);
        open.onsuccess = () => resolve(open.result);
        open.onerror = () => reject(open.error);
      });
      for (const store of Array.from(db.objectStoreNames)) {
        const all = await new Promise<unknown[]>((resolve, reject) => {
          const request = db.transaction(store, 'readonly').objectStore(store).getAll();
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        parts.push(JSON.stringify(all));
      }
      db.close();
    }
    return parts.join('\n');
  });
}

// -----------------------------------------------------------------------------
// The list, the accuracy note, the privacy rules and persistence
// -----------------------------------------------------------------------------

test('after a click the table, the ranked list and the accuracy note are right, no address is in the list, and nothing is stored', async ({
  page,
}) => {
  await serveFixture(page);
  await gotoApp(page);
  await importExport(page, SYNTHETIC_ZIP_NAME, buildEntriesExport(LIST_ENTRIES));
  await expect(loginHistoryBlock(page)).toHaveAttribute('data-state', 'ready', {
    timeout: 30_000,
  });

  // Before the click: no City column, no list, the intro with the manifest's size.
  await expect(page.getByTestId('login-sort-city')).toHaveCount(0);
  await expect(page.getByTestId('city-list')).toHaveCount(0);

  await page.getByTestId('city-load').click();
  await expect(cityOptIn(page)).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });

  // The ready line names the data month from the manifest, and the accuracy note
  // is on screen whenever city data is.
  expect(MANIFEST.month).toBe('0000-00');
  await expect(page.getByTestId('city-ready')).toHaveText(formatCityReady('0000-00'));
  await expect(page.getByTestId('city-ready')).toBeFocused();
  await expect(page.getByTestId('city-note')).toHaveText(CITY_ACCURACY_NOTE);
  await expect(page.getByTestId('city-load')).toHaveCount(0);
  await expect(page.getByTestId('login-history-status')).toHaveText(CITY_ANNOUNCE_READY);

  // The ranked list: fifty rows in logins, then city, then country order, then
  // the captions. Singular forms where the count is one.
  const expected = expectedList(LIST_ENTRIES);
  expect(expected.rows).toHaveLength(50);
  expect(expected.more).toBeGreaterThan(0);
  const list = page.getByTestId('city-list');
  await expect(list).toHaveAttribute('open', '');
  const rows = list.getByTestId('city-row');
  await expect(rows).toHaveCount(50);
  for (let i = 0; i < expected.rows.length; i++) {
    const place = expected.rows[i]!;
    const cells = rows.nth(i).locator('td');
    await expect(cells.nth(0)).toHaveText(
      place.state === '' ? place.city : `${place.city}, ${place.state}`,
    );
    if (/^[A-Z]{2}$/.test(place.cc))
      await expect(cells.nth(1)).toHaveText(REGION_NAMES.of(place.cc)!);
    await expect(cells.nth(2)).toHaveText(formatNumber(place.logins));
    await expect(cells.nth(3)).toHaveText(formatNumber(place.ips));
  }
  await expect(list.getByTestId('city-more')).toHaveText(formatCityMoreCities(expected.more));
  // The country-without-a-city address is counted, once; the address with no
  // country is in neither the list nor that count.
  expect(expected.noCity).toBe(1);
  await expect(list.getByTestId('city-no-city')).toHaveText(formatCityNoCity(expected.noCity));

  // The City column: the place, `City unknown` (muted) and a dash, in the three
  // rows the logins put first; the pinned Account record keeps the city the
  // account file RECORDED, never the database's answer for the same address.
  const tableRows = loginTable(page).getByTestId('login-row');
  await expect(tableRows.first()).toHaveAttribute('data-logins', '20');
  await expect(tableRows.nth(0).locator('td').first()).toHaveText(maskIp(HOME));
  expect(await cityCellOf(page, tableRows.nth(0))).toBe(expectedCityCell(HOME));
  expect(await cityCellOf(page, tableRows.nth(1))).toBe(LOGIN_CITY_UNKNOWN);
  expect(await cityCellOf(page, tableRows.nth(2))).toBe(LOGIN_NO_VALUE);
  expect(expectedCityCell(NO_CITY)).toBe(LOGIN_CITY_UNKNOWN);
  expect(expectedCityCell(NO_COUNTRY)).toBe(LOGIN_NO_VALUE);
  expect(await cityCellOf(page, loginTable(page).getByTestId('login-account-row'))).toBe(
    'Testville',
  );

  // Sorting by City works like Country: ascending first, code-unit order, and
  // the special values last in both directions.
  const named = LIST_ENTRIES.map(([ip]) => expectedCityCell(ip)).filter(
    (text) => text !== LOGIN_CITY_UNKNOWN && text !== LOGIN_NO_VALUE,
  );
  const smallest = named.reduce((a, b) => (a < b ? a : b));
  const largest = named.reduce((a, b) => (a > b ? a : b));
  await page.getByTestId('login-sort-city').click();
  await expect(
    page.locator('th').filter({ has: page.getByTestId('login-sort-city') }),
  ).toHaveAttribute('aria-sort', 'ascending');
  expect(await cityCellOf(page, tableRows.first())).toBe(smallest);
  await page.getByTestId('login-sort-city').click();
  expect(await cityCellOf(page, tableRows.first())).toBe(largest);

  // Privacy: while masked no full address is anywhere in the page; revealed, the
  // city list still holds none (it has no field for one).
  const everyAddress = LIST_ENTRIES.map(([ip]) => ip);
  const bodyMasked = await page.evaluate(() => document.body.innerHTML);
  for (const ip of everyAddress) expect(bodyMasked, ip).not.toContain(ip);
  await page.getByTestId('login-mask-toggle').click();
  const listText = await list.innerText();
  const listHtml = await list.innerHTML();
  for (const ip of everyAddress) {
    expect(listText).not.toContain(ip);
    expect(listHtml).not.toContain(ip);
  }
  expect(listText).not.toMatch(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/);
  await page.getByTestId('login-mask-toggle').click();
  await expect(page.getByTestId('login-mask-toggle')).toHaveText(MASK_TOGGLE_SHOW);

  // Persistence (D-15): a reload returns the block to idle with no City column,
  // and nothing the page stored holds a city name from the fixture.
  const cityNames = ['München', 'Nürnberg', 'Tampines', 'Edinburgh', 'Gdańsk'];
  const stored = await everythingStored(page);
  // Not vacuous: the stores do hold the imported dataset, so a city name could
  // have been written beside it.
  expect(stored.length).toBeGreaterThan(1000);
  for (const name of cityNames) expect(stored, name).not.toContain(name);
  await page.reload();
  await expect(loginHistoryBlock(page)).toHaveAttribute('data-state', 'ready', {
    timeout: 30_000,
  });
  await expect(cityOptIn(page)).toHaveAttribute('data-state', 'idle');
  await expect(page.getByTestId('login-sort-city')).toHaveCount(0);
  await expect(page.getByTestId('city-list')).toHaveCount(0);
  const storedAfter = await everythingStored(page);
  for (const name of cityNames) expect(storedAfter, name).not.toContain(name);
});

// -----------------------------------------------------------------------------
// The lifecycle: progress, cancel, failures, replace, Clear, phone width
// -----------------------------------------------------------------------------

test('progress, cancel and failures leave the country view alone, and a replace or Clear returns everything to its defaults', async ({
  page,
}) => {
  const requests = recordRequests(page);
  const failed: Request[] = [];
  page.on('requestfailed', (request) => {
    if (request.url().includes('/geo-city-data/')) failed.push(request);
  });

  // A slow server: the response is held until the test lets it go.
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  await page.route(ASSET_GLOB, async (route) => {
    await gate;
    // The page may have aborted the request while it was held.
    await route
      .fulfill({ status: 200, contentType: 'application/gzip', body: FIXTURE_BYTES })
      .catch(() => undefined);
  });

  await gotoApp(page);
  await importExport(page, SYNTHETIC_ZIP_NAME, buildEntriesExport(FIRST_ENTRIES));
  const block = loginHistoryBlock(page);
  await expect(block).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });
  const untouched = await countryView(page);
  const optIn = cityOptIn(page);
  const status = block.getByTestId('login-history-status');

  // Idle: the intro and the size button, and the neutral chrome of the button.
  await expect(optIn).toHaveAttribute('data-state', 'idle');
  await expect(page.getByTestId('city-load')).toBeVisible();

  // Downloading: a determinate progress whose max is the manifest's size, the
  // progress line, Cancel with its recorded label, and NO Load button; focus
  // moved to Cancel; the live region said it once, in words.
  const before = requests.length;
  await page.getByTestId('city-load').click();
  await expect(optIn).toHaveAttribute('data-state', 'downloading');
  const progress = page.getByTestId('city-progress');
  await expect(progress).toHaveAttribute('max', String(MANIFEST.bytes));
  await expect(progress).toHaveAttribute('value', '0');
  await expect(page.getByTestId('city-progress-line')).toHaveText(
    formatCityProgress(0, MANIFEST.bytes),
  );
  await expect(page.getByTestId('city-cancel')).toHaveText(CITY_CANCEL_LABEL);
  await expect(page.getByTestId('city-load')).toHaveCount(0);
  await expect(page.getByTestId('city-cancel')).toBeFocused();
  await expect(status).toHaveText(CITY_ANNOUNCE_DOWNLOADING);
  // One press, one request, for the manifest's file.
  await expect.poll(() => requests.length).toBe(before + 1);

  // Phone width: the progress row stacks its text, bar and Cancel, and the page
  // does not scroll sideways.
  await page.setViewportSize({ width: 375, height: 800 });
  const line = await page.getByTestId('city-progress-line').boundingBox();
  const bar = await progress.boundingBox();
  const cancel = await page.getByTestId('city-cancel').boundingBox();
  expect(line!.y + line!.height).toBeLessThanOrEqual(bar!.y + 1);
  expect(bar!.y + bar!.height).toBeLessThanOrEqual(cancel!.y + 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await page.setViewportSize({ width: 1280, height: 720 });

  // Cancel: the request is aborted, the block says so on a NEUTRAL line (no alert
  // role: cancelling is the user's own choice), focus is on Load, and the
  // country view is exactly as it was.
  await page.getByTestId('city-cancel').click();
  await expect(optIn).toHaveAttribute('data-state', 'cancelled');
  const cancelled = page.getByTestId('city-cancelled');
  await expect(cancelled).toHaveText(CITY_CANCELLED);
  await expect(cancelled).not.toHaveAttribute('role', /.*/);
  await expect(optIn.getByRole('alert')).toHaveCount(0);
  await expect(page.getByTestId('city-load')).toBeFocused();
  await expect(status).toHaveText(CITY_ANNOUNCE_CANCELLED);
  await expect.poll(() => failed.length).toBeGreaterThan(0);
  expect(await countryView(page)).toBe(untouched);
  await expect(page.getByTestId('login-sort-city')).toHaveCount(0);
  release();

  // A genuine failure is NOT a cancel: a 500, a body that is not the file, and a
  // body of the right size with the wrong contents each show the one fixed
  // sentence in the alert chrome, never a status or a path, with Load back.
  const fail = async (status: number, body: Buffer): Promise<void> => {
    await page.unroute(ASSET_GLOB);
    await page.route(ASSET_GLOB, (route) => route.fulfill({ status, body }));
    await page.getByTestId('city-load').click();
    await expect(optIn).toHaveAttribute('data-state', 'error', { timeout: 15_000 });
    const error = page.getByTestId('city-error');
    await expect(error).toHaveText(CITY_ERROR);
    await expect(error).toHaveAttribute('role', 'alert');
    await expect(error).not.toHaveAttribute('aria-live', /.*/);
    await expect(error).not.toContainText('500');
    await expect(error).not.toContainText('passwd');
    await expect(page.getByTestId('city-load')).toBeFocused();
    expect(await countryView(page)).toBe(untouched);
    await expect(page.getByTestId('login-sort-city')).toHaveCount(0);
  };
  await fail(500, Buffer.from('<h1>500 /etc/passwd</h1>'));
  await fail(200, Buffer.from('this is not the city file'));
  await fail(200, Buffer.alloc(MANIFEST.bytes, 7));

  // Reveal and sort, then replace the export DURING a slow download: the
  // download is dropped without a word (no cancelled line), the block is idle,
  // and the mask and the sort went back to their defaults with the dataset.
  let release2!: () => void;
  const gate2 = new Promise<void>((resolve) => (release2 = resolve));
  await page.unroute(ASSET_GLOB);
  await page.route(ASSET_GLOB, async (route) => {
    await gate2;
    await route
      .fulfill({ status: 200, contentType: 'application/gzip', body: FIXTURE_BYTES })
      .catch(() => undefined);
  });
  await block.getByTestId('login-mask-toggle').click();
  await expect(block.getByTestId('login-mask-toggle')).toHaveAttribute('data-masked', 'false');
  await page.getByTestId('login-sort-country').click();
  await page.getByTestId('city-load').click();
  await expect(optIn).toHaveAttribute('data-state', 'downloading');
  await replaceExport(page, 'other-export.zip', buildEntriesExport(OTHER_ENTRIES));
  await expect(block).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });
  const expectDefaults = async (): Promise<void> => {
    await expect(optIn).toHaveAttribute('data-state', 'idle');
    await expect(page.getByTestId('city-cancelled')).toHaveCount(0);
    await expect(page.getByText(CITY_CANCELLED)).toHaveCount(0);
    await expect(page.getByTestId('login-sort-city')).toHaveCount(0);
    await expect(page.getByTestId('city-list')).toHaveCount(0);
    await expect(block.getByTestId('login-mask-toggle')).toHaveAttribute('data-masked', 'true');
    await expect(
      page.locator('th').filter({ has: page.getByTestId('login-sort-logins') }),
    ).toHaveAttribute('aria-sort', 'descending');
  };
  await expectDefaults();
  // A late answer for the dropped download changes nothing.
  release2();
  await page.waitForTimeout(500);
  await expectDefaults();

  // Load for real on the new dataset, then replace again: the City column and the
  // list are gone, and the block is idle again.
  await page.unroute(ASSET_GLOB);
  await serveFixture(page);
  await page.getByTestId('city-load').click();
  await expect(optIn).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });
  await expect(page.getByTestId('login-sort-city')).toHaveCount(1);
  await block.getByTestId('login-mask-toggle').click();
  await page.getByTestId('login-sort-city').click();
  await replaceExport(page, 'first-export.zip', buildEntriesExport(FIRST_ENTRIES));
  await expect(block).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });
  await expectDefaults();

  // Clear, then import again: still idle, still the defaults.
  await page.getByTestId('login-sort-country').click();
  await page.getByTestId('city-load').click();
  await expect(optIn).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });
  await startOver(page);
  await expect(optIn).toHaveCount(0);
  await importExport(page, SYNTHETIC_ZIP_NAME, buildEntriesExport(OTHER_ENTRIES));
  await expect(block).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });
  await expectDefaults();
});
