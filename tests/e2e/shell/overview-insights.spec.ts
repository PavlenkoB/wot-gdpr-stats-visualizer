import '../_support/pin-locale';
import { expect, test, type Page } from '@playwright/test';
import { daysFromCivil } from '../../../src/lib/core/civil-date.ts';
import {
  formatDay,
  formatDays,
  formatHours,
  formatMonthYear,
} from '../../../src/lib/features/overview/overview-format.ts';
import {
  OVERVIEW_ATTRIBUTION_LINK_HREF,
  OVERVIEW_ATTRIBUTION_LINK_TEXT,
  OVERVIEW_ATTRIBUTION_NOTICE,
  OVERVIEW_ATTRIBUTION_TEXT,
  OVERVIEW_ERROR,
  OVERVIEW_HINT,
  OVERVIEW_LOADING,
  OVERVIEW_TILE_COPY,
  formatGames,
  formatPinnedAnnouncement,
  formatUnpinnedAnnouncement,
  formatProvenance,
  formatProvenanceRange,
} from '../../../src/lib/ui-copy.ts';
import {
  OV_CANARIES,
  OV_NICKNAME_A,
  OV_NICKNAME_B,
  buildOverviewInsightExport,
} from '../../fixtures/overview-fixtures.ts';
import { OV_EXPECTED, OV_HOSTILE_NAME } from '../../helpers/overview-oracle.ts';
import { HAND_ALL_SECONDS, HAND_ROWS } from '../../fixtures/playtime-hand-fixture.ts';
import {
  buildSessionsCsvFromRows,
  buildSessionsExportFromCsv,
} from '../../fixtures/sessions-fixtures.ts';
import {
  SYNTHETIC_ZIP_NAME,
  delayChannelQueries,
  detailPane,
  expectSelected,
  failChannelQuery,
  gotoApp,
  importExport,
  listRow,
  openSection,
  replaceExport,
} from '../_support/helpers.ts';

// =============================================================================
// Phase 13, plan 13-01 - the Overview personal-insights page: the first browser
// proof.
//
// WHAT THIS PROVES
//   The whole chain in a REAL browser: an import of a legacy Sessions.csv
//   lands on the Overview, the page asks the worker for the ONE `overview`
//   channel, a skeleton is drawn while that answer is pending, and the
//   Logged in hero then appears with its figure and its rule line.
//
//   It also proves three things about the page rather than about the number:
//   the page still carries exactly TWO live regions (the notice announcer and
//   the chart announcement region), the Overview adds no bold element of its
//   own, and the Phase 8 chips and cards are gone — the old page's own e2e
//   assertions in `master-detail-nav.spec.ts` fail until plan 13-13 retires
//   them, and this file is the new landing contract.
//
// THE LISTED BUDGET. This file holds EXACTLY SEVEN `test(...)` calls (the tracer
// of 13-01, the composition test and the interaction test of 13-12, the
// layout, modes and privacy-and-states tests of 13-14, and the table test of
// 13-15) and no `test.describe` loop. `playwright test --list` counted 268
// tests in 32 files before 13-14, 271 after it and 272 after 13-15. The CI
// limits are reconciled in 13-14 (see tests/unit/guards/ci-budget.test.ts); an
// eighth test here would need them re-checked, and raised together, never one.
//
// WHERE THE NUMBERS COME FROM. Every expected figure is a fixture literal
// (`HAND_ALL_SECONDS`) or a formatter imported from the source, never a
// reading of the page: an expectation read from the page would pass whatever
// the page said.
// =============================================================================

test('(tracer) the Overview asks one channel and shows Logged in with its rule', async ({
  page,
}) => {
  await gotoApp(page);
  await importExport(
    page,
    SYNTHETIC_ZIP_NAME,
    buildSessionsExportFromCsv(buildSessionsCsvFromRows(HAND_ROWS)),
  );

  const overview = page.getByTestId('overview');
  await expect(overview).toBeVisible();

  // The skeleton is drawn while the one answer is pending and the root says
  // so. The answer is fast, so the BUSY state is not asserted as a separate
  // step — it would be a race, not a proof. What is asserted is the settled
  // state: the tile is on screen and the root is no longer busy.
  const tile = page.getByTestId('ov-tile-logged');
  await expect(tile).toBeVisible();
  await expect(overview).toHaveAttribute('aria-busy', 'false');

  // The figure: the merged union of every session, in days.
  await expect(tile).toContainText('Logged in');
  await expect(tile).toContainText(formatDays(HAND_ALL_SECONDS, 'en-US'));
  await expect(tile).toContainText('days');

  // The rule: what was counted, and which games it counts (D-20). The first
  // day of the hand fixture is 2018-03-05, the earliest session start.
  await expect(tile).toContainText('across all games');
  await expect(tile).toContainText(`${formatHours(HAND_ALL_SECONDS, 'en-US')} h`);
  await expect(tile).toContainText('24-hour days');
  await expect(tile).toContainText(formatDay(daysFromCivil(2018, 3, 5), 'en-US'));

  // The page keeps exactly TWO live regions on the Overview: the notice
  // announcer and the chart announcement region. The Overview adds none.
  await expect(page.locator('[aria-live]')).toHaveCount(2);

  // No bold element inside the Overview: the figure's weight carries the
  // emphasis, not a `b`.
  await expect(overview.locator('b')).toHaveCount(0);

  // The Phase 8 chips and cards are gone.
  await expect(page.locator('[data-testid^="ov-card-"]')).toHaveCount(0);
  await expect(page.getByTestId('ov-chip-with-data')).toHaveCount(0);
});

