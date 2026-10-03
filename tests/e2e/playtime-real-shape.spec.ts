import './pin-locale';
import { expect, test } from '@playwright/test';
import {
  SYNTHETIC_ZIP_NAME,
  gotoApp,
  importExport,
  openActivity,
  playtimeBlock,
} from './helpers.ts';
import {
  REAL_SHAPE_ALL,
  REAL_SHAPE_IP,
  REAL_SHAPE_WOT,
  REAL_SHAPE_WOWS,
  buildRealShapeExport,
  buildTwoGameExport,
} from '../fixtures/playtime-real-shape-fixture.ts';
import {
  SPLIT_ALL_OPTION,
  formatSplitCaption,
  formatSplitOverlapNote,
} from '../../src/lib/ui-copy.ts';

// =============================================================================
// Phase 04, plans 04-14 and 04-15 — the REAL export shape, in a real browser
// (UAT G-04-1)
// =============================================================================
//
// TWO TESTS, TWO EXPORTS. The first (04-14) is the ONE-game shape, and it ends
// by asserting there is NO selector. The second (04-15, below) is the TWO-game
// shape, where the selector exists and every total, the pill, the calendar and
// the live region follow the chosen game. The first test's "no selector" claim
// is deliberate and load-bearing: a single game with rows is one distinct
// value, which is not a split, and the page says nothing about which game a
// lone file holds.
//
// WHAT THIS SPEC IS FOR
// UAT gap G-04-1: a real Wargaming export imports and then says "This export
// has no session file", because phase 4 was built against a synthetic fixture
// — one `Sessions.csv` with `SESSION_START` and ISO stamps with seconds — and
// the real export keeps playtime in `{WOT,WOTB,WOWS}_Game_Sessions.csv` under
// the header `STARTED_AT;FINISHED_AT;IP` with dotted day-first stamps. Every
// Phase 4 number was unreachable on the export the product exists for.
//
// A worker test could prove the aggregator reads such a file. Only a browser
// can prove the WHOLE chain does: the archive classifies through its wrapper
// folder, the three per-game files are found, the block reaches `data-state
// ready`, the tiles read the hand-derived numbers, and all three charts are
// populated from the same slice. This is the one test that would have caught
// the gap, so it is the one that has to exist.
//
// WHY A BROWSER SPEC AND NOT A UNIT TEST
// Vitest has no DOM. Every claim here is about what a user SEES: a state name
// on an element, three tiles reading numbers, 731 SVG cells, 168 more, twelve
// bars, and a whole page of serialized HTML that must not contain the login
// address. None of it exists until components render.
//
// WHY THESE NUMBERS ARE LITERALS
// Every expected value is imported from
// `tests/fixtures/playtime-real-shape-fixture.ts`, was derived BY HAND from
// the nine fixture rows, and is re-proved against the INDEPENDENT per-second
// oracle in `tests/unit/playtime-real-shape-fixture.test.ts`. Nothing here is
// read off the page and compared with itself: a spec that asserted the tiles
// equal each other would pass against a chart that is wrong in every cell.
//
// WHY IT IMPORTS NO OTHER SPEC
// Playwright refuses a spec that imports another spec, so every helper and
// every expected number arrives through a plain module.
//
// Decisions: D-01 (dates and hours as recorded, no zone), D-02 (excluded rows
// are counted), D-05 (duration bins), D-06 (the totals). T-04-01 (the IP is
// never read or rendered), T-04-28 (the day-first stamp), T-04-31 (the xlsx
// duplicate and the sidecar are not session files).
// =============================================================================

/** The WOT-rows export, as the app actually reads it. */
const REAL_SHAPE_EXPORT = buildRealShapeExport();

