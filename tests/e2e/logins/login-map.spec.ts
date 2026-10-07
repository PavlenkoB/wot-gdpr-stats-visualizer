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
  replaceExport,
} from '../_support/helpers.ts';
import { buildLoginsScaleExport, buildLoginsScaleSpec } from '../../fixtures/logins-fixtures.ts';
import { buildCustomExport } from '../../fixtures/export-fixtures.ts';
import { buildRealShapeCsv } from '../../fixtures/playtime-real-shape-fixture.ts';
import { oracleLogins } from '../../helpers/login-oracle.ts';
import { MAX_LOGIN_IPS } from '../../../src/lib/features/logins/login-shared.ts';
import { mapLevel } from '../../../src/lib/features/logins/map-model.ts';
import { WORLD_SHAPES, WORLD_VIEWBOX } from '../../../src/lib/geo/world-map.generated.ts';
import {
  COUNTRY_LIST_NOT_DRAWN_SUFFIX,
  LEGEND_LESS,
  LEGEND_MORE,
  LOGIN_UNKNOWN_COUNTRY,
  MAP_ATTRIBUTION_LINK_TEXT,
  MAP_ATTRIBUTION_SUFFIX,
  MAP_HEADING,
  MAP_NO_COUNTRIES,
  formatLoginShareLine,
  formatMapCountryLabel,
  formatMapLegendNote,
  formatMapNotDrawn,
  formatMapSummary,
  formatMapTooltipLines,
  formatNumber,
} from '../../../src/lib/ui-copy.ts';

// =============================================================================
// Phase 06, plan 06-12 — the country map, in a real browser
// =============================================================================
//
// WHY A BROWSER SPEC
// Vitest has no layout engine. The claims below are about what a page holds and
// what a user can do with it: how many nodes the SVG has, whether a tooltip
// stays inside the viewport, where Tab lands. Everything that is arithmetic is
// in `tests/unit/logins/map-model.test.ts`.
//
// WHERE THE EXPECTED COUNTRIES COME FROM
// Not from the app. `GEO_FIXTURE` makes the build resolve addresses through the
// committed 377-byte fixture table, and the expectation below re-reads the
// SOURCE CSV of that table (`tests/fixtures/geo/country-fixture.csv`) with a
// naive range scan over BigInt values. It shares no code with `range-table.ts`,
// so a bug in the lookup cannot cancel against itself here.
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

/** The codes the generated map has a polygon for. */
const DRAWABLE = new Set(WORLD_SHAPES.map((shape) => shape.iso));

test('tracer: a real import shades the right countries at the level the scale rule gives, and the SVG holds no text', async ({
  page,
}) => {
  const spec = buildLoginsScaleSpec();
  const oracle = oracleLogins(spec, { countryOf: fixtureCountryOf, maxListed: MAX_LOGIN_IPS });
  const max = Math.max(...oracle.countries.map((c) => c.logins));
  const drawn = oracle.countries.filter((c) => DRAWABLE.has(c.cc));

  await gotoApp(page);
  await importExport(page, SYNTHETIC_ZIP_NAME, buildLoginsScaleExport(spec));
  await expect(loginHistoryBlock(page)).toHaveAttribute('data-state', 'ready', {
    timeout: 30_000,
  });

  const map = loginMap(page);
  const countries = map.getByTestId('login-country');
  // The fixture spreads the scale export over several countries, so the map has
  // something to shade, and exactly the ones the oracle says have a shape.
  expect(drawn.length).toBeGreaterThan(3);
  await expect(countries).toHaveCount(drawn.length);

  // Each shaded country carries the level the rule gives its oracle login count.
  for (const country of drawn) {
    const element = map.locator(`[data-testid="login-country"][data-iso="${country.cc}"]`);
    await expect(element).toHaveAttribute('data-logins', String(country.logins));
    await expect(element).toHaveAttribute('data-ips', String(country.ips));
    await expect(element).toHaveAttribute('data-level', String(mapLevel(country.logins, max)));
  }

  // The leader is the top of the scale; the scale is more than one shade.
  const levels = new Set(drawn.map((c) => mapLevel(c.logins, max)));
  expect(levels.size).toBeGreaterThan(1);

  // The map holds no text of any kind: names and figures live elsewhere.
  await expect(map.locator('text')).toHaveCount(0);
  await expect(map.locator('title')).toHaveCount(0);
});

// -----------------------------------------------------------------------------
// Small exports with countries chosen on purpose
// -----------------------------------------------------------------------------