// -----------------------------------------------------------------------------
// The tile ids a group holds, in DOM order: the direct children of its grid.
// -----------------------------------------------------------------------------
async function tileIds(page: Page, group: string): Promise<string[]> {
  return page
    .getByTestId('ov-grid-' + group)
    .locator(':scope > [data-tile-id]')
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-tile-id') ?? ''));
}

test('(composition) the oracle archive draws provenance, the life list, five groups, absent rows and Open links', async ({
  page,
}) => {
  await gotoApp(page);
  await importExport(page, SYNTHETIC_ZIP_NAME, buildOverviewInsightExport());

  const overview = page.getByTestId('overview');
  await expect(page.getByTestId('ov-tile-logged')).toBeVisible();
  await expect(overview).toHaveAttribute('aria-busy', 'false');

  // The provenance line: two account folders, both games, first to last month.
  const range = formatProvenanceRange(
    formatMonthYear(OV_EXPECTED.sessions.firstDay, 'en-US'),
    formatMonthYear(OV_EXPECTED.sessions.lastDay, 'en-US'),
  );
  await expect(page.getByTestId('ov-provenance')).toHaveText(
    formatProvenance(2, formatGames(['WOT', 'WOTB']), range),
  );
  await expect(page.getByTestId('ov-provenance')).toContainText('from 2 account folders');
  await expect(page.getByTestId('ov-hint')).toHaveText(OVERVIEW_HINT);

  // The read-only life list: both games, each with its logged days.
  await expect(page.getByTestId('ov-life-WOT')).toContainText('days');
  // An hour of Blitz sessions is a tenth of a day or less: it reads "under 0.1
  // days", never "0.0 days", which would state an absence the data does not hold.
  await expect(page.getByTestId('ov-life-WOTB')).toContainText('under 0.1 days');
  await expect(page.getByTestId('ov-life-WOTB')).not.toContainText('0.0 days');

  // Five groups in order.
  const groupIds = await page
    .locator('section[data-testid^="ov-group-"]')
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-testid')));
  expect(groupIds).toEqual([
    'ov-group-pinned',
    'ov-group-time',
    'ov-group-tanks',
    'ov-group-records',
    'ov-group-totals',
  ]);

  expect(await tileIds(page, 'pinned')).toEqual(['logged', 'tank']);
  expect(await tileIds(page, 'time')).toEqual(['hour', 'streak', 'sess', 'busy']);
  expect(await tileIds(page, 'tanks')).toEqual(['fleet', 'nat']);
  expect(await tileIds(page, 'records')).toEqual(['dmg', 'xp', 'kills', 'snip']);
  expect(await tileIds(page, 'totals')).toEqual(['cred', 'bat', 'ord']);

  // Favourite class: the invented tags resolve to no class, so it waits in the
  // Tanks group's one dashed row, naming the source.
  const tanksAbsent = page.getByTestId('ov-absent-tanks');
  await expect(tanksAbsent).toContainText('Not in this export:');
  await expect(tanksAbsent).toContainText('Favourite class');
  await expect(tanksAbsent).toContainText('vehicle statistics');
  await expect(page.getByTestId('ov-absent-totals')).toHaveCount(0);
  await expect(page.getByTestId('ov-absent-time')).toHaveCount(0);

  // The figures and their rules.
  await expect(page.getByTestId('ov-tile-logged')).toContainText('0.6');
  await expect(page.getByTestId('ov-tile-hour')).toContainText('21:00');
  await expect(page.getByTestId('ov-tile-streak')).toContainText('3');
  await expect(page.getByTestId('ov-tile-sess')).toContainText('4.2');
  await expect(page.getByTestId('ov-tile-busy')).toContainText('6');
  await expect(page.getByTestId('ov-tile-tank')).toContainText('SynthOne');
  await expect(page.getByTestId('ov-tile-tank')).toContainText('900 battles');

  // The top-five rows share ONE set of column tracks: every bar starts at the
  // same x, every figure ends at the same x. A grid per row sized the figure
  // column to its own text, so "1,240" pushed its bar left of "717"'s.
  const edges = await page.getByTestId('ov-tile-tank').evaluate((tile) => {
    const bars = Array.from(tile.querySelectorAll('svg.bar')).map(
      (bar) => bar.getBoundingClientRect().left,
    );
    const figures = Array.from(tile.querySelectorAll('.rows .num')).map(
      (num) => num.getBoundingClientRect().right,
    );
    return { bars, figures };
  });
  expect(edges.bars.length, 'the tank tile draws a bar per row').toBeGreaterThan(1);
  expect(
    Math.max(...edges.bars) - Math.min(...edges.bars),
    'bars share one left edge',
  ).toBeLessThan(0.5);
  expect(
    Math.max(...edges.figures) - Math.min(...edges.figures),
    'figures share one right edge',
  ).toBeLessThan(0.5);
  await expect(page.getByTestId('ov-tile-dmg')).toContainText('6,100');
  await expect(page.getByTestId('ov-tile-dmg')).toContainText('vehicle not recorded');
  await expect(page.getByTestId('ov-tile-dmg')).toContainText('best of 2 accounts');
  await expect(page.getByTestId('ov-tile-kills')).toContainText('8');
  await expect(page.getByTestId('ov-tile-snip')).toContainText('9');
  await expect(page.getByTestId('ov-tile-cred')).toContainText('12 million');
  await expect(page.getByTestId('ov-tile-bat')).toContainText('1,500');
  await expect(page.getByTestId('ov-tile-bat')).toContainText('52% wins');
  await expect(page.getByTestId('ov-tile-ord')).toContainText('3');

  // The legend belongs to a Time or Tanks group that holds a chart.
  await expect(page.getByTestId('ov-group-time').locator('.legend')).toContainText('low');
  await expect(page.getByTestId('ov-group-time').locator('.legend')).toContainText('peak');
  // Tanks carries the legend only while it holds a chart: with the default pins
  // the Most-played tank sits in Pinned and Favourite class is absent here, so
  // the legend is in Time alone (layoutGroups, UI-SPEC "Groups and Headings").
  for (const group of ['pinned', 'tanks', 'records', 'totals']) {
    await expect(page.getByTestId('ov-group-' + group).locator('.legend')).toHaveCount(0);
  }

  // The attribution footer: an ordinary outbound anchor.
  await expect(page.getByTestId('ov-attribution')).toBeVisible();
  const link = page.getByTestId('ov-attribution-link');
  await expect(link).toHaveAttribute('href', OVERVIEW_ATTRIBUTION_LINK_HREF);
  await expect(link).toHaveAttribute('rel', 'noreferrer noopener');
  await expect(link).toHaveAttribute('target', '_blank');

  // Expanding a tile shows how it is computed, what it reads, and an Open link.
  await page.getByTestId('ov-tile-button-streak').click();
  const detail = page.getByTestId('ov-tile-detail-streak');
  await expect(detail).toBeVisible();
  await expect(detail).toContainText('How it is computed');
  await expect(detail).toContainText('Reads');
  await expect(detail).toContainText('WOT_Game_Sessions.csv');
  const open = page.getByTestId('ov-tile-open-streak');
  await expect(open).toHaveText('Open Playtime →');

  // The page keeps two live regions on the Overview, with a tile open too.
  await expect(page.locator('[aria-live]')).toHaveCount(2);
  await expect(overview.locator('b')).toHaveCount(0);

  // The link selects the existing pane and moves focus into it.
  await open.click();
  await expectSelected(page, 'playtime');
  await expect(detailPane(page)).toBeFocused();

  // A second export without the record columns: only those tiles are absent
  // and the group's one row names the missing column.
  await replaceExport(
    page,
    'second-export.zip',
    buildOverviewInsightExport({ omit: ['record-columns'] }),
    'overview',
  );
  await expect(page.getByTestId('ov-tile-logged')).toBeVisible();
  await expect(page.getByTestId('ov-absent-records')).toContainText('DAMAGE_MAX');
  await expect(page.getByTestId('ov-absent-records')).toContainText('account statistics');
  await expect(page.getByTestId('ov-tile-dmg')).toHaveCount(0);
  await expect(page.getByTestId('ov-tile-bat')).toBeVisible();
  await expect(page.getByTestId('overview').locator('b')).toHaveCount(0);
  await expect(page.locator('[aria-live]')).toHaveCount(2);
});

