import '../_support/pin-locale';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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
  countryList,
  gotoApp,
  importExport,
  loginHistoryBlock,
  loginMap,
  loginScroller,
  loginTable,
} from '../_support/helpers.ts';
import { buildLoginsScaleExport, buildLoginsScaleSpec } from '../../fixtures/logins-fixtures.ts';
import { oracleCompare, oracleLogins } from '../../helpers/login-oracle.ts';
import { WORLD_SHAPES } from '../../../src/lib/geo/world-map.generated.ts';
import {
  COUNTRY_LIST_NOT_DRAWN_SUFFIX,
  LOGIN_MULTI_FILE_NOTE,
  LOGIN_UNKNOWN_COUNTRY,
  MASK_TOGGLE_SHOW,
  formatGames,
  formatNumber,
} from '../../../src/lib/ui-copy.ts';

// =============================================================================
// Phase 06, plan 06-14 — the 10,000-row proof (ROADMAP success criterion 4)
// =============================================================================
//
// WHAT THIS PROVES
// "With a synthetic fixture of 10k+ login rows, the IP table stays smooth to
// scroll and sort, and the map stays responsive because it aggregates per
// country rather than drawing one marker per login." Smoothness of scrolling on
// a person's device is not something a headless browser can feel, so the
// measurable halves are asserted instead: how many elements the page holds
// while the table lists 662 addresses and the export holds 12,000 rows, how long
// a sort takes to land, and how many nodes the map draws.
//
// ONE EXPENSIVE IMPORT, FIVE CHEAP READS
// Priced as a block in `tests/unit/guards/ci-budget.test.ts`, like the two older
// scale specs: the 12,000-row import is paid once in `beforeAll` and every test
// reads the same already-rendered DOM. The tests are serial and each one leaves
// the page as it found it (sorted by Logins, masked, list closed) for the next.
//
// WHERE THE EXPECTATIONS COME FROM
// Not from the app. `GEO_FIXTURE` (set by the Playwright config and nowhere
// else) makes the build resolve addresses through the committed 377-byte fixture
// table, whose documentation ranges are the only addresses that resolve to a
// country; the real table answers `ZZ` for every one of them. The expectation
// re-reads that table's SOURCE CSV with a naive BigInt range scan and feeds the
// result to the independent oracle in `tests/helpers/login-oracle.ts`. Nothing
// here imports the aggregator, the range table, the map model or the masking
// code; `WORLD_SHAPES` is imported for the node bound and nothing else.
//
// WHY THE COUNTRY SPREAD IS WHAT IT IS
// The fixture draws 600 IPv4 addresses over the three RFC 5737 /24s, which the
// fixture table cuts into /27 blocks of one country each, so the export reaches
// more than twenty distinct countries (and an explicit `ZZ` block and a country
// with no map shape). The IPv6 addresses all sit in 2001:db8:0::/48, which the
// fixture table gives to a single country: they add rows and masking cases, not
// country diversity, and this file does not pretend otherwise.
// =============================================================================

/** One row of the fixture CSV: a family, an inclusive numeric range, a country. */
interface FixtureRange {
  v6: boolean;
  start: bigint;
  end: bigint;
  cc: string;
}

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

const FIXTURE_RANGES: readonly FixtureRange[] = readFileSync(
  join(process.cwd(), 'tests/fixtures/geo/country-fixture.csv'),
  'utf8',
)
  .split(/\r?\n/)
  .filter((line) => line !== '' && !line.startsWith('#') && !line.startsWith('start,'))
  .map((line) => {
    const [start, end, cc] = line.split(',') as [string, string, string];
    return { v6: start.includes(':'), start: addressValue(start), end: addressValue(end), cc };
  });

/** The fixture's country for a canonical address, or null (explicit `ZZ` or no row). */
function fixtureCountryOf(canonical: string): string | null {
  const v6 = canonical.includes(':');
  const value = addressValue(canonical);
  const hit = FIXTURE_RANGES.find((r) => r.v6 === v6 && r.start <= value && value <= r.end);
  return hit === undefined || hit.cc === 'ZZ' ? null : hit.cc;
}