test('real shape: a per-game export imports to a populated Playtime block', async ({ page }) => {
  await gotoApp(page);
  await importExport(page, SYNTHETIC_ZIP_NAME, REAL_SHAPE_EXPORT);

  // The section is `ready` and the block reaches `ready`. Two different claims:
  // the card can be ready while the block is still loading the aggregate, and
  // the RED run this spec was written from shows exactly that split — the card
  // ready and the block stuck on `no-session-file`.
  await expect(openActivity(page)).toHaveAttribute('data-status', 'ready');
  await expect(playtimeBlock(page)).toHaveAttribute('data-state', 'ready');

  // WOT alone: 12,600 merged seconds over 5 usable sessions on 3 active days.
  // 12,600 / 3,600 = 3.5 exactly, which is why this tile reads "3.5 hours" and
  // not "<4 hours".
  await expect(page.getByTestId('playtime-total-hours')).toHaveText(REAL_SHAPE_WOT.hoursText);
  await expect(page.getByTestId('playtime-total-sessions')).toHaveText(
    String(REAL_SHAPE_WOT.sessions),
  );
  await expect(page.getByTestId('playtime-active-days')).toHaveText(
    String(REAL_SHAPE_WOT.activeDays),
  );

  // D-02: the two rows the aggregator could not use are COUNTED, not dropped,
  // and the pill says so. A build that silently skipped them would render the
  // same three tiles and an empty block's worth of silence.
  await expect(page.getByTestId('playtime-excluded')).toContainText('2 session rows excluded');

  // No selector at all. The real header carries no server and no platform
  // column, so there is nothing to split on and D-03's rule is that nothing on
  // the page says a split is missing. Plan 04-15 adds the per-game selector and
  // extends this file.
  await expect(page.getByTestId('playtime-selector')).toHaveCount(0);

  // 2019 and 2020 are both active, so every one of their 365 + 366 days is
  // drawn whether or not it held a session.
  const cells = page.getByTestId('calendar-cell');
  await expect(cells).toHaveCount(REAL_SHAPE_WOT.calendarCells);

  // The two days that carry seconds, read off the cells' own attributes. The
  // 13th took the two overlapping WOT rows for 2 hours over 2 sessions; the
  // Monday took a zero-length session and a half hour, over 2 sessions.
  //
  // This is the day-first claim in one assertion pair: a month-first reading
  // would put these rows on 11 February and 3 November, and a swapped
  // day/month field would have excluded both March rows outright.
  const march13 = page.locator('[data-testid="calendar-cell"][data-date="2019-03-13"]');
  await expect(march13).toHaveAttribute('data-hours', '2');
  await expect(march13).toHaveAttribute('data-sessions', '2');
  const monday = page.locator('[data-testid="calendar-cell"][data-date="2020-11-02"]');
  await expect(monday).toHaveAttribute('data-hours', '0.5');
  await expect(monday).toHaveAttribute('data-sessions', '2');

  // All 168 cells are present and their seconds sum to the tile. The sum is the
  // load-bearing half: a grid that drew only the non-zero cells would look
  // right, and one that credited a session to its start hour rather than the
  // hours it occupied would report the same total with the wrong cells.
  const hourSeconds = await page
    .getByTestId('hour-cell')
    .evaluateAll((nodes) => nodes.map((node) => Number(node.getAttribute('data-seconds') ?? 0)));
  expect(hourSeconds).toHaveLength(168);
  expect(hourSeconds.reduce((total, value) => total + value, 0)).toBe(REAL_SHAPE_WOT.seconds);

  // Cell 10 is Monday 10:00, the only source of the half-hour Monday session.
  await expect(page.locator('[data-testid="hour-cell"][data-index="10"]')).toHaveAttribute(
    'data-seconds',
    '1800',
  );

  // The bins come from the RAW session lengths, so the two one-hour-plus
  // lengths and the one-hour length share bin 7 while the overlapping row and
  // the zero-length row are counted in their own.
  const binCounts = await page
    .getByTestId('duration-bin')
    .evaluateAll((nodes) => nodes.map((node) => Number(node.getAttribute('data-count') ?? 0)));
  expect(binCounts).toHaveLength(12);
  expect(REAL_SHAPE_WOT.bins).toEqual(binCounts);
  expect(binCounts[0]).toBe(1);
  expect(binCounts[6]).toBe(1);
  expect(binCounts[7]).toBe(3);

  // T-04-01, the whole page. The address is written in the IP column of every
  // row of the file, so if anything read it into the aggregate, the store, or
  // the DOM it would be HERE — in a privacy tool, on screen, in a screenshot.
  const html = await page.locator('html').innerHTML();
  expect(html).not.toContain(REAL_SHAPE_IP);
});