test('(interaction) expand in place, roving tabindex, arrows, P to pin, Escape and focus by id', async ({
  page,
}) => {
  await gotoApp(page);
  await importExport(page, SYNTHETIC_ZIP_NAME, buildOverviewInsightExport());
  await expect(page.getByTestId('ov-tile-logged')).toBeVisible();

  const face = (id: string) => page.getByTestId('ov-tile-button-' + id);
  const storageLength = () => page.evaluate(() => localStorage.length);
  const hourLabel = OVERVIEW_TILE_COPY.hour.label;

  // Nothing is written until a pin or an unpin.
  expect(await storageLength()).toBe(0);

  // Exactly one face is tabbable and it is the first in DOM order.
  const stops = page.locator('[data-testid^="ov-tile-button-"][tabindex="0"]');
  await expect(stops).toHaveCount(1);
  await expect(stops).toHaveAttribute('data-tile-id', 'logged');

  // Tab from the hint reaches it.
  await page.getByTestId('ov-hint').click();
  await page.keyboard.press('Tab');
  await expect(face('logged')).toBeFocused();

  // Arrows move by DOM order and the tab stop follows the focus.
  await page.keyboard.press('ArrowRight');
  await expect(face('tank')).toBeFocused();
  await expect(stops).toHaveCount(1);
  await expect(stops).toHaveAttribute('data-tile-id', 'tank');
  await page.keyboard.press('End');
  await expect(face('ord')).toBeFocused();
  await page.keyboard.press('Home');
  await expect(face('logged')).toBeFocused();

  // ArrowDown from the first Time tile lands in the next row, by rectangles.
  await face('hour').focus();
  const hourBox = await page.getByTestId('ov-tile-hour').boundingBox();
  await page.keyboard.press('ArrowDown');
  const landed = await page.evaluate(() => document.activeElement?.getAttribute('data-tile-id'));
  expect(['streak', 'sess', 'busy']).toContain(landed);
  const landedBox = await page.getByTestId('ov-tile-' + landed).boundingBox();
  expect(landedBox!.y).toBeGreaterThanOrEqual(hourBox!.y + hourBox!.height - 1);

  // Ctrl+P is not P.
  await face('hour').focus();
  await page.keyboard.press('Control+p');
  await expect(page.getByTestId('ov-star-hour')).toHaveAttribute('aria-pressed', 'false');
  expect(await storageLength()).toBe(0);

  // Enter expands in place: the tile does not move or resize, and the element
  // survives (an expando set beforehand is still there).
  await face('streak').focus();
  const wrapper = page.getByTestId('ov-tile-streak');
  await wrapper.evaluate((node) => {
    (node as unknown as { probe: string }).probe = 'same node';
  });
  const before = await wrapper.boundingBox();
  await page.keyboard.press('Enter');
  await expect(face('streak')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByTestId('ov-tile-detail-streak')).toBeVisible();
  const after = await wrapper.boundingBox();
  expect(Math.abs(after!.x - before!.x)).toBeLessThanOrEqual(0.5);
  expect(Math.abs(after!.y - before!.y)).toBeLessThanOrEqual(0.5);
  expect(Math.abs(after!.width - before!.width)).toBeLessThanOrEqual(0.5);
  expect(await wrapper.evaluate((node) => (node as unknown as { probe: string }).probe)).toBe(
    'same node',
  );

  // Escape closes the open tile, keeps focus on it, and the pane does not also
  // send focus to the list.
  await page.keyboard.press('Escape');
  await expect(face('streak')).toHaveAttribute('aria-expanded', 'false');
  await expect(face('streak')).toBeFocused();
  await expect(listRow(page, 'playtime')).not.toBeFocused();
  await expect(listRow(page, 'overview')).not.toBeFocused();

  // Escape with nothing open falls through to the pane: focus goes to the list.
  await page.keyboard.press('Escape');
  await expect(listRow(page, 'overview')).toBeFocused();

  // P pins the focused tile; focus stays on it by id although the node moved.
  await face('hour').focus();
  await page.keyboard.press('p');
  await expect(page.getByTestId('ov-star-hour')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('chart-status')).toHaveText(formatPinnedAnnouncement(hourLabel, 3));
  expect(await tileIds(page, 'pinned')).toEqual(['logged', 'hour', 'tank']);
  expect(await tileIds(page, 'time')).toEqual(['streak', 'sess', 'busy']);
  await expect(face('hour')).toBeFocused();
  expect(await storageLength()).toBe(1);
  await expect(page.locator('[aria-live]')).toHaveCount(2);

  // P again unpins it, the tile returns to its group, focus stays.
  await page.keyboard.press('p');
  await expect(page.getByTestId('ov-star-hour')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByTestId('chart-status')).toHaveText(
    formatUnpinnedAnnouncement(hourLabel, 2),
  );
  expect(await tileIds(page, 'time')).toEqual(['hour', 'streak', 'sess', 'busy']);
  await expect(face('hour')).toBeFocused();

  // The star pins without expanding.
  await page.getByTestId('ov-star-streak').click();
  await expect(page.getByTestId('ov-star-streak')).toHaveAttribute('aria-pressed', 'true');
  await expect(face('streak')).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByTestId('ov-tile-detail-streak')).toHaveCount(0);
  expect(await tileIds(page, 'pinned')).toEqual(['logged', 'streak', 'tank']);

  // The pins survive a reload (the dataset is cached).
  await page.reload();
  await expect(page.getByTestId('ov-tile-logged')).toBeVisible();
  expect(await tileIds(page, 'pinned')).toEqual(['logged', 'streak', 'tank']);
  await expect(page.locator('[aria-live]')).toHaveCount(2);
});