/**
 * The English names of the countries the fixture table assigns, as literals.
 *
 * Literals rather than `Intl.DisplayNames`, so the expectation does not depend on
 * which ICU build Node and the browser each ship. A code the fixture gains that
 * is missing here fails loudly in `nameOf` rather than being silently skipped.
 */
const NAME: Readonly<Record<string, string>> = {
  AR: 'Argentina',
  AU: 'Australia',
  BR: 'Brazil',
  CA: 'Canada',
  CN: 'China',
  DE: 'Germany',
  ES: 'Spain',
  FI: 'Finland',
  FR: 'France',
  GB: 'United Kingdom',
  GI: 'Gibraltar',
  IN: 'India',
  IT: 'Italy',
  JP: 'Japan',
  KR: 'South Korea',
  MX: 'Mexico',
  NG: 'Nigeria',
  NL: 'Netherlands',
  PL: 'Poland',
  SE: 'Sweden',
  SG: 'Singapore',
  US: 'United States',
  ZA: 'South Africa',
};

function nameOf(cc: string): string {
  const name = NAME[cc];
  if (name === undefined)
    throw new Error(`the fixture table assigns ${cc}, which has no name here`);
  return name;
}

const SPEC = buildLoginsScaleSpec();
const ORACLE = oracleLogins(SPEC, {
  countryOf: fixtureCountryOf,
  // The export lists 662 addresses, far below the production cap; an unbounded
  // value here keeps this file from importing the constant it is checking.
  maxListed: Number.MAX_SAFE_INTEGER,
});

/** The codes the generated map has a shape for, and which of those are tiny. */
const SHAPE = new Map(WORLD_SHAPES.map((shape) => [shape.iso, shape]));
const SHAPE_COUNT = 235;

/** What the page should say per country, ranked as the list ranks them. */
const RANKED_COUNTRIES = [...ORACLE.countries].sort((a, b) =>
  b.logins !== a.logins ? b.logins - a.logins : nameOf(a.cc) < nameOf(b.cc) ? -1 : 1,
);
const DRAWN = ORACLE.countries.filter((c) => SHAPE.has(c.cc));
const TINY_WITH_LOGINS = DRAWN.filter((c) => SHAPE.get(c.cc)?.tiny === true).length;

/**
 * The whole page's element budget: it holds shapes and a window, never the rows.
 *
 * MEASURED at 3,274 elements on the 12,000-row import (the entire dashboard: the
 * Playtime charts, the Financial and Player-statistics blocks and the map
 * included), so this is a ceiling with about a third of headroom rather than a
 * tight fit. A row per listed address would add some 4,600 elements (seven per
 * row, 662 rows) and a marker per login some 12,000, so a regression that stops
 * windowing or draws one per login cannot hide under it.
 */
const DOM_NODE_BOUND = 4_500;

/** A sort has this long to land its first row. A hung or quadratic sort fails here. */
const SORT_SETTLE_MS = 5_000;

/** The masked IPv6 form: three leading groups, then five masked ones. */
const MASKED_IPV6 = /^2001:db8:0:xxxx:xxxx:xxxx:xxxx:xxxx$/;

const COLUMN_INDEX = { ip: 0, country: 1, logins: 2, first: 3, last: 4, games: 5 } as const;
type ColumnKey = keyof typeof COLUMN_INDEX;

/** `2019-03-13`, from wall-clock seconds, by the platform's own calendar. */
function dateOf(seconds: number): string {
  return new Date(seconds * 1000).toISOString().slice(0, 10);
}

/** `a.b.c.xxx` for an IPv4 and the masked IPv6 text for an IPv6, from the text alone. */
function maskedText(canonical: string): string {
  if (canonical.includes(':')) {
    const [a, b, c] = canonical.split(':');
    return `${a}:${b}:${c}:xxxx:xxxx:xxxx:xxxx:xxxx`;
  }
  const [a, b, c] = canonical.split('.');
  return `${a}.${b}.${c}.xxx`;
}