// -----------------------------------------------------------------------------
// 04-15: the Game selector, on the same real shape with rows in two files
// -----------------------------------------------------------------------------
//
// WHY THIS IS A SECOND TEST AND NOT AN EXTENSION OF THE FIRST
// Plan 04-14's tracer above proves the ONE-game shape, and its last assertion
// is `playtime-selector` count 0. That assertion is correct for that export and
// must STAY: a single game with rows is one distinct value, which is not a
// split, and no single-value state was added. Changing what that test imports
// would quietly delete the guarantee that a lone game file says nothing.
//
// So the two-game export gets its own import. It is the smallest shape on which
// the selector exists at all, and the only way to see whether choosing a game
// moves the tiles, the pill, the calendar AND the live region together.
//
// EVERY NUMBER IS A FIXTURE KEY. Nothing is read back off the page and compared
// with itself, and the option ORDER is asserted before any option is chosen —
// a spec that assumed the alphabetical order would select WOWS when it meant
// WOT and then assert the wrong game's numbers, which still looks like a
// passing test.

test('two games: the Game selector splits every total and the login IP is nowhere on the page', async ({
  page,
}) => {
  await gotoApp(page);
  await importExport(page, SYNTHETIC_ZIP_NAME, buildTwoGameExport());

  await expect(openActivity(page)).toHaveAttribute('data-status', 'ready');
  await expect(playtimeBlock(page)).toHaveAttribute('data-state', 'ready');

  // The selector EXISTS, which is the whole point: before 04-15 the worker
  // produced the GAME column and the block rendered nothing for a name it could
  // not label, so a two-game export showed All and said nothing about it.
  const selector = page.getByTestId('playtime-selector');
  await expect(selector).toBeVisible();
  // D-03: the label is the column's true name, so the control never claims a
  // game the export did not name.
  await expect(selector).toHaveAccessibleName('Game');
  // All, then one option per game in the worker's order: merged seconds
  // DESCENDING. WOT holds 12,600 s and WOWS 6,600 s, so WOT is option 0 and
  // the All option's value is the literal `all`, never an index.
  await expect(selector.locator('option')).toHaveText([SPLIT_ALL_OPTION, 'WOT', 'WOWS']);

  // The split table's caption and its overlap note are built from the one label
  // table, so they read "game" here — and the note exists because the two game
  // totals (19,200 s) genuinely add to MORE than All (17,400 s).
  await expect(page.locator('[data-testid="playtime-split-table"] caption')).toHaveText(
    formatSplitCaption('GAME'),
  );
  await expect(page.getByText(formatSplitOverlapNote('GAME'))).toBeVisible();

  // All: 17,400 s over 7 sessions on 4 active days, both excluded rows, and a
  // calendar spanning 2019-2021.
  await expect(page.getByTestId('playtime-total-hours')).toHaveText(REAL_SHAPE_ALL.hoursText);
  await expect(page.getByTestId('playtime-total-sessions')).toHaveText(
    String(REAL_SHAPE_ALL.sessions),
  );
  await expect(page.getByTestId('playtime-active-days')).toHaveText(
    String(REAL_SHAPE_ALL.activeDays),
  );
  await expect(page.getByTestId('playtime-excluded')).toContainText('2 session rows excluded');
  await expect(page.getByTestId('calendar-cell')).toHaveCount(REAL_SHAPE_ALL.calendarCells);

  // WOT: option 0. 12,600 s over 5 sessions on 3 active days, its own two
  // excluded rows, and 2019-2020 only — 731 cells, not All's 1,096, which is
  // what proves the calendar follows the selection rather than the dataset.
  await selector.selectOption('0');
  await expect(playtimeBlock(page)).toHaveAttribute('data-state', 'ready');
  await expect(page.getByTestId('playtime-total-hours')).toHaveText(REAL_SHAPE_WOT.hoursText);
  await expect(page.getByTestId('playtime-total-sessions')).toHaveText(
    String(REAL_SHAPE_WOT.sessions),
  );
  await expect(page.getByTestId('playtime-active-days')).toHaveText(
    String(REAL_SHAPE_WOT.activeDays),
  );
  // The live region is the only feedback a screen-reader user gets that the
  // numbers above it changed, so it must name the chosen game.
  await expect(page.getByTestId('playtime-status')).toHaveText(REAL_SHAPE_WOT.announcement);
  await expect(page.getByTestId('playtime-excluded')).toBeVisible();
  await expect(page.getByTestId('calendar-cell')).toHaveCount(REAL_SHAPE_WOT.calendarCells);

  // WOWS: option 1. 6,600 s over 2 sessions on 2 active days, and 2019 + 2021
  // with all of 2020 collapsed into the empty run between them — 730 cells.
  // WOWS has NO excluded row of its own, so the pill must be GONE rather than
  // reading "0 session rows excluded", which is why the copy returns '' at zero.
  await selector.selectOption('1');
  await expect(playtimeBlock(page)).toHaveAttribute('data-state', 'ready');
  await expect(page.getByTestId('playtime-total-hours')).toHaveText(REAL_SHAPE_WOWS.hoursText);
  await expect(page.getByTestId('playtime-total-sessions')).toHaveText(
    String(REAL_SHAPE_WOWS.sessions),
  );
  await expect(page.getByTestId('playtime-active-days')).toHaveText(
    String(REAL_SHAPE_WOWS.activeDays),
  );
  await expect(page.getByTestId('playtime-status')).toHaveText(REAL_SHAPE_WOWS.announcement);
  await expect(page.getByTestId('playtime-excluded')).toHaveCount(0);
  await expect(page.getByTestId('calendar-cell')).toHaveCount(REAL_SHAPE_WOWS.calendarCells);
  // The Sunday two years after the rest, which only WOWS ever played on.
  await expect(
    page.locator('[data-testid="calendar-cell"][data-date="2021-06-20"]'),
  ).toHaveAttribute('data-sessions', '1');

  // All restores every tile. Selected BY LABEL, because the All option's value
  // is the literal `all` and `'0'` is the first GAME — never All.
  await selector.selectOption({ label: SPLIT_ALL_OPTION });
  await expect(page.getByTestId('playtime-total-hours')).toHaveText(REAL_SHAPE_ALL.hoursText);
  await expect(page.getByTestId('playtime-total-sessions')).toHaveText(
    String(REAL_SHAPE_ALL.sessions),
  );
  await expect(page.getByTestId('playtime-active-days')).toHaveText(
    String(REAL_SHAPE_ALL.activeDays),
  );
  await expect(page.getByTestId('calendar-cell')).toHaveCount(REAL_SHAPE_ALL.calendarCells);

  // T-04-01 on the NEW path, read once with a GAME selected. This is the
  // integration point the new split introduces: the game comes from a file
  // NAME, and the address is in the DATA of every row including the excluded
  // ones, so if the new selector path ever read or rendered a cell it would
  // show up here and nowhere else.
  await selector.selectOption('0');
  await expect(page.getByTestId('playtime-status')).toHaveText(REAL_SHAPE_WOT.announcement);
  const htmlWithGameSelected = await page.locator('html').innerHTML();
  expect(htmlWithGameSelected).not.toContain(REAL_SHAPE_IP);
});