/** One address and how many logins it carries. */
type Entry = readonly [ip: string, logins: number];

/**
 * One documentation address per country the cases use, each read out of
 * `tests/fixtures/geo/country-fixture.csv` (RFC 5737 blocks, one country per /27).
 * No real address is committed anywhere (D-17).
 */
const IP = {
  DE: '192.0.2.10',
  DE_2: '192.0.2.11',
  FR: '192.0.2.40',
  JP: '192.0.2.70',
  SG: '192.0.2.100',
  US: '192.0.2.170',
  AU: '198.51.100.10',
  GI: '198.51.100.100',
  AR: '203.0.113.170',
  FI: '203.0.113.200',
  UNKNOWN: '203.0.113.230',
} as const;

/** The English names of those countries, as literals: only stable names are asserted. */
const NAME: Readonly<Record<string, string>> = {
  DE: 'Germany',
  FR: 'France',
  JP: 'Japan',
  SG: 'Singapore',
  US: 'United States',
  AU: 'Australia',
  GI: 'Gibraltar',
  AR: 'Argentina',
  FI: 'Finland',
};

/** Every fixture address a test may put in an export, for the "no address on screen" check. */
const ALL_ADDRESSES: readonly string[] = Object.values(IP);

/** A WOT session file with `logins` rows for each address, and nothing else new. */
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

/** What the map must show for these entries, from the fixture CSV and nothing in `src/`. */
function expectedOf(entries: readonly Entry[]): {
  total: number;
  unknown: { addresses: number; logins: number };
  /** Ranked: logins descending, then English name. */
  countries: { cc: string; name: string; logins: number; ips: number }[];
} {
  const byCountry = new Map<string, { logins: number; ips: Set<string> }>();
  const unknown = { addresses: new Set<string>(), logins: 0 };
  let total = 0;
  for (const [ip, logins] of entries) {
    total += logins;
    const cc = fixtureCountryOf(ip);
    if (cc === null) {
      unknown.addresses.add(ip);
      unknown.logins += logins;
      continue;
    }
    const rollup = byCountry.get(cc) ?? { logins: 0, ips: new Set<string>() };
    rollup.logins += logins;
    rollup.ips.add(ip);
    byCountry.set(cc, rollup);
  }
  const countries = [...byCountry.entries()]
    .map(([cc, r]) => ({ cc, name: NAME[cc] ?? cc, logins: r.logins, ips: r.ips.size }))
    .sort((a, b) =>
      b.logins !== a.logins ? b.logins - a.logins : a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
    );
  return {
    total,
    unknown: { addresses: unknown.addresses.size, logins: unknown.logins },
    countries,
  };
}

/** The six-country case: two tie at the top, one is tiny, one has no shape. */
const MANY: readonly Entry[] = [
  [IP.DE, 20],
  [IP.DE_2, 10],
  [IP.FR, 30],
  [IP.JP, 6],
  [IP.GI, 4],
  [IP.SG, 3],
  [IP.AU, 1],
  [IP.UNKNOWN, 2],
];

/** The same countries at 100 logins and at 10,000, to prove the node count ignores logins. */
const HUNDRED: readonly Entry[] = [
  [IP.DE, 40],
  [IP.FR, 30],
  [IP.JP, 10],
  [IP.SG, 5],
  [IP.GI, 5],
  [IP.AU, 5],
  [IP.UNKNOWN, 5],
];
const TEN_THOUSAND: readonly Entry[] = HUNDRED.map(([ip, n]) => [ip, n * 100] as const);

/** The shape of a code, from the generated module. */
function shapeOf(cc: string): (typeof WORLD_SHAPES)[number] {
  const shape = WORLD_SHAPES.find((s) => s.iso === cc);
  if (shape === undefined) throw new Error(`no shape for ${cc}`);
  return shape;
}

/** Wait for the block to show a dataset, then wait for the map section to settle. */
async function ready(page: Page): Promise<void> {
  await expect(loginHistoryBlock(page)).toHaveAttribute('data-state', 'ready', {
    timeout: 30_000,
  });
}

/** Every element inside the map, which is the node count the scale rule bounds. */
function nodeCount(page: Page): Promise<number> {
  return loginMap(page).evaluate((svg) => svg.querySelectorAll('*').length);
}

/**
 * The shipped hybrid map's shape count, as a literal. The UI-SPEC's 238 is a
 * ceiling: the 110m atlas drops Antarctica, Northern Cyprus and Somaliland and the
 * 50m supplement adds 61, which is 235. A regenerated map with a different count
 * must fail the first assertion of the node-count test, not quietly move the bound.
 */