// -----------------------------------------------------------------------------
// Plan 13-14: layout, modes, privacy and states, on the real worker.
// -----------------------------------------------------------------------------

/** One measurement of the page: the bento's width and every grid's geometry. */
interface GridMeasure {
  id: string;
  columns: number;
  columnGap: string;
  rowGap: string;
  alignItems: string;
  width: number;
  tiles: { id: string; left: number; top: number; right: number; bottom: number }[];
}

async function measureGrids(page: Page): Promise<{ width: number; grids: GridMeasure[] }> {
  return page.evaluate(() => {
    const bento = document.querySelector('[data-testid="ov-bento"]');
    const width = bento?.getBoundingClientRect().width ?? 0;
    const grids = [...document.querySelectorAll('[data-testid^="ov-grid-"]')].map((grid) => {
      const style = getComputedStyle(grid);
      const content = grid.getBoundingClientRect().width;
      return {
        id: (grid.getAttribute('data-testid') ?? '').replace('ov-grid-', ''),
        columns: style.gridTemplateColumns.split(' ').filter((track) => track !== '').length,
        columnGap: style.columnGap,
        rowGap: style.rowGap,
        alignItems: style.alignItems,
        width: content,
        tiles: [...grid.querySelectorAll(':scope > [data-tile-id]')].map((tile) => {
          const rect = tile.getBoundingClientRect();
          return {
            id: tile.getAttribute('data-tile-id') ?? '',
            left: rect.left,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
          };
        }),
      };
    });
    return { width, grids };
  });
}