function cell(row: Locator, key: ColumnKey): Locator {
  return row.locator('td').nth(COLUMN_INDEX[key]);
}

function clean(text: string | null): string {
  return (text ?? '').replace(/\s+/g, ' ').trim();
}

test.describe('the login history at 10,000 rows and more', () => {
  test.describe.configure({ mode: 'serial' });

  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }: { browser: Browser }) => {
    test.setTimeout(180_000);
    context = await browser.newContext();
    page = await context.newPage();
    await gotoApp(page);
    await importExport(page, SYNTHETIC_ZIP_NAME, buildLoginsScaleExport(SPEC));
    await expect(loginHistoryBlock(page)).toHaveAttribute('data-state', 'ready', {
      timeout: 60_000,
    });
    await expect(loginTable(page).getByTestId('login-row').first()).toBeVisible();
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test('tracer: the table holds a window, not the rows, and the page holds a fixed number of elements', async () => {
    // The fixture really is at the size the roadmap names, over many countries.
    expect(SPEC.rowCount).toBeGreaterThanOrEqual(10_000);
    expect(ORACLE.addresses.length).toBeGreaterThan(500);
    expect(
      ORACLE.countries.length,
      'the fixture must exercise many countries',
    ).toBeGreaterThanOrEqual(20);
    expect(ORACLE.unknown.addresses, 'and an explicit unknown bucket').toBeGreaterThan(0);

    const table = loginTable(page);
    const rows = table.getByTestId('login-row');
    const drawn = await rows.count();
    expect(drawn).toBeGreaterThan(0);
    expect(drawn).toBeLessThanOrEqual(30);

    // Listed addresses, the header row and the pinned Account record row.
    await expect(table).toHaveAttribute('aria-rowcount', String(ORACLE.addresses.length + 2));

    // The Account record is the first body row and is not one of the windowed ones.
    const account = page.getByTestId('login-account-row');
    await expect(account).toHaveCount(1);
    await expect(table.locator('tbody').first()).toHaveAttribute(
      'data-testid',
      'login-account-row-group',
    );

    // The default order is Logins descending: the first drawn row carries the
    // oracle's largest count.
    await expect(rows.first()).toHaveAttribute('data-logins', String(ORACLE.addresses[0]!.logins));

    // The whole page, map included, is bounded and does not scale with the rows.
    const nodes = await page.evaluate(() => document.querySelectorAll('*').length);
    expect(nodes, `the page holds ${nodes} elements`).toBeLessThanOrEqual(DOM_NODE_BOUND);
  });

  test('every sort settles within a bound, lands on the oracle extreme and keeps the Account record first', async () => {
    const table = loginTable(page);
    const rows = table.getByTestId('login-row');
    const first = rows.first();
    const scroller = loginScroller(page);

    const firsts = ORACLE.addresses.flatMap((a) => (a.first === null ? [] : [a.first]));
    const lasts = ORACLE.addresses.flatMap((a) => (a.last === null ? [] : [a.last]));
    const gamesTexts = ORACLE.addresses
      .filter((a) => a.games.length > 0)
      .map((a) => formatGames(a.games))
      .sort();
    const byAddress = ORACLE.addresses.map((a) => a.ip).sort(oracleCompare);
    const loginCounts = ORACLE.addresses.map((a) => a.logins);
    const knownNames = ORACLE.addresses
      .flatMap((a) => (a.cc === null ? [] : [nameOf(a.cc)]))
      .sort();

    /** Scroll away, click the header, and wait for the sort to scroll back to the top. */
    const sortBy = async (key: ColumnKey): Promise<number> => {
      await scroller.evaluate((el) => {
        el.scrollTop = 600;
      });
      const startedAt = Date.now();
      await page.getByTestId(`login-sort-${key}`).click();
      await expect
        .poll(() => scroller.evaluate((el) => el.scrollTop), {
          message: `the ${key} sort scrolled back to the top`,
          timeout: SORT_SETTLE_MS,
        })
        .toBe(0);
      return startedAt;
    };

    /** The first drawn row's text for one column must become `text` within the bound. */
    const expectFirst = async (
      key: ColumnKey,
      text: string,
      startedAt: number,
      label: string,
    ): Promise<void> => {
      await expect(cell(first, key), label).toHaveText(text, { timeout: SORT_SETTLE_MS });
      const elapsed = Date.now() - startedAt;
      expect(elapsed, `${label} took ${elapsed} ms`).toBeLessThan(SORT_SETTLE_MS);
      // The pinned row is first in the body after EVERY sort.
      await expect(table.locator('tbody').first()).toHaveAttribute(
        'data-testid',
        'login-account-row-group',
      );
      await expect(page.getByTestId('login-account-row')).toHaveCount(1);
    };

    let at = await sortBy('ip');
    await expectFirst('ip', maskedText(byAddress[0]!), at, 'IP ascending');
    at = await sortBy('ip');
    // IPv4 sorts before IPv6, so the greatest address is an IPv6 one, and its
    // text is the masked IPv6 form: three groups, then five masked ones (D-06).
    expect(byAddress[byAddress.length - 1]!.includes(':')).toBe(true);
    await expectFirst('ip', maskedText(byAddress[byAddress.length - 1]!), at, 'IP descending');
    expect(clean(await cell(first, 'ip').textContent())).toMatch(MASKED_IPV6);

    at = await sortBy('first');
    await expectFirst('first', dateOf(Math.max(...firsts)), at, 'First seen descending');
    at = await sortBy('first');
    await expectFirst('first', dateOf(Math.min(...firsts)), at, 'First seen ascending');

    at = await sortBy('last');
    await expectFirst('last', dateOf(Math.max(...lasts)), at, 'Last seen descending');

    at = await sortBy('games');
    await expectFirst('games', gamesTexts[0]!, at, 'Games ascending');

    at = await sortBy('country');
    await expectFirst('country', knownNames[0]!, at, 'Country ascending');
    // The special value is last in both directions: the table's final row.
    await scroller.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await expect(cell(rows.last(), 'country')).toHaveText(LOGIN_UNKNOWN_COUNTRY);

    // Logins last: a NEW key sorts descending, then ascending on the second click.
    at = await sortBy('logins');
    await expect(first).toHaveAttribute('data-logins', String(Math.max(...loginCounts)), {
      timeout: SORT_SETTLE_MS,
    });
    expect(Date.now() - at).toBeLessThan(SORT_SETTLE_MS);
    at = await sortBy('logins');
    await expect(first).toHaveAttribute('data-logins', String(Math.min(...loginCounts)), {
      timeout: SORT_SETTLE_MS,
    });
    expect(Date.now() - at).toBeLessThan(SORT_SETTLE_MS);

    // Leave the page as the next test expects: Logins descending, at the top.
    await sortBy('logins');
    await expect(first).toHaveAttribute('data-logins', String(ORACLE.addresses[0]!.logins));
  });

  test('the six tiles and the multi-file note agree with the oracle', async () => {
    await expect(page.getByTestId('login-tile-ips')).toHaveText(
      formatNumber(ORACLE.addresses.length + ORACLE.other.addresses),
    );
    await expect(page.getByTestId('login-tile-countries')).toHaveText(
      formatNumber(ORACLE.countries.length),
    );
    await expect(page.getByTestId('login-tile-unknown')).toHaveText(
      formatNumber(ORACLE.unknown.addresses),
    );

    // The top country: the most logins, a tie broken by English name.
    const top = RANKED_COUNTRIES[0]!;
    await expect(page.getByTestId('login-tile-top-country')).toHaveText(nameOf(top.cc));

    // The most-used address is the first listed one, masked, and the export holds
    // a Logins.csv-shaped file next to the three session files.
    await expect(page.getByTestId('login-tile-top-ip')).toHaveText(
      maskedText(ORACLE.addresses[0]!.ip),
    );
    await expect(page.getByTestId('login-multi-file-note')).toHaveText(LOGIN_MULTI_FILE_NOTE);
  });

  test('the map aggregates per country: a bounded node count, one shaded shape per country, and a list that sums to the logins', async () => {
    expect(WORLD_SHAPES.length).toBe(SHAPE_COUNT);
    const map = loginMap(page);

    // One element per country with logins AND a shape; never one per login or
    // per address. The count a map may hold is the shapes, a marker pair per tiny
    // country and three more, whatever the row count.
    await expect(map.getByTestId('login-country')).toHaveCount(DRAWN.length);
    const nodes = await map.evaluate((svg) => svg.querySelectorAll('*').length);
    expect(nodes, `the map holds ${nodes} nodes`).toBeLessThanOrEqual(
      SHAPE_COUNT + 2 * TINY_WITH_LOGINS + 3,
    );
    expect(nodes).toBeLessThan(SPEC.rowCount / 10);

    // Every drawn country carries the oracle's figures.
    for (const country of DRAWN) {
      const element = map.locator(`[data-testid="login-country"][data-iso="${country.cc}"]`);
      await expect(element).toHaveAttribute('data-logins', String(country.logins));
      await expect(element).toHaveAttribute('data-ips', String(country.ips));
    }

    // The list holds every country, ranked, and the unknown bucket, and its
    // login figures add up to every login counted.
    const list = countryList(page);
    await list.locator('summary').click();
    await expect(list).toHaveAttribute('open', '');
    const read = await page.getByTestId('country-row').evaluateAll((els) =>
      els.map((el) => ({
        iso: el.getAttribute('data-iso'),
        cells: [...el.querySelectorAll('td')].map((td) => (td.textContent ?? '').trim()),
      })),
    );
    expect(read).toEqual(
      RANKED_COUNTRIES.map((c) => ({
        iso: c.cc,
        cells: [
          `${nameOf(c.cc)}${SHAPE.has(c.cc) ? '' : COUNTRY_LIST_NOT_DRAWN_SUFFIX}`,
          formatNumber(c.logins),
          formatNumber(c.ips),
        ],
      })),
    );
    const unknown = page.getByTestId('login-unknown-row');
    await expect(unknown).toHaveCount(1);
    await expect(unknown.locator('td').nth(1)).toHaveText(formatNumber(ORACLE.unknown.logins));
    await expect(unknown.locator('td').nth(2)).toHaveText(formatNumber(ORACLE.unknown.addresses));
    const countryLogins = RANKED_COUNTRIES.reduce((sum, c) => sum + c.logins, 0);
    expect(countryLogins + ORACLE.unknown.logins).toBe(ORACLE.totalLogins);
    await list.locator('summary').click();
    await expect(list).not.toHaveAttribute('open', '');
  });

  test('addresses stay masked until revealed, and revealing shows full addresses as text only', async () => {
    // While masked, no full fixture address is anywhere in the document.
    const holdsNoAddress = (text: string): boolean =>
      !SPEC.addresses.some((address) => text.includes(address));
    const html = await page.evaluate(() => document.body.innerHTML);
    expect(holdsNoAddress(html), 'a full address is in the DOM while masked').toBe(true);

    const rows = loginTable(page).getByTestId('login-row');
    const toggle = page.getByTestId('login-mask-toggle');
    await toggle.click();
    const revealed = clean(await cell(rows.first(), 'ip').textContent());
    expect(SPEC.addresses, 'the first revealed row shows a full address').toContain(revealed);
    await toggle.click();
    await expect(toggle).toHaveText(MASK_TOGGLE_SHOW);
    expect(holdsNoAddress(await page.evaluate(() => document.body.innerHTML))).toBe(true);
  });
});