const SHAPE_COUNT = 235;

/** The most nodes the map may hold for these entries: shapes, a marker pair per tiny country, three. */
function nodeBound(entries: readonly Entry[]): number {
  const tinyWithLogins = expectedOf(entries).countries.filter(
    (c) => WORLD_SHAPES.find((s) => s.iso === c.cc)?.tiny === true,
  ).length;
  return SHAPE_COUNT + 2 * tinyWithLogins + 3;
}

/** A number as the list shows it, with the viewer's grouping removed. */
function plain(text: string | null): number {
  return Number((text ?? '').replace(/[^\d]/g, ''));
}

/** The three parts of the sum the UI-SPEC requires, read from the page. */
async function readSums(page: Page): Promise<{
  drawn: number;
  drawnCount: number;
  notDrawn: number;
  unknown: number;
}> {
  const drawn = await loginMap(page)
    .getByTestId('login-country')
    .evaluateAll((els) => els.map((el) => Number(el.getAttribute('data-logins'))));
  const rows = await page.getByTestId('country-row').evaluateAll((els) =>
    els.map((el) => ({
      name: el.querySelector('td')?.textContent ?? '',
      logins: el.querySelectorAll('td')[1]?.textContent ?? '',
    })),
  );
  const unknownRow = page.getByTestId('login-unknown-row');
  const unknown =
    (await unknownRow.count()) === 0
      ? 0
      : plain(await unknownRow.locator('td').nth(1).textContent());
  return {
    drawn: drawn.reduce((a, b) => a + b, 0),
    drawnCount: drawn.length,
    notDrawn: rows
      .filter((row) => row.name.includes(COUNTRY_LIST_NOT_DRAWN_SUFFIX.trim()))
      .reduce((sum, row) => sum + plain(row.logins), 0),
    unknown,
  };
}

/**
 * A point on the page that is over a country, or over its marker.
 *
 * Found by asking the browser what is under a grid of points across the shape's
 * box, so a country whose centre is in the sea (an island chain) is still
 * hovered on land. The nearest hit to the box centre wins.
 */
async function pointOver(page: Page, cc: string): Promise<{ x: number; y: number }> {
  return page.evaluate((iso) => {
    const path = document.querySelector(`[data-testid="login-country"][data-iso="${iso}"]`);
    if (path === null) throw new Error(`no country ${iso}`);
    const box = path.getBoundingClientRect();
    const centre = { x: box.left + box.width / 2, y: box.top + box.height / 2 };
    let best: { x: number; y: number } | null = null;
    let bestDistance = Infinity;
    for (let i = 0; i <= 40; i++) {
      for (let j = 0; j <= 40; j++) {
        const x = box.left + (box.width * i) / 40;
        const y = box.top + (box.height * j) / 40;
        const hit = document.elementFromPoint(x, y);
        if (hit?.closest('[data-iso]')?.getAttribute('data-iso') !== iso) continue;
        const distance = (x - centre.x) ** 2 + (y - centre.y) ** 2;
        if (distance < bestDistance) {
          bestDistance = distance;
          best = { x, y };
        }
      }
    }
    if (best === null) throw new Error(`nothing over ${iso}`);
    return best;
  }, cc);
}

/** Scroll the map to a fixed place in the viewport, instantly. */
async function placeMap(page: Page, top: number): Promise<void> {
  await page.evaluate((wanted) => {
    const map = document.querySelector('[data-testid="login-map"]');
    if (map === null) throw new Error('no map');
    window.scrollTo({
      top: window.scrollY + map.getBoundingClientRect().top - wanted,
      behavior: 'instant',
    });
  }, top);
}

/** Wait until the page has stopped scrolling, so a tooltip that a scroll closes has been reopened. */
async function settled(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        let last = Number.NaN;
        const check = (): void => {
          if (window.scrollY === last) resolve();
          else {
            last = window.scrollY;
            window.setTimeout(check, 150);
          }
        };
        check();
      }),
  );
}

/** Every attribute value and the text under a locator, for the no-address check. */
function everythingUnder(locator: Locator): Promise<string> {
  return locator.evaluate((root) => {
    const parts: string[] = [root.outerHTML, root.textContent ?? ''];
    for (const el of [root, ...root.querySelectorAll('*')]) {
      for (const name of el.getAttributeNames()) parts.push(el.getAttribute(name) ?? '');
    }
    return parts.join('\n');
  });
}