/** The column count the Overview root's width asks for (D-15). */
function columnsFor(width: number): number {
  return width >= 880 ? 4 : width >= 480 ? 2 : 1;
}

test('(layout) columns follow the pane width, tiles never overlap and expanding moves nothing', async ({
  page,
}) => {
  await gotoApp(page);
  await importExport(page, SYNTHETIC_ZIP_NAME, buildOverviewInsightExport());
  await expect(page.getByTestId('ov-tile-logged')).toBeVisible();

  for (const viewport of [1440, 1100, 800, 375]) {
    await page.setViewportSize({ width: viewport, height: 900 });
    // A phone width may have returned the shell to its list screen.
    if (!(await page.getByTestId('overview').isVisible())) await openSection(page, 'overview');
    await expect(page.getByTestId('ov-tile-logged')).toBeVisible();

    // Wait for the grids to re-measure at the new width.
    await expect
      .poll(async () => {
        const measured = await measureGrids(page);
        return measured.grids.every((grid) => grid.columns === columnsFor(measured.width));
      })
      .toBe(true);

    const { width, grids } = await measureGrids(page);
    expect(grids.map((grid) => grid.id)).toEqual(['pinned', 'time', 'tanks', 'records', 'totals']);
    for (const grid of grids) {
      const label = `${grid.id} at viewport ${viewport} (root ${width}px)`;
      expect(grid.columns, label).toBe(columnsFor(width));
      expect(grid.columnGap, label).toBe('16px');
      expect(grid.rowGap, label).toBe('16px');

      // No two tiles overlap.
      for (let a = 0; a < grid.tiles.length; a += 1) {
        for (let b = a + 1; b < grid.tiles.length; b += 1) {
          const first = grid.tiles[a]!;
          const second = grid.tiles[b]!;
          const overlap =
            first.left < second.right - 0.5 &&
            second.left < first.right - 0.5 &&
            first.top < second.bottom - 0.5 &&
            second.top < first.bottom - 0.5;
          expect(overlap, `${label}: ${first.id} overlaps ${second.id}`).toBe(false);
        }
      }

      // DOM order is reading order: sorting by (top, left) changes nothing.
      const reading = [...grid.tiles]
        .sort((x, y) => (Math.abs(x.top - y.top) > 0.5 ? x.top - y.top : x.left - y.left))
        .map((tile) => tile.id);
      expect(reading, `${label}: reading order`).toEqual(grid.tiles.map((tile) => tile.id));
    }
  }

  // The worked example at the widest page: with the default pins the Time group
  // starts with a Signature hour tile as wide as all four columns.
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect.poll(async () => (await measureGrids(page)).width >= 880).toBe(true);
  const wide = await measureGrids(page);
  const time = wide.grids.find((grid) => grid.id === 'time')!;
  const hourTile = time.tiles.find((tile) => tile.id === 'hour')!;
  expect(Math.abs(hourTile.right - hourTile.left - time.width)).toBeLessThanOrEqual(0.5);

  // The four Records metrics read as one row: a label that wraps to two lines
  // ("Most damage, one battle") must not push its figure below its neighbours'.
  const recordTops = await page.evaluate(() =>
    ['dmg', 'xp', 'kills', 'snip'].map((id) => {
      const value = document.querySelector(`[data-testid="ov-tile-${id}"] .v`);
      return value === null ? null : Math.round(value.getBoundingClientRect().top * 10) / 10;
    }),
  );
  expect(
    recordTops.every((top) => top !== null),
    'all four Records metrics are drawn',
  ).toBe(true);
  expect(
    Math.max(...(recordTops as number[])) - Math.min(...(recordTops as number[])),
    'the Records figures share one top',
  ).toBeLessThan(0.5);

  // The peak of a bar chart is named right above its bar: the label's box spans
  // the horizontal centre of the tallest bar.
  const peaks = await page.evaluate(() =>
    ['logged', 'hour'].map((id) => {
      const tile = document.querySelector(`[data-testid="ov-tile-${id}"]`);
      const label = tile?.querySelector('.peak-text')?.getBoundingClientRect();
      const bars = Array.from(tile?.querySelectorAll('svg.plot rect.bar') ?? []).map((bar) =>
        bar.getBoundingClientRect(),
      );
      const tallest = bars.reduce((best, bar) => (bar.height > best.height ? bar : best), bars[0]!);
      return {
        id,
        label: label ? { left: label.left, right: label.right } : null,
        centre: tallest ? (tallest.left + tallest.right) / 2 : null,
      };
    }),
  );
  for (const peak of peaks) {
    expect(peak.label, `${peak.id} draws a peak label`).not.toBeNull();
    expect(peak.centre, `${peak.id} draws bars`).not.toBeNull();
    expect(
      peak.label!.left,
      `${peak.id}: the peak label starts left of its bar`,
    ).toBeLessThanOrEqual(peak.centre! + 0.5);
    expect(
      peak.label!.right,
      `${peak.id}: the peak label ends right of its bar`,
    ).toBeGreaterThanOrEqual(peak.centre! - 0.5);
  }

  // Expanding changes neither x, y nor width, and the grid aligns to the start.
  const wrapper = page.getByTestId('ov-tile-hour');
  const before = await wrapper.boundingBox();
  const heightsBefore = time.tiles
    .filter((tile) => tile.id !== 'hour')
    .map((tile) => tile.bottom - tile.top);
  await page.getByTestId('ov-tile-button-hour').click();
  await expect(page.getByTestId('ov-tile-button-hour')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByTestId('ov-tile-detail-hour')).toBeVisible();
  const after = await wrapper.boundingBox();
  expect(Math.abs(after!.x - before!.x)).toBeLessThanOrEqual(0.5);
  expect(Math.abs(after!.y - before!.y)).toBeLessThanOrEqual(0.5);
  expect(Math.abs(after!.width - before!.width)).toBeLessThanOrEqual(0.5);
  const opened = (await measureGrids(page)).grids.find((grid) => grid.id === 'time')!;
  expect(opened.alignItems).toBe('start');
  const heightsAfter = opened.tiles
    .filter((tile) => tile.id !== 'hour')
    .map((tile) => tile.bottom - tile.top);
  // `align-items: start` lets a sibling fall to its NATURAL height instead of
  // stretching to its row: none grows, and the tallest one is unchanged.
  heightsAfter.forEach((height, index) => {
    expect(height).toBeLessThanOrEqual(heightsBefore[index]! + 0.5);
  });
  expect(Math.abs(Math.max(...heightsAfter) - Math.max(...heightsBefore))).toBeLessThanOrEqual(0.5);
  await page.getByTestId('ov-tile-button-hour').click();
  await expect(page.getByTestId('ov-tile-button-hour')).toHaveAttribute('aria-expanded', 'false');

  // Under 375px: the star is a 44px target and the page does not scroll sideways.
  await page.setViewportSize({ width: 375, height: 800 });
  if (!(await page.getByTestId('overview').isVisible())) await openSection(page, 'overview');
  const star = await page.getByTestId('ov-star-logged').boundingBox();
  expect(star!.width).toBeGreaterThanOrEqual(44);
  expect(star!.height).toBeGreaterThanOrEqual(44);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test('(modes) reduced motion applies at once, the transition API is used otherwise, and forced colours keep dots and stars visible', async ({
  page,
}) => {
  // Count every call to the transition API, then call it through.
  await page.addInitScript(() => {
    const counter = window as unknown as { __vtCalls: number };
    counter.__vtCalls = 0;
    const original = document.startViewTransition;
    if (typeof original === 'function') {
      document.startViewTransition = function patched(this: Document, ...args: unknown[]) {
        counter.__vtCalls += 1;
        return (original as (...inner: unknown[]) => ViewTransition).apply(this, args);
      } as typeof document.startViewTransition;
    }
  });
  const calls = (): Promise<number> =>
    page.evaluate(() => (window as unknown as { __vtCalls: number }).__vtCalls);

  await gotoApp(page);
  await importExport(page, SYNTHETIC_ZIP_NAME, buildOverviewInsightExport());
  await expect(page.getByTestId('ov-tile-logged')).toBeVisible();

  // The normal path goes through the transition API.
  await page.getByTestId('ov-tile-button-hour').click();
  await expect(page.getByTestId('ov-tile-button-hour')).toHaveAttribute('aria-expanded', 'true');
  expect(await calls()).toBeGreaterThanOrEqual(1);

  // Reduced motion applies the state change at once and never calls the API.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const recorded = await calls();
  await page.getByTestId('ov-tile-button-streak').click();
  await expect(page.getByTestId('ov-tile-button-streak')).toHaveAttribute('aria-expanded', 'true', {
    timeout: 0,
  });
  expect(await calls()).toBe(recorded);
  await page.emulateMedia({ reducedMotion: 'no-preference' });

  // Forced colours: the dot, the legend swatch and the star keep an outline.
  await page.emulateMedia({ forcedColors: 'active' });
  const outlineWidth = (selector: string): Promise<number> =>
    page
      .locator(selector)
      .first()
      .evaluate((node) => parseFloat(getComputedStyle(node).outlineWidth));
  expect(await outlineWidth('[data-testid="ov-group-time"] .dot')).toBeGreaterThan(0);
  expect(await outlineWidth('[data-testid="ov-group-time"] .swatch')).toBeGreaterThan(0);
  expect(await outlineWidth('[data-testid="ov-star-logged"]')).toBeGreaterThan(0);
  await page.emulateMedia({ forcedColors: 'none' });
});

test('(privacy and states) planted values never reach the page, a pending answer shows the skeleton, a failed ask shows one banner and a re-open retries, and a hostile tank name is text', async ({
  browser,
  page,
}) => {
  // (i) The planted values never reach the document.
  await gotoApp(page);
  await importExport(page, SYNTHETIC_ZIP_NAME, buildOverviewInsightExport());
  await expect(page.getByTestId('ov-tile-logged')).toBeVisible();
  await expect(page.getByTestId('overview')).toHaveAttribute('aria-busy', 'false');
  const html = await page.content();
  for (const canary of OV_CANARIES) {
    expect(html.includes(canary), 'a planted value reached the page').toBe(false);
  }
  const overviewText = (await page.getByTestId('overview').textContent()) ?? '';
  expect(overviewText).not.toContain(OV_NICKNAME_A);
  expect(overviewText).not.toContain(OV_NICKNAME_B);

  // (ii) A pending answer: the skeleton frame, busy, the loading line.
  const slowContext = await browser.newContext();
  try {
    const slow = await slowContext.newPage();
    await delayChannelQueries(slow, 'overview', 1500);
    await gotoApp(slow);
    await slow.getByTestId('file-input').setInputFiles({
      name: SYNTHETIC_ZIP_NAME,
      mimeType: 'application/zip',
      buffer: Buffer.from(buildOverviewInsightExport()),
    });
    const root = slow.getByTestId('overview');
    await expect(root).toHaveAttribute('aria-busy', 'true');
    expect(await slow.getByTestId('ov-skeleton-tile').count()).toBeGreaterThan(0);
    // While loading, every skeleton grid announces busy to assistive technology.
    expect(await slow.locator('.groups [aria-busy="true"]').count()).toBeGreaterThan(0);
    await expect(slow.getByTestId('ov-provenance')).toHaveText(OVERVIEW_LOADING);
    await expect(slow.locator('[data-testid^="ov-tile-"]')).toHaveCount(0);
    await expect(slow.locator('[aria-live]')).toHaveCount(2);
    await expect(slow.getByTestId('ov-tile-logged')).toBeVisible({ timeout: 10_000 });
    await expect(slow.getByTestId('ov-skeleton-tile')).toHaveCount(0);
    await expect(root).toHaveAttribute('aria-busy', 'false');
  } finally {
    await slowContext.close();
  }

  // (iii) A failed first ask: one banner above a value-less frame, then a
  // re-open of the Overview asks again and succeeds.
  const failContext = await browser.newContext();
  try {
    const failing = await failContext.newPage();
    await failChannelQuery(failing, 'overview', 1);
    await gotoApp(failing);
    await importExport(failing, SYNTHETIC_ZIP_NAME, buildOverviewInsightExport());
    const root = failing.getByTestId('overview');
    await expect(root.getByTestId('failure-banner')).toHaveCount(1);
    await expect(root.getByTestId('failure-banner')).toHaveText(OVERVIEW_ERROR);
    expect(await failing.getByTestId('ov-skeleton-tile').count()).toBeGreaterThan(0);
    // The error state is not loading: no skeleton grid may keep announcing busy (IN-04).
    await expect(failing.locator('.groups [aria-busy="true"]')).toHaveCount(0);
    await expect(failing.locator('[data-testid^="ov-tile-"]')).toHaveCount(0);

    await openSection(failing, 'playtime');
    await openSection(failing, 'overview');
    await expect(failing.getByTestId('ov-tile-logged')).toBeVisible();
    await expect(failing.getByTestId('overview').getByTestId('failure-banner')).toHaveCount(0);
  } finally {
    await failContext.close();
  }

  // (iv) A tank name with markup in it is visible text and creates no element.
  const hostileContext = await browser.newContext();
  try {
    const hostile = await hostileContext.newPage();
    await gotoApp(hostile);
    await importExport(
      hostile,
      SYNTHETIC_ZIP_NAME,
      buildOverviewInsightExport({ tanks: 'hostile' }),
    );
    const tank = hostile.getByTestId('ov-tile-tank');
    await expect(tank).toContainText(OV_HOSTILE_NAME);
    await expect(hostile.getByTestId('overview').locator('b')).toHaveCount(0);
    expect(await tank.innerHTML()).not.toContain('<b>');
  } finally {
    await hostileContext.close();
  }
});

test('(table) real tanks resolve through the committed table: the class tile appears and the footer carries the approved notice', async ({
  page,
}) => {
  // Every request the page makes, from before the first navigation, so a
  // request to the footer link's host cannot slip in unseen.
  const requested: string[] = [];
  page.on('request', (request) => requested.push(request.url()));

  await gotoApp(page);
  // The `known` variant swaps the first three invented tags for tags a real
  // table carries, so any difference from the synthetic archive is resolution.
  await importExport(page, SYNTHETIC_ZIP_NAME, buildOverviewInsightExport({ tanks: 'known' }));

  const overview = page.getByTestId('overview');
  await expect(overview).toHaveAttribute('aria-busy', 'false');

  // The Favourite class tile exists only when a battle resolves a class, and it
  // states how much of the data it could classify (D-09).
  const cls = page.getByTestId('ov-tile-cls');
  await expect(cls).toBeVisible();
  await expect(cls).toContainText('Class known for');

  // The most-played tank resolved to its table name: the table spells it with a
  // space, the tag-derived fallback does not.
  const tank = page.getByTestId('ov-tile-tank');
  await expect(tank).toBeVisible();
  await expect(tank).toContainText('Type 64');

  // The footer: the approved notice as text, the approved link as an ordinary
  // anchor.
  const footer = page.getByTestId('ov-attribution');
  await expect(footer).toContainText(OVERVIEW_ATTRIBUTION_TEXT);
  await expect(footer).toContainText(OVERVIEW_ATTRIBUTION_NOTICE);
  const link = page.getByTestId('ov-attribution-link');
  await expect(link).toHaveText(OVERVIEW_ATTRIBUTION_LINK_TEXT);
  await expect(link).toHaveAttribute('href', OVERVIEW_ATTRIBUTION_LINK_HREF);
  await expect(link).toHaveAttribute('target', '_blank');
  expect(await link.getAttribute('rel')).toContain('noopener');

  // The link is a link and nothing more: before any click, no request went to
  // its host.
  const linkHost = new URL(OVERVIEW_ATTRIBUTION_LINK_HREF).host;
  const toLinkHost = requested.filter((url) => new URL(url).host === linkHost);
  expect(toLinkHost, 'the footer link must cause no request until it is clicked').toEqual([]);
});