function holdsNoAddress(text: string): boolean {
  return !ALL_ADDRESSES.some((address) => text.includes(address));
}

// =============================================================================
// 1. The node count ignores the logins; the sums hold; a replace re-shades
// =============================================================================

test('the node count is the same at 100 and at 10,000 logins, within the bound, and the sums hold', async ({
  page,
}) => {
  test.setTimeout(120_000);
  expect(WORLD_SHAPES.length).toBe(SHAPE_COUNT);
  await gotoApp(page);

  const cases: [string, readonly Entry[]][] = [
    ['100 logins', HUNDRED],
    ['10,000 logins', TEN_THOUSAND],
  ];
  const counts: number[] = [];

  for (const [index, [label, entries]] of cases.entries()) {
    const bytes = buildEntriesExport(entries);
    if (index === 0) await importExport(page, SYNTHETIC_ZIP_NAME, bytes);
    else await replaceExport(page, SYNTHETIC_ZIP_NAME, bytes);
    await ready(page);

    const expected = expectedOf(entries);
    const drawn = expected.countries.filter((c) => DRAWABLE.has(c.cc));

    // Case 12: the shading follows THIS dataset, not the previous one. A replace
    // returns while the old dataset is still on screen, so wait on a value only
    // the new one has (Germany's logins, in its attribute) before reading more.
    await expect(
      loginMap(page).locator('[data-testid="login-country"][data-iso="DE"]'),
      label,
    ).toHaveAttribute(
      'data-logins',
      String(expected.countries.find((c) => c.cc === 'DE')!.logins),
      {
        // The replace is still importing when the helper returns, and 10,000 rows
        // on a loaded worker take longer than the default five seconds.
        timeout: 30_000,
      },
    );
    const sums = await readSums(page);

    // Case 2: the elements are the countries with logins AND a shape, and the
    // three parts add up to the logins counted (the recorded cap outcome).
    await expect(loginMap(page).getByTestId('login-country'), label).toHaveCount(drawn.length);
    expect(sums.drawnCount, label).toBe(drawn.length);
    expect(sums.drawn + sums.notDrawn + sums.unknown, label).toBe(expected.total);
    expect(sums.notDrawn, `${label}: the not-drawn country is Gibraltar's`).toBe(
      expected.countries.find((c) => c.cc === 'GI')!.logins,
    );
    expect(sums.unknown, label).toBe(expected.unknown.logins);

    counts.push(await nodeCount(page));
    expect(counts[index]!, `${label}: node count within the bound`).toBeLessThanOrEqual(
      nodeBound(entries),
    );
  }

  // Case 1: a hundredfold more logins over the same countries, the same nodes.
  expect(counts[0]).toBe(counts[1]);
});

// =============================================================================
// 2. One rendered six-country import, read three ways
// =============================================================================

test.describe('the map on one rendered import', () => {
  test.describe.configure({ mode: 'serial' });

  let context: BrowserContext;
  let page: Page;
  const expected = expectedOf(MANY);

  test.beforeAll(async ({ browser }: { browser: Browser }) => {
    test.setTimeout(120_000);
    context = await browser.newContext();
    page = await context.newPage();
    await gotoApp(page);
    await importExport(page, SYNTHETIC_ZIP_NAME, buildEntriesExport(MANY));
    await ready(page);
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test('hovering a country shows the two specified lines and a ring, never an address, and leaving hides both', async () => {
    const map = loginMap(page);
    const tooltip = page.getByTestId('map-tooltip');
    await placeMap(page, 200);

    // Germany: two addresses, 30 logins, tied with France and ranked after it.
    const de = expected.countries.find((c) => c.cc === 'DE')!;
    expect(de.logins).toBe(30);
    const at = await pointOver(page, 'DE');
    await page.mouse.move(at.x, at.y);

    await expect(tooltip).toBeVisible();
    const lines = await tooltip.locator('p').allTextContents();
    expect(lines).toEqual([...formatMapTooltipLines('Germany', 30, 2, 'en-US')]);
    expect(lines).toHaveLength(2);
    expect(holdsNoAddress(lines.join('\n'))).toBe(true);
    expect(lines.join('\n')).not.toMatch(/\d+\.\d+\.\d+|::|[0-9a-f]{4}:/i);

    // The tooltip is anchored at the POINTER, not at the country's box: its
    // centre is on the pointer's x and it sits above it.
    const box = (await tooltip.boundingBox())!;
    expect(Math.abs(box.x + box.width / 2 - at.x)).toBeLessThanOrEqual(2);
    expect(box.y + box.height).toBeLessThanOrEqual(at.y);

    // The overlay ring is Germany's own outline, in two strokes.
    await expect(map.locator('path.ring-outer')).toHaveCount(1);
    await expect(map.locator('path.ring-inner')).toHaveCount(1);
    await expect(map.locator('path.ring-outer')).toHaveAttribute('d', shapeOf('DE').d);

    // Moving to another country moves both; leaving hides both.
    const jp = await pointOver(page, 'JP');
    await page.mouse.move(jp.x, jp.y);
    await expect(tooltip.locator('p').first()).toHaveText('Japan');
    await expect(map.locator('path.ring-outer')).toHaveAttribute('d', shapeOf('JP').d);

    await page.mouse.move(5, 5);
    await expect(tooltip).toBeHidden();
    await expect(map.locator('path.ring-outer')).toHaveCount(0);
  });

  test('is one tab stop that enters on the leader, follows the ranked order and stops at both ends', async () => {
    const map = loginMap(page);
    const tooltip = page.getByTestId('map-tooltip');
    const country = (cc: string): Locator =>
      map.locator(`[data-testid="login-country"][data-iso="${cc}"]`);
    await placeMap(page, 200);
    await page.mouse.move(5, 5);

    // Ranked: France and Germany tie on 30 and France comes first by NAME (its
    // code sorts after Germany's), then Japan, then Singapore, then Australia.
    // Gibraltar has no shape, so it is not in the keyboard's order at all.
    const order = ['FR', 'DE', 'JP', 'SG', 'AU'];
    expect(expected.countries.filter((c) => DRAWABLE.has(c.cc)).map((c) => c.cc)).toEqual(order);

    // Exactly one stop for the whole map.
    await expect(map.locator('[data-testid="login-country"][tabindex="0"]')).toHaveCount(1);
    await expect(country('FR')).toHaveAttribute('tabindex', '0');

    // Tab from the table's last sort button enters the map on the leader, with
    // the ring and the tooltip, and the tooltip sits at the centroid.
    await page.getByTestId('login-sort-games').focus();
    await page.keyboard.press('Tab');
    await expect(country('FR')).toBeFocused();
    await settled(page);
    await expect(page.getByTestId('map-tooltip')).toBeVisible();
    await expect(map.locator('path.ring-outer')).toHaveAttribute('d', shapeOf('FR').d);
    const svg = (await map.boundingBox())!;
    const [vx = 0, vy = 0, vw = 960, vh = 500] = WORLD_VIEWBOX.split(' ').map(Number);
    const centroid = {
      x: svg.x + ((shapeOf('FR').cx - vx) * svg.width) / vw,
      y: svg.y + ((shapeOf('FR').cy - vy) * svg.height) / vh,
    };
    const box = (await tooltip.boundingBox())!;
    expect(Math.abs(box.x + box.width / 2 - centroid.x)).toBeLessThanOrEqual(3);
    expect(box.y + box.height).toBeLessThanOrEqual(centroid.y + 1);
    await expect(country('FR')).toHaveAttribute(
      'aria-label',
      formatMapCountryLabel('France', 30, 1, 'en-US'),
    );

    // A second Tab leaves the map: the next stop is the DB-IP link under the
    // legend, and the ring and tooltip go with the focus.
    await page.keyboard.press('Tab');
    await expect(page.getByTestId('map-attribution-link')).toBeFocused();
    await expect(tooltip).toBeHidden();
    await expect(map.locator('path.ring-outer')).toHaveCount(0);

    // Shift+Tab comes back to where the stop was, not to the first country.
    await page.keyboard.press('Shift+Tab');
    await expect(country('FR')).toBeFocused();

    // Arrows follow the ranked order, Right and Down forward, Left and Up back.
    await page.keyboard.press('ArrowRight');
    await expect(country('DE')).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(country('JP')).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(country('SG')).toBeFocused();
    await expect(tooltip.locator('p').first()).toHaveText('Singapore');
    await page.keyboard.press('ArrowRight');
    await expect(country('AU')).toBeFocused();
    // The last country: a further press stays put and does not scroll the page.
    await settled(page);
    const scrollBefore = await page.evaluate(() => window.scrollY);
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowDown');
    await expect(country('AU')).toBeFocused();
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);
    await page.keyboard.press('ArrowLeft');
    await expect(country('SG')).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(country('JP')).toBeFocused();
    await page.keyboard.press('Home');
    await expect(country('FR')).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowUp');
    await expect(country('FR')).toBeFocused();
    await page.keyboard.press('End');
    await expect(country('AU')).toBeFocused();

    // Still one stop, and it is the focused one.
    await expect(map.locator('[data-testid="login-country"][tabindex="0"]')).toHaveCount(1);
    await expect(country('AU')).toHaveAttribute('tabindex', '0');

    // Escape hides the tooltip and leaves the focus where it is.
    await expect(tooltip).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(tooltip).toBeHidden();
    await expect(country('AU')).toBeFocused();
  });

  test('states every number in words: the sentence, the legend steps, the list, the attribution and the sums', async () => {
    const map = loginMap(page);
    const total = expected.total;
    expect(total).toBe(76);

    // The sentence: the many form, with ALL counted logins as the base and the
    // unknown-country sentence appended. The Top country tile agrees with it.
    const summary = page.getByTestId('login-map-summary');
    await expect(summary).toHaveAttribute('data-form', 'many');
    await expect(summary).toHaveText(formatMapSummary(6, 'France', 30, 76, 1, 2, 'en-US'));
    await expect(page.getByTestId('login-tile-top-country')).toHaveText('France');
    await expect(page.getByTestId('login-tile-top-country-share')).toHaveText(
      formatLoginShareLine(30, 76, 'en-US'),
    );
    await expect(page.getByRole('heading', { name: MAP_HEADING })).toBeVisible();

    // The shades, from the arithmetic by hand: with a maximum of 30, 6 logins is
    // level 3 (6^4 = 1296 lies between 30^2 and 30^3), 3 is level 2, 1 is level 1.
    const levels: Record<string, string> = { FR: '5', DE: '5', JP: '3', SG: '2', AU: '1' };
    for (const [cc, level] of Object.entries(levels)) {
      await expect(map.locator(`[data-testid="login-country"][data-iso="${cc}"]`)).toHaveAttribute(
        'data-level',
        level,
      );
    }

    // The legend: level 0 and the four levels in use, and the steps in words.
    const legend = page.getByTestId('map-legend');
    await expect(legend).toBeVisible();
    await expect(legend.locator('.swatch')).toHaveCount(5);
    await expect(legend).toContainText(LEGEND_LESS);
    await expect(legend).toContainText(LEGEND_MORE);
    await expect(legend).toContainText(formatMapLegendNote([1, 3, 6, 30], 'en-US'));

    // The attribution: always visible with the map, and a safe external link.
    const attribution = page.getByTestId('map-attribution');
    await expect(attribution).toBeVisible();
    await expect(attribution).toHaveText(`${MAP_ATTRIBUTION_LINK_TEXT}${MAP_ATTRIBUTION_SUFFIX}`);
    const link = page.getByTestId('map-attribution-link');
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', 'https://db-ip.com');
    await expect(link).toHaveAttribute('target', '_blank');
    expect(((await link.getAttribute('rel')) ?? '').split(/\s+/).sort()).toEqual([
      'noopener',
      'noreferrer',
    ]);

    // The not-drawn line: Gibraltar is counted and has no shape.
    await expect(page.getByTestId('map-not-drawn')).toHaveText(formatMapNotDrawn(1, 'en-US'));
    expect(await map.getByTestId('login-country').count()).toBe(5);
    await expect(map.locator('[data-testid="login-country"][data-iso="GI"]')).toHaveCount(0);

    // The list: closed by default, opens by its summary, and holds every number.
    const list = countryList(page);
    await expect(list).not.toHaveAttribute('open', '');
    await list.locator('summary').click();
    await expect(list).toHaveAttribute('open', '');
    const rows = page.getByTestId('country-row');
    await expect(rows).toHaveCount(6);
    const read = await rows.evaluateAll((els) =>
      els.map((el) => ({
        iso: el.getAttribute('data-iso'),
        cells: [...el.querySelectorAll('td')].map((td) => (td.textContent ?? '').trim()),
      })),
    );
    // Ranked by logins, ties by name, and the country with no shape marked.
    expect(read).toEqual([
      { iso: 'FR', cells: ['France', '30', '1'] },
      { iso: 'DE', cells: ['Germany', '30', '2'] },
      { iso: 'JP', cells: ['Japan', '6', '1'] },
      { iso: 'GI', cells: [`Gibraltar${COUNTRY_LIST_NOT_DRAWN_SUFFIX}`, '4', '1'] },
      { iso: 'SG', cells: ['Singapore', '3', '1'] },
      { iso: 'AU', cells: ['Australia', '1', '1'] },
    ]);
    const unknown = page.getByTestId('login-unknown-row');
    await expect(unknown).toHaveCount(1);
    expect((await unknown.locator('td').allTextContents()).map((text) => text.trim())).toEqual([
      LOGIN_UNKNOWN_COUNTRY,
      formatNumber(2, 'en-US'),
      formatNumber(1, 'en-US'),
    ]);
    // The unknown row is last.
    expect(await page.locator('[data-testid="login-unknown-row"] ~ tr').count()).toBe(0);

    // The sum: drawn + not drawn + unknown = the logins counted.
    const sums = await readSums(page);
    expect(sums).toEqual({ drawn: 70, drawnCount: 5, notDrawn: 4, unknown: 2 });
    expect(sums.drawn + sums.notDrawn + sums.unknown).toBe(total);

    // Case 11: while masked, no full address is in the section, its attributes,
    // the tooltip or the list.
    await expect(page.getByTestId('login-mask-toggle')).toHaveAttribute('data-masked', 'true');
    await placeMap(page, 200);
    const at = await pointOver(page, 'FR');
    await page.mouse.move(at.x, at.y);
    await expect(page.getByTestId('map-tooltip')).toBeVisible();
    expect(holdsNoAddress(await everythingUnder(page.getByTestId('login-map-section')))).toBe(true);
    expect(holdsNoAddress(await everythingUnder(page.getByTestId('map-tooltip')))).toBe(true);
    expect(holdsNoAddress(await everythingUnder(list))).toBe(true);
    await page.mouse.move(5, 5);
  });
});

// =============================================================================
// 3. At 375px: no sideways scroll, a frame that fits, tooltips that stay on screen
// =============================================================================

test('at 375px the frame fits the card, the page does not scroll sideways, tooltips at the four edges stay on screen and the list is reachable by keyboard', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 375, height: 667 });
  const entries: readonly Entry[] = [
    [IP.US, 1],
    [IP.JP, 1],
    [IP.AU, 1],
    [IP.FI, 1],
    [IP.AR, 1],
    [IP.FR, 1],
  ];
  await gotoApp(page);
  await importExport(page, SYNTHETIC_ZIP_NAME, buildEntriesExport(entries));
  await ready(page);

  const map = loginMap(page);
  await map.scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);

  // The frame fits the card's inner width: it is not wider, and it is not a
  // fraction of it either. That width is 309px at 375px: the viewport less the
  // two 16px page paddings of the phone block (07-05, D-03) and the card's own
  // 16px padding and 1px border on each side. It was 293px under the 24px
  // desktop padding this spec was written against, so both bounds moved by the
  // 16px the page gave back (the lower bound is the old 280 plus those 16).
  const frame = (await page.getByTestId('login-map-frame').boundingBox())!;
  expect(frame.width).toBeLessThanOrEqual(311.5);
  expect(frame.width).toBeGreaterThan(296);
  const svgBox = (await map.boundingBox())!;
  expect(svgBox.width).toBeLessThanOrEqual(frame.width);

  // The four extremes among the countries with logins, by centroid.
  const present = expectedOf(entries).countries.map((c) => shapeOf(c.cc));
  const extremes = [
    present.reduce((a, b) => (b.cx < a.cx ? b : a)),
    present.reduce((a, b) => (b.cx > a.cx ? b : a)),
    present.reduce((a, b) => (b.cy < a.cy ? b : a)),
    present.reduce((a, b) => (b.cy > a.cy ? b : a)),
  ];
  expect(new Set(extremes.map((e) => e.iso)).size).toBeGreaterThanOrEqual(3);

  const tooltip = page.getByTestId('map-tooltip');
  const vh = 667;
  for (const [index, extreme] of extremes.entries()) {
    // The topmost country is checked just under the sticky nav, where there is
    // no room above, and the bottom-most at the foot of the viewport.
    await placeMap(page, index === 2 ? 80 : index === 3 ? vh - svgBox.height - 8 : 200);
    const at = await pointOver(page, extreme.iso);
    await page.mouse.move(at.x, at.y);
    await expect(tooltip, extreme.iso).toBeVisible();
    const box = (await tooltip.boundingBox())!;
    expect(box.x, `${extreme.iso} left`).toBeGreaterThanOrEqual(8 - 0.5);
    expect(box.y, `${extreme.iso} top`).toBeGreaterThanOrEqual(8 - 0.5);
    expect(box.x + box.width, `${extreme.iso} right`).toBeLessThanOrEqual(375 - 8 + 0.5);
    expect(box.y + box.height, `${extreme.iso} bottom`).toBeLessThanOrEqual(vh - 8 + 0.5);
    await page.mouse.move(2, 2);
    await expect(tooltip).toBeHidden();
  }

  // The ranked list is reachable by keyboard and never widens the page.
  const list = countryList(page);
  await list.locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(list).toHaveAttribute('open', '');
  await page.keyboard.press('Tab');
  await expect(list.locator('[role="region"]')).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});

// =============================================================================
// 4. The sentence's forms, the legend's two notes, the empty state, and a replace
// =============================================================================

test('the summary takes the one, all-logins and many forms, the legend its single-login note, and no country shows only the heading', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await gotoApp(page);
  const summary = page.getByTestId('login-map-summary');
  const map = loginMap(page);

  // One country holding SOME of the logins: the singular form, then the unknown
  // sentence; one shaded country, so the legend states a single step.
  const one: readonly Entry[] = [
    [IP.DE, 3],
    [IP.UNKNOWN, 2],
  ];
  await importExport(page, SYNTHETIC_ZIP_NAME, buildEntriesExport(one));
  await ready(page);
  await expect(summary).toHaveAttribute('data-form', 'one');
  await expect(summary).toHaveText(formatMapSummary(1, 'Germany', 3, 5, 1, 2, 'en-US'));
  await expect(summary).toContainText('Logins came from 1 country.');
  await expect(page.getByTestId('map-legend')).toContainText(formatMapLegendNote([3], 'en-US'));
  await expect(map.locator('[data-testid="login-country"][data-iso="DE"]')).toHaveAttribute(
    'data-level',
    '5',
  );

  // One country holding EVERY login: the all-logins form, naming its own base.
  const all: readonly Entry[] = [[IP.DE, 5]];
  await replaceExport(page, SYNTHETIC_ZIP_NAME, buildEntriesExport(all));
  await ready(page);
  await expect(summary).toHaveAttribute('data-form', 'all', { timeout: 30_000 });
  await expect(summary).toHaveText('All 5 logins with a known country came from Germany.');
  await expect(page.getByTestId('country-row')).toHaveCount(1);

  // A maximum of one: every shaded country is level 1 and the note says so. The
  // same country that was level 5 a moment ago is level 1 now.
  const single: readonly Entry[] = [
    [IP.DE, 1],
    [IP.FR, 1],
  ];
  await replaceExport(page, SYNTHETIC_ZIP_NAME, buildEntriesExport(single));
  await ready(page);
  await expect(summary).toHaveAttribute('data-form', 'many', { timeout: 30_000 });
  await expect(summary).toHaveText(formatMapSummary(2, 'France', 1, 2, 0, 0, 'en-US'));
  await expect(page.getByTestId('map-legend')).toContainText('Every shaded country has 1 login.');
  await expect(map.locator('[data-testid="login-country"]')).toHaveCount(2);
  for (const cc of ['DE', 'FR']) {
    await expect(map.locator(`[data-testid="login-country"][data-iso="${cc}"]`)).toHaveAttribute(
      'data-level',
      '1',
    );
  }
  await expect(page.getByTestId('map-legend').locator('.swatch')).toHaveCount(2);

  // Every address unknown: the heading and the sentence, and none of the rest,
  // while the unknown-country tile still carries its count.
  const none: readonly Entry[] = [[IP.UNKNOWN, 3]];
  await replaceExport(page, SYNTHETIC_ZIP_NAME, buildEntriesExport(none));
  await ready(page);
  await expect(page.getByRole('heading', { name: MAP_HEADING })).toBeVisible();
  await expect(summary).toHaveText(MAP_NO_COUNTRIES, { timeout: 30_000 });
  await expect(map).toHaveCount(0);
  await expect(page.getByTestId('login-map-frame')).toHaveCount(0);
  await expect(page.getByTestId('map-legend')).toHaveCount(0);
  await expect(page.getByTestId('map-attribution')).toHaveCount(0);
  await expect(page.getByTestId('map-not-drawn')).toHaveCount(0);
  await expect(countryList(page)).toHaveCount(0);
  await expect(page.getByTestId('login-tile-unknown')).toHaveText('1');
});
