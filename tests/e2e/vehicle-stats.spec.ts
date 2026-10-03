import './pin-locale';
import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
} from '@playwright/test';
import { gotoApp, importExport, playerStatsBlock, replaceExport, startOver } from './helpers.ts';
import { buildCustomExport, buildSampleExport } from '../fixtures/export-fixtures.ts';
import {
  PLAYER_STATS_EXPECTED,
  PLAYER_STATS_SAMPLE_FILES,
  STATS_NAME_CANARY,
  VEHICLE_SCALE_5K_SPEC,
  WOT_MAIN_HEADER,
  generateVehicleMainCsv,
  renderStatsCsv,
  vehicleScaleExpected,
} from '../fixtures/player-stats-fixtures.ts';
import {
  BATTLE_TYPE_ALL_OPTION,
  BATTLE_TYPE_CONTROL_LABEL,
  BATTLE_TYPE_NOTE_TANKS,
  BATTLE_TYPE_NOTE_WARSHIPS,
  BATTLE_TYPE_SUMMARY_CAPTION,
  BATTLE_TYPE_SUMMARY_DISCLOSURE,
  BATTLE_TYPE_SUMMARY_HEADERS,
  BATTLE_TYPE_SUMMARY_HEADING,
  BATTLE_TYPE_SUMMARY_NOTE_WARSHIPS,
  COLUMN_PICKER_LEGEND,
  COLUMN_PICKER_SUMMARY,
  HEADER_LIFETIME_BATTLES_LABEL,
  HEADER_PREMIUM_EXPIRES_LABEL,
  VALUE_DASH,
  VALUE_NOT_AVAILABLE,
  VALUE_NOT_DEFINED,
  VALUE_NOT_IN_EXPORT,
  VALUE_NO_BATTLES_HIDDEN,
  VALUE_PER_BATTLE_TYPE,
  VEHICLE_COLUMN_LABELS,
  VEHICLE_FIND_HINT,
  VEHICLE_NO_MATCH,
  VEHICLE_SCROLL_HINT,
  VEHICLE_TABLE_TITLE,
  VEHICLE_TITLE_LABELS,
  WARSHIPS_ALL_NOTE,
  formatBattleTypeLabel,
  formatNumber,
  formatTitleNoRows,
  formatTitleNotInExport,
  formatTitleOption,
  formatVehicleAnnouncement,
  formatVehicleCount,
  formatVehicleRegionName,
  formatVehicleSearchCount,
  formatWarplanes20Note,
} from '../../src/lib/ui-copy.ts';

// =============================================================================
// Phase 05, plan 05-12 — the Vehicle statistics BLOCK, in a real browser
// =============================================================================
//
// WHY A BROWSER SPEC AND NOT A UNIT TEST
// `tests/unit/vehicle-state.test.ts` already proves which state is on screen
// and which outcome may be shown; `tests/unit/vehicle-model.test.ts` proves the
// order, the filter, the count and the window. What neither can reach is the
// wiring between them: that a click on a header button actually re-orders the
// drawn rows, that the scroller really does return to the top, that the
// announcement really is written into the live region, and that the table's
// geometry survives at 375px. Vitest has no DOM, so the instrument has to be a
// browser.
//
// WHY THE EXPECTED STRINGS ARE COMPUTED IN NODE
// From the 05-01 hand fixture and the same `ui-copy` formatter the component
// uses, and never by reading a value out of the page. A spec that scraped the
// count line and compared it with itself would pass against a block that
// renders a fixed string. `pin-locale` is imported for the same reason
// `finance.spec.ts` does: Node's number grouping must match the browser's.
//
// THE TEST BUDGET
// CI runs one Playwright worker and every import costs a full unzip, parse and
// ingest. Every test below is READ-ONLY with respect to the dataset — a sort, a
// search and a title change are all in-page state — so they share ONE import
// through the serial describe rather than paying for it per test. A test that
// needs a DIFFERENT export gets its own small file, because its cost is the
// export and not the test.
// =============================================================================

/** The hand fixture's WoT answer key: the default order of all six rows. */
const WOT_ORDER = PLAYER_STATS_EXPECTED.wotHandDerived.defaultOrderIds;

/**
 * The worker's title id beside the answer key's name for the same title.
 *
 * They are two vocabularies, and the mapping is written out rather than
 * derived: `PLAYER_STATS_EXPECTED.titles` names its keys after the GAMES
 * (blitz, warships, warplanes) because that is how the fixture's comments
 * read, while `VEHICLE_TITLES` — and therefore every `<option value>`, the
 * `aria-label` and the `data-` attributes — uses the file-name slugs
 * (wotb, wows, wowp). A computed mapping would be a second place the two
 * could drift, and a wrong pair would assert one game's row count against
 * another game's table.
 */
type TitleId = 'wot' | 'wotb' | 'wows' | 'wowp';
type AnswerKey = keyof typeof PLAYER_STATS_EXPECTED.titles;

const TITLE_ANSWER_KEYS: readonly (readonly [TitleId, AnswerKey])[] = [
  ['wot', 'wot'],
  ['wotb', 'blitz'],
  ['wows', 'warships'],
  ['wowp', 'warplanes'],
];

/**
 * The battle count per id, hand-read from the six `WOT_MAIN_ROWS` in the
 * 05-01 fixture: 100, 40, 12, 7, 3 and the zero-battle `ussr:R04_T-34`.
 *
 * A map rather than a parse, because `id.split(':').pop()` would be a guess
 * about the file's own format, and the whole point of the assertion is that
 * the ROWS on screen carry the counts the export wrote.
 *
 * Built with `Object.fromEntries` rather than as an object literal, and that
 * is load-bearing for the same reason it is in the fixture: one of the six ids
 * IS the string `__proto__`, and `{'__proto__': 3}` in a literal does not
 * create a property of that name — it assigns the prototype, and a primitive
 * there is silently ignored. The key would VANISH and the lookup would return
 * `Object.prototype`, so the assertion would compare the string
 * `"[object Object]"` with `"3"` and fail for a reason that has nothing to do
 * with the table. `Object.fromEntries` defines own data properties, so the
 * hostile id survives as an ordinary key.
 */
const WOT_BATTLES: Readonly<Record<string, number>> = Object.fromEntries([
  ['china:Ch24_Type64', 100],
  ['usa:A12_T29', 40],
  ['china:Ch99_<b>bold_markup', 12],
  ['germany:G32_PzV_PzIV', 7],
  ['__proto__', 3],
  ['ussr:R04_T-34', 0],
]);

/** The count line the sample's WoT view reads (6 vehicles, 1 with no battles). */
const WOT_COUNT = formatVehicleCount(
  PLAYER_STATS_EXPECTED.titles.wot.vehicleRows,
  PLAYER_STATS_EXPECTED.titles.wot.zeroBattleCount,
);

/** The scroller's accessible name for the sample's WoT All-battles view. */
const WOT_REGION = formatVehicleRegionName('wot', null);

/**
 * An account file reduced to its header line and nothing else.
 *
 * Derived from the fixture's own bytes rather than a hand-typed header, so the
 * two cannot drift: `renderStatsCsv` writes `\r`-terminated lines, and the
 * first one is the header the export actually declares. This is the shape the
 * stored file-presence fact exists for (05-07) — a file that IS present and
 * holds no data row, which a header-keyed read and a file-presence read have
 * to be able to tell apart.
 */
function headerOnly(name: string): string {
  return PLAYER_STATS_SAMPLE_FILES[name]!.split('\r')[0]!;
}

/**
 * The three account files' premium-expiry cells, as the fixture writes them.
 *
 * Hand-read constants rather than a parse of the fixture, for the same reason
 * `WOT_BATTLES` above is: D-13 says the expiry is shown EXACTLY as written, so
 * the assertion has to be a literal string and not a reformatted date. If the
 * fixture's value changes, this constant has to change with it — which is the
 * point, since a silent reformat is the failure the test exists for.
 *
 *   WOT_ACCOUNT_ROWS   `PREMIUM_EXPIRES_AT` = the Unix epoch (an artefact)
 *   WOWS_ACCOUNT_ROWS  `PREMIUM_EXPIRY_TIME` = a real fabricated expiry
 *   WOWP_19_ACCOUNT    `PREMIUM_EXPIRY_TIME` = a real fabricated expiry
 *   WOTB_ACCOUNT_ROWS  `PREMIUM_EXPIRY_TIME` = `N/A`, which the header renders
 *                      as `not available` and the test below asserts through
 *                      `VALUE_NOT_AVAILABLE` rather than as a literal.
 */
const WOT_PREMIUM_EXPIRY = '1970-01-01 00:00:00';
const WOWS_PREMIUM_EXPIRY = '2021-12-31 00:00:00';
const WOWP_PREMIUM_EXPIRY = '2021-01-01 00:00:00';

/**
 * `WOT_Battle_Types_Statistics.csv`'s five rows, in the file's own order.
 *
 * `['TYPE', 'BATTLES_COUNT', 'WINS_COUNT', 'DAMAGE_DEALT']` and the rows are
 * 1/80/44/96000, 2/10/5/9000, 10/8/4/7200, 11/4/2/3000 and 13/4/1/2800. The
 * 4/4 tie between codes 11 and 13 is deliberate in the fixture: it is what
 * forces the summary's tie-break (code ascending) to be a rule rather than a
 * coincidence, so the summary assertions check the ORDER as well as the cells.
 */
const WOT_BATTLE_TYPES: readonly { battles: number; wins: number; damage: number }[] = [
  { battles: 80, wins: 44, damage: 96_000 },
  { battles: 10, wins: 5, damage: 9_000 },
  { battles: 8, wins: 4, damage: 7_200 },
  { battles: 4, wins: 2, damage: 3_000 },
  { battles: 4, wins: 1, damage: 2_800 },
];

/** Wait until the block has its answer and the table is drawn. */
async function waitForTable(page: Page): Promise<void> {
  await expect(playerStatsBlock(page)).toHaveAttribute('data-state', /ready|updating|error/, {
    timeout: 30_000,
  });
  await expect(playerStatsBlock(page)).toHaveAttribute('data-title-state', 'ready', {
    timeout: 30_000,
  });
}

/**
 * A cell's VISIBLE text, with the visually-hidden companion removed.
 *
 * `toHaveText` reads `textContent`, which includes a `.sr-only` span — and a
 * dash needs one (`—` alone tells a screen-reader user that nothing is there
 * and not why). So the two halves of such a cell are asserted separately: this
 * for what a sighted reader sees, and `locator('.sr-only')` for the words
 * beside it. Reading the difference in the page rather than in the test is what
 * keeps the assertion about the rendering and not about the formatter.
 */
async function visibleText(cell: Locator): Promise<string> {
  return cell.evaluate((element) => {
    const hidden = element.querySelector('.sr-only');
    return (element.textContent ?? '').replace(hidden?.textContent ?? '', '').trim();
  });
}

/**
 * Open the column picker, if it is not open already.
 *
 * The picker is a CLOSED disclosure — unlike the battle-type summary, which the
 * UI-SPEC says is `open` — because a picker is a control the reader goes to
 * rather than reference they came to read. So a spec that ticks a box has to
 * open it first, exactly as a reader would, and this is the click that does it.
 */
async function openColumnPicker(picker: Locator): Promise<void> {
  if ((await picker.evaluate((el) => (el as HTMLDetailsElement).open)) === false) {
    await picker.locator('summary').click();
  }
}

/**
 * Every VISIBLE text node under `root` whose parent computes to a font size
 * below `floorPx`, described well enough to name the element in a failure.
 *
 * Why a walk rather than a list of selectors: the floor is a property of the
 * rendered dashboard, not of the components this phase wrote. Any of the
 * twenty-odd components can declare a 12px caption, and the assertion that
 * catches it has to see whichever one did without being told the name in
 * advance. The source scan in `tests/unit/phase5-layout-guards.test.ts` is the
 * half that catches a declaration the browser never applies.
 *
 * The three exclusions are each a class of text with no visible size:
 *   - a parent with `display: none` or `visibility: hidden` is not rendered
 *     at all, so its computed size is a declaration rather than an appearance;
 *   - a parent boxed at 1px or smaller in BOTH dimensions is one of the
 *     project's visually hidden helpers or the nav's zero-size accessibility
 *     run — in the accessibility tree, not on the screen (03-05);
 *   - a node whose text is blank after trimming is whitespace between two
 *     elements, which has no size a reader could judge.
 */
async function textUnderFloor(root: Locator, floorPx: number): Promise<string[]> {
  return root.evaluate((scope, floor) => {
    const offenders: string[] = [];
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      const text = (node.textContent ?? '').trim();
      const parent = node.parentElement;
      if (parent === null || text === '') continue;
      const style = getComputedStyle(parent);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      const box = parent.getBoundingClientRect();
      if (box.width <= 1 && box.height <= 1) continue;
      const size = Number.parseFloat(style.fontSize);
      if (size >= floor) continue;
      const classes =
        typeof parent.className === 'string' && parent.className.trim() !== ''
          ? `.${parent.className.trim().split(/\s+/).join('.')}`
          : '';
      offenders.push(
        `${parent.tagName.toLowerCase()}${classes} at ${size}px: "${text.slice(0, 40)}"`,
      );
    }
    return offenders;
  }, floorPx);
}

test.describe.configure({ mode: 'serial' });

test.describe('the Vehicle statistics block (05-12)', () => {
  // ONE import, shared by every test in this describe. Playwright builds the
  // `page` fixture per TEST, so a shared page has to be made by hand — which
  // is what `beforeAll` below does. The describe is serial because the tests
  // share that page: each still sets up its own controls, and the last one
  // leaves WoT on the default sort so the file's final state is the first
  // test's.
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }: { browser: Browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    await gotoApp(page);
    await importExport(page, 'sample.zip', buildSampleExport());
    await waitForTable(page);
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test('(tracer) the WoT view lists six vehicles in battle order with the nation tag', async () => {
    const block = playerStatsBlock(page);
    await expect(block).toHaveAttribute('data-state', 'ready');
    await expect(block).toHaveAttribute('data-title-state', 'ready');

    // D-05: the Game control, with the applied title selected. The worker
    // picks the first title with rows, which is WoT here, and the sample's
    // other three titles all have rows so no option carries a suffix.
    const select = block.getByTestId('player-stats-title-selector');
    await expect(select).toHaveValue('wot');
    await expect(select.locator('option')).toHaveCount(4);
    for (const title of ['wot', 'wotb', 'wows', 'wowp'] as const) {
      await expect(select.locator(`option[value="${title}"]`)).toHaveText(
        formatTitleOption(title, 'ready'),
      );
    }
    // And never disabled: a disabled option cannot be read in the content
    // area, so the reason a title has no table must live in the option text.
    await expect(select.locator('option[disabled]')).toHaveCount(0);

    // The h4 title, the count line and both hints.
    await expect(block.getByRole('heading', { name: VEHICLE_TABLE_TITLE })).toBeVisible();
    await expect(block.getByTestId('vehicle-count')).toHaveText(WOT_COUNT);
    await expect(block).toContainText(VEHICLE_SCROLL_HINT);
    await expect(block).toContainText(VEHICLE_FIND_HINT);

    // The scroller: a focusable region, named with its title and scope, and
    // the table repeats that name in a hidden caption.
    const scroller = block.getByTestId('vehicle-scroller');
    await expect(scroller).toHaveAttribute('role', 'region');
    await expect(scroller).toHaveAttribute('tabindex', '0');
    await expect(scroller).toHaveAccessibleName(WOT_REGION);
    const table = block.getByTestId('vehicle-table');
    await expect(table.locator('caption')).toHaveText(WOT_REGION);

    // D-12's default order, over ALL SIX rows including the zero-battle one.
    // `defaultOrderIds` is the hand-derived answer key; the assertion reads
    // the drawn rows rather than any model, so it is the ORDER on screen that
    // is being checked.
    const rows = table.getByTestId('vehicle-row');
    await expect(rows).toHaveCount(PLAYER_STATS_EXPECTED.titles.wot.vehicleRows);
    for (const [index, id] of WOT_ORDER.entries()) {
      const row = rows.nth(index);
      await expect(row).toHaveAttribute('data-battles', String(WOT_BATTLES[id] ?? 0));
      // The nation is a SEPARATE muted span, and the id is the text after the
      // first colon (D-11). A name with no colon has no tag at all.
      const nation = id.includes(':') ? id.slice(0, id.indexOf(':')) : null;
      if (nation === null) {
        await expect(row.getByTestId('vehicle-nation-tag')).toHaveCount(0);
      } else {
        await expect(row.getByTestId('vehicle-nation-tag')).toHaveText(nation);
      }
      await expect(row).toContainText(id.slice(id.indexOf(':') + 1));
    }
    // The zero-battle vehicle is on screen and MUTED, not filtered out (D-12).
    const last = rows.nth(WOT_ORDER.length - 1);
    await expect(last).toHaveAttribute('data-battles', '0');
    await expect(last).toHaveClass(/muted/);

    // D-14: the row semantics survive windowing, and the header is row 1.
    await expect(table).toHaveAttribute(
      'aria-rowcount',
      String(PLAYER_STATS_EXPECTED.titles.wot.vehicleRows + 1),
    );
    await expect(rows.nth(0)).toHaveAttribute('aria-rowindex', '2');
    await expect(rows.nth(WOT_ORDER.length - 1)).toHaveAttribute('aria-rowindex', '7');
    // Native table semantics, not a grid (D-14).
    await expect(table).not.toHaveAttribute('role', 'grid');
    // D-10: the six CORE columns, in order, and nothing else yet — the eleven
    // extras in the copy inventory are what plan 05-14's column picker offers,
    // and offering a column the reader has not asked for would be showing them
    // their own data in a shape they did not choose.
    const CORE_KEYS = ['vehicle', 'battles', 'winRate', 'avgDamage', 'frags', 'xp'];
    await expect(table.locator('th[scope="col"]')).toHaveCount(CORE_KEYS.length);
    for (const key of CORE_KEYS) {
      const header = table.locator(`th:has([data-testid="vehicle-sort-${key}"])`);
      await expect(header).toHaveCount(1);
      // The label is the copy inventory's, keyed on the canonical key — never
      // the export's own header name, which differs per title.
      await expect(header).toContainText(
        VEHICLE_COLUMN_LABELS[key as keyof typeof VEHICLE_COLUMN_LABELS],
      );
    }

    // The block's one live region is PRESENT and EMPTY when nothing is
    // happening: present, so a selection change has somewhere to be read out,
    // and empty, so it announces nothing of its own accord.
    const status = block.getByTestId('player-stats-status');
    await expect(status).toHaveCount(1);
    await expect(status).toHaveText('');
    await expect(status).toHaveAttribute('aria-live', 'polite');
  });

  test('(controls-row) the Game, Battle type and Search controls share ONE row at 1280', async () => {
    const block = playerStatsBlock(page);

    // The describe shares one page and every test before this one sets up its
    // own title, so the title is selected here rather than assumed: the row is
    // the same three controls whatever title is showing, but the assertions
    // below read the BATTLE TYPE select, which only exists for a title that
    // has battle types.
    await block.getByTestId('player-stats-title-selector').selectOption('wot');
    await expect(block).toHaveAttribute('data-state', 'ready');

    const controls = block.getByTestId('player-stats-controls');
    await expect(controls).toBeVisible();

    // G-05-8: a flex container with no `flex-direction` of its own inherits
    // the stylesheet's bare `div` rule, which makes EVERY div in this
    // component a column — so the controls stacked at 215px tall at every
    // width. The computed value, not the declaration, is the assertion: a
    // media query or an inherited direction would both show up only here.
    const direction = await controls.evaluate((el) => getComputedStyle(el).flexDirection);
    expect(direction).toBe('row');

    // And it WRAPS rather than overflowing: `flex-wrap` is what lets the same
    // row stack at 375px, which the phone-width describe below relies on.
    const wrap = await controls.evaluate((el) => getComputedStyle(el).flexWrap);
    expect(wrap).toBe('wrap');

    // Three controls side by side means three BOTTOM edges at one height: the
    // rule sets `align-items: flex-end` so the controls, not their labels,
    // share a baseline line. 2px is the sub-pixel allowance a rounded device
    // ratio needs; without it this passes a column too, since a column of
    // equal-width boxes still lines its left edges up.
    const bottomEdges = await Promise.all(
      ['player-stats-title-selector', 'player-stats-battle-type-selector', 'vehicle-search'].map(
        async (testid) => {
          const box = await block.getByTestId(testid).boundingBox();
          if (box === null) return Number.POSITIVE_INFINITY;
          return box.y + box.height;
        },
      ),
    );
    const lowest = Math.max(...bottomEdges);
    for (const edge of bottomEdges) {
      expect(Math.abs(edge - lowest)).toBeLessThanOrEqual(2);
    }

    // Which also means the row is ONE row: a label above its control is about
    // 20px, three of them plus the control plus the row's own gap is ~64px,
    // and the column it replaced was 215px.
    const box = await controls.boundingBox();
    expect(box, 'the controls container has no box').not.toBeNull();
    expect(box?.height ?? Number.POSITIVE_INFINITY).toBeLessThan(100);
  });

  test('(type-floor) no visible text is under 14px and no nation tag is truncated', async () => {
    const block = playerStatsBlock(page);

    // WoT with a battle type CHOSEN, and the picker OPEN: the note under the
    // count line and the picker's toggle labels are both Caption-role text that
    // only renders in that state, so a closed picker and the default `All`
    // view would leave the two smallest sizes in the block off screen and this
    // test would pass over them.
    await block.getByTestId('player-stats-title-selector').selectOption('wot');
    await block.getByTestId('player-stats-battle-type-selector').selectOption('1');
    await expect(block.getByTestId('battle-type-note')).toHaveText(BATTLE_TYPE_NOTE_TANKS);
    await openColumnPicker(block.getByTestId('column-picker'));
    await expect(block.getByTestId('column-toggle-survival')).toBeVisible();

    // G-05-10: the UI-SPEC's Typography floor. The offenders are named rather
    // than counted, because "36 offenders" does not say which rule to fix.
    const offenders = await textUnderFloor(page.locator('main'), 14);
    expect(offenders, `text under the 14px floor:\n  ${offenders.join('\n  ')}`).toEqual([]);

    // Raising the nation tag to 14px (D-11) widens the text inside a capped
    // box, so a long enough nation name would now be ellipsised. The tag is
    // part of the vehicle name a reader is reading, so a truncated tag is a
    // lost nation rather than a cosmetic detail — and this is the measurement
    // that decided `max-width` was kept at 70px rather than raised.
    const tags = block.getByTestId('vehicle-nation-tag');
    const truncated = await tags.evaluateAll((els) =>
      els
        .filter((el) => el.scrollWidth > el.clientWidth)
        .map(
          (el) =>
            `${el.textContent ?? ''} (${el.clientWidth}px shown, ${el.scrollWidth}px of text)`,
        ),
    );
    expect(truncated, `truncated nation tags:\n  ${truncated.join('\n  ')}`).toEqual([]);

    // Hand the page back the way this describe's next test expects it. A
    // battle-type view is a FILTER, so leaving one selected would change the
    // row set every later test in this describe reads. The All option's value
    // is the empty string.
    await block.getByTestId('player-stats-battle-type-selector').selectOption('');
    await expect(block.getByTestId('player-stats-battle-type-selector')).toHaveValue('');
  });

  test('(sort) header buttons sort, flip, set aria-sort and keep specials last', async () => {
    const block = playerStatsBlock(page);
    const table = block.getByTestId('vehicle-table');
    const rows = table.getByTestId('vehicle-row');

    // The default: battles descending, and only that header carries a
    // direction other than `none`.
    await expect(table.locator('th[aria-sort="descending"]')).toHaveCount(1);
    await expect(table.locator('th:has([data-testid="vehicle-sort-battles"])')).toHaveAttribute(
      'aria-sort',
      'descending',
    );

    // A second click on the SAME header flips. Ascending puts the zero-battle
    // vehicle FIRST, which is the assertion that the flip reached the data and
    // not just the attribute.
    await table.getByTestId('vehicle-sort-battles').click();
    await expect(table.locator('th:has([data-testid="vehicle-sort-battles"])')).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
    await expect(rows.nth(0)).toHaveAttribute('data-battles', '0');
    await expect(rows.nth(0)).toHaveClass(/muted/);
    // A third click flips back, so there is no unsorted state (D-12).
    await table.getByTestId('vehicle-sort-battles').click();
    await expect(rows.nth(0)).toHaveAttribute('data-battles', '100');

    // A NEW column takes its FIRST direction: `Vehicle` is text, so ascending;
    // `Win rate` is a percent, so descending (05-09's `firstDirection`).
    await table.getByTestId('vehicle-sort-vehicle').click();
    await expect(table.locator('th:has([data-testid="vehicle-sort-vehicle"])')).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
    // Ties break by the CLEANED id ascending, and the specials are not in the
    // comparison: `__proto__` has no nation and no colon, so its cleaned id is
    // the whole string.
    await expect(rows.nth(0)).toContainText('A12_T29');
    await expect(rows.nth(0)).toHaveAttribute('data-battles', '40');

    // D-09: a special value sorts LAST in BOTH directions. The zero-battle
    // vehicle's win rate is a `no-battles` dash, and in either direction it is
    // the last row rather than the one with the smallest number.
    await table.getByTestId('vehicle-sort-winRate').click();
    await expect(rows.nth(WOT_ORDER.length - 1)).toHaveAttribute('data-battles', '0');
    await table.getByTestId('vehicle-sort-winRate').click();
    await expect(rows.nth(WOT_ORDER.length - 1)).toHaveAttribute('data-battles', '0');
    await expect(
      table.locator('th[aria-sort="ascending"], th[aria-sort="descending"]'),
    ).toHaveCount(1);

    // Leave the table on the default order for the tests below.
    await table.getByTestId('vehicle-sort-battles').click();
    await expect(table.locator('th:has([data-testid="vehicle-sort-battles"])')).toHaveAttribute(
      'aria-sort',
      'descending',
    );
    await expect(rows.nth(0)).toHaveAttribute('data-battles', '100');
  });

  test('(search) filters the cleaned id, counts, and shows the no-match message', async () => {
    const block = playerStatsBlock(page);
    const table = block.getByTestId('vehicle-table');
    const search = block.getByTestId('vehicle-search');
    const rows = table.getByTestId('vehicle-row');

    // A labelled native search box, with no placeholder to stand in for the
    // label once the reader starts typing.
    await expect(search).toHaveAttribute('type', 'search');
    await expect(page.getByLabel('Search vehicles')).toHaveCount(1);

    // D-11: the search is over the CLEANED id, so `ch24` matches the one
    // vehicle whose id contains it and NOT the three whose nation is `china`.
    await search.fill('ch24');
    await expect(rows).toHaveCount(1);
    await expect(rows.nth(0)).toHaveAttribute('data-battles', '100');
    // The count line switches to the search form, and says how many of how
    // many — a bare total would leave a reader unable to tell a filter that did
    // nothing from a filter that is not applied.
    await expect(block.getByTestId('vehicle-count')).toHaveText(
      formatVehicleSearchCount(1, PLAYER_STATS_EXPECTED.titles.wot.vehicleRows),
    );

    // Case-insensitive, and a substring rather than a prefix.
    await search.fill('TYPE64');
    await expect(rows).toHaveCount(1);
    await expect(rows.nth(0)).toContainText('Ch24_Type64');

    // A query that matches nothing says so IN PLACE of the table, and the
    // count line is STILL there — a reader has to be able to see that the
    // filter is what emptied it.
    await search.fill('no-such-vehicle');
    await expect(block.getByTestId('vehicle-no-match')).toHaveText(VEHICLE_NO_MATCH);
    await expect(table).toHaveCount(0);
    await expect(block.getByTestId('vehicle-count')).toHaveText(
      formatVehicleSearchCount(0, PLAYER_STATS_EXPECTED.titles.wot.vehicleRows),
    );

    // Escape clears the box through the native `type="search"` behaviour, and
    // the full table comes back.
    await search.press('Escape');
    await expect(search).toHaveValue('');
    await expect(rows).toHaveCount(PLAYER_STATS_EXPECTED.titles.wot.vehicleRows);
    await expect(block.getByTestId('vehicle-count')).toHaveText(WOT_COUNT);
  });

  test('(titles) every title shows its rows, resets sort and search and announces the selection', async () => {
    const block = playerStatsBlock(page);
    const table = block.getByTestId('vehicle-table');
    const select = block.getByTestId('player-stats-title-selector');
    const rows = table.getByTestId('vehicle-row');
    const search = block.getByTestId('vehicle-search');
    const status = block.getByTestId('player-stats-status');

    // D-05: all four titles, each showing its own rows and naming itself.
    for (const [titleId, answerKey] of TITLE_ANSWER_KEYS) {
      const expected = PLAYER_STATS_EXPECTED.titles[answerKey];
      // Focused FIRST, because `selectOption` sets the value and dispatches a
      // change without touching focus. Without a focus to lose, "focus stays
      // on the control" (05-UI-SPEC section 3, Keyboard) would be vacuously
      // true for any implementation, including one that re-rendered the whole
      // block and dropped the reader back on the body.
      await select.focus();
      await select.selectOption(titleId);
      await expect(block).toHaveAttribute('data-state', 'ready');
      await expect(select).toHaveValue(titleId);
      await expect(rows).toHaveCount(expected.vehicleRows);
      await expect(block.getByTestId('vehicle-count')).toHaveText(
        formatVehicleCount(expected.vehicleRows, expected.zeroBattleCount),
      );
      // The scroller is re-named for the title on screen, so a screen reader
      // moving into the table is told which game it is standing in.
      await expect(block.getByTestId('vehicle-scroller')).toHaveAccessibleName(
        formatVehicleRegionName(titleId, null),
      );
      // And the answer is read out: the row count is in the sentence because
      // a reader who is not watching the table has no other way to know that a
      // change landed.
      await expect(status).toHaveText(
        formatVehicleAnnouncement(titleId, null, expected.vehicleRows),
      );
      // Focus stays on the control that was changed.
      await expect(select).toBeFocused();
    }

    // D-12 / D-28: a title change resets the sort and the search. Set them on
    // WoT, switch away, and switch back — nothing about the previous title's
    // selection may survive.
    await select.selectOption('wot');
    await table.getByTestId('vehicle-sort-vehicle').click();
    await search.fill('a12');
    await expect(rows).toHaveCount(1);
    await select.selectOption('wows');
    await expect(select).toHaveValue('wows');
    await expect(search).toHaveValue('');
    await expect(table.locator('th:has([data-testid="vehicle-sort-battles"])')).toHaveAttribute(
      'aria-sort',
      'descending',
    );

    // And the table is on its first row, because the sort returned to the
    // default rather than to the vehicle-name order.
    await expect(rows.nth(0)).toHaveAttribute('data-battles', '7');
  });

  // ===========================================================================
  // 05-14 Task 1 — the BATTLE TYPE filter (D-07)
  //
  // Lives in this describe rather than a new one because the sample import is
  // the whole fixture: the by_Type and Battle_Types files are already in it,
  // and a second import would pay a full unzip/parse/ingest for the same bytes.
  // ===========================================================================
  test('(battle-type) WoT code 1 swaps the table and shows the note, All returns the six rows, Warplanes has no control', async () => {
    const block = playerStatsBlock(page);
    const table = block.getByTestId('vehicle-table');
    const rows = table.getByTestId('vehicle-row');
    const titleSelect = block.getByTestId('player-stats-title-selector');
    const status = block.getByTestId('player-stats-status');

    // Back to WoT / All battles: the previous test left Warships on screen.
    await titleSelect.selectOption('wot');
    await expect(block).toHaveAttribute('data-title-state', 'ready');
    await expect(rows).toHaveCount(PLAYER_STATS_EXPECTED.titles.wot.vehicleRows);

    // D-07: the control is a native select with a VISIBLE label, after the
    // Game control in document order (UI-SPEC section 1, Keyboard).
    const battleType = block.getByTestId('player-stats-battle-type-selector');
    await expect(battleType).toHaveCount(1);
    // `exact: true` since 05-20, and for a real reason rather than a flaky one:
    // the battle-type summary's scroll region is named by its own heading,
    // "Battles by battle type", which CONTAINS this label. A substring match
    // would count that region as a second "Battle type" label and fail a
    // control that is still labelled exactly once. The intent of the assertion
    // is "this control has one label", and only an exact match states that now
    // that a region in the same block carries an overlapping name.
    await expect(block.getByLabel(BATTLE_TYPE_CONTROL_LABEL, { exact: true })).toHaveCount(1);
    await expect(battleType).toHaveValue('');

    // The options are `All battles` then one per by_Type code, in NUMERIC
    // order — 1, 2, 10 and not 1, 10, 2 — and NEVER a code the by_Type file
    // does not have. The Battle_Types summary file lists five codes; only three
    // of them have by_Type rows, and offering 11 or 13 would swap the table to
    // a view that has none (RESEARCH Pitfall 10).
    const options = battleType.locator('option');
    await expect(options).toHaveCount(4);
    await expect(options.nth(0)).toHaveText(BATTLE_TYPE_ALL_OPTION);
    for (const code of PLAYER_STATS_EXPECTED.titles.wot.byTypeCodes) {
      await expect(battleType.locator(`option[value="${code}"]`)).toHaveText(
        formatBattleTypeLabel(code),
      );
    }
    for (const code of ['11', '13']) {
      await expect(battleType.locator(`option[value="${code}"]`)).toHaveCount(0);
    }

    // No note before a code is chosen: "battle-type data covers only part of
    // your battles" is a claim about a filtered table, and there is no
    // filtered table yet.
    await expect(block.getByTestId('battle-type-note')).toHaveCount(0);

    // Choosing code 1 swaps the table to that code's by_Type rows, in the
    // default battles-descending order: china Ch24_Type64 with 60, then usa
    // A12_T29 with 20. Both are by_Type fixtures, not main-file rows.
    await battleType.focus();
    await battleType.selectOption('1');
    await expect(block).toHaveAttribute('data-state', 'ready');
    await expect(battleType).toHaveValue('1');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toHaveAttribute('data-battles', '60');
    await expect(rows.nth(0)).toContainText('Ch24_Type64');
    await expect(rows.nth(0).getByTestId('vehicle-nation-tag')).toHaveText('china');
    await expect(rows.nth(1)).toHaveAttribute('data-battles', '20');
    await expect(rows.nth(1)).toContainText('A12_T29');
    await expect(rows.nth(1).getByTestId('vehicle-nation-tag')).toHaveText('usa');

    // The count line reads the FILTERED list, and the note says why the
    // filtered list is not the whole story (D-07).
    await expect(block.getByTestId('vehicle-count')).toHaveText(formatVehicleCount(2, 0));
    await expect(block.getByTestId('battle-type-note')).toHaveText(BATTLE_TYPE_NOTE_TANKS);
    // The scroller is re-named for the scope on screen, so a screen reader
    // moving into the table is told which slice of it it is standing in.
    await expect(block.getByTestId('vehicle-scroller')).toHaveAccessibleName(
      formatVehicleRegionName('wot', '1'),
    );
    // And the change is read out with the count in the sentence.
    await expect(status).toHaveText(formatVehicleAnnouncement('wot', '1', 2));
    // Focus stays on the control that was changed (UI-SPEC section 3).
    await expect(battleType).toBeFocused();

    // D-12: the change resets the SORT and the SEARCH — the two selectors that
    // describe the previous list — and returns the scroller to the top.
    await table.getByTestId('vehicle-sort-vehicle').click();
    await block.getByTestId('vehicle-search').fill('a12');
    await expect(rows).toHaveCount(1);
    await battleType.selectOption('2');
    await expect(block.getByTestId('vehicle-search')).toHaveValue('');
    await expect(table.locator('th:has([data-testid="vehicle-sort-battles"])')).toHaveAttribute(
      'aria-sort',
      'descending',
    );
    // And the second code's own row, so the assertion is about the DATA and
    // not about the control having fired.
    await expect(rows).toHaveCount(1);
    await expect(rows.nth(0)).toHaveAttribute('data-battles', '10');
    await expect(rows.nth(0)).toContainText('Ch24_Type64');

    // All battles returns the six-row view, the note goes away, and the extra
    // per-code assertions do not follow it around.
    await battleType.selectOption('');
    await expect(rows).toHaveCount(PLAYER_STATS_EXPECTED.titles.wot.vehicleRows);
    await expect(block.getByTestId('vehicle-count')).toHaveText(WOT_COUNT);
    await expect(block.getByTestId('battle-type-note')).toHaveCount(0);
    await expect(block.getByTestId('vehicle-scroller')).toHaveAccessibleName(WOT_REGION);
    await expect(status).toHaveText(
      formatVehicleAnnouncement('wot', null, PLAYER_STATS_EXPECTED.titles.wot.vehicleRows),
    );

    // E3 (empty): Warplanes has no by_Type file at all, so there are no codes
    // and the control is NOT RENDERED — the same silence as Phase 4's absent
    // split. Not a disabled select, not a one-option select: absent.
    await titleSelect.selectOption('wowp');
    await expect(block).toHaveAttribute('data-title-state', 'ready');
    await expect(block.getByTestId('player-stats-battle-type-selector')).toHaveCount(0);
    await expect(block.getByTestId('battle-type-note')).toHaveCount(0);
    // And switching back restores it, so its absence is about the title rather
    // than about a one-way transition.
    await titleSelect.selectOption('wot');
    await expect(block.getByTestId('player-stats-battle-type-selector')).toHaveCount(1);

    // Leave the block on the default view for the files that follow.
    await expect(rows).toHaveCount(PLAYER_STATS_EXPECTED.titles.wot.vehicleRows);
  });

  // ===========================================================================
  // 05-14 Task 2 — the per-title header, the summary, Warships and Warplanes
  // ===========================================================================
  test('(header) lifetime battles and premium expiry as written, per title', async () => {
    const block = playerStatsBlock(page);
    const titleSelect = block.getByTestId('player-stats-title-selector');
    const header = block.getByTestId('player-stats-header');

    // D-13: a `dl` with two rows, under the controls and above the table.
    await expect(header).toHaveCount(1);
    await expect(header.locator('dt')).toHaveText([
      HEADER_LIFETIME_BATTLES_LABEL,
      HEADER_PREMIUM_EXPIRES_LABEL,
    ]);
    // WoT: the account file's 162, which is exactly the main file's sum, and
    // the Unix epoch AS WRITTEN. Reformatting it would both invent a timezone
    // the file does not carry and move the date for a reader west of UTC.
    await expect(block.getByTestId('lifetime-battles')).toHaveText(
      formatNumber(PLAYER_STATS_EXPECTED.titles.wot.battlesSum),
    );
    await expect(block.getByTestId('premium-expires')).toHaveText(WOT_PREMIUM_EXPIRY);

    // Blitz: the account file spells the expiry `N/A`, and D-09 says that is
    // `not available` — a value the header renders, not a parse failure to
    // swallow, and never a zero.
    await titleSelect.selectOption('wotb');
    await expect(block).toHaveAttribute('data-state', 'ready');
    await expect(block.getByTestId('lifetime-battles')).toHaveText(
      formatNumber(PLAYER_STATS_EXPECTED.titles.blitz.battlesSum),
    );
    await expect(block.getByTestId('premium-expires')).toHaveText(VALUE_NOT_AVAILABLE);

    // The other two, so the header is not a WoT-and-Blitz-only feature.
    await titleSelect.selectOption('wows');
    await expect(block.getByTestId('lifetime-battles')).toHaveText(
      formatNumber(PLAYER_STATS_EXPECTED.titles.warships.battlesSum),
    );
    await expect(block.getByTestId('premium-expires')).toHaveText(WOWS_PREMIUM_EXPIRY);
    await titleSelect.selectOption('wowp');
    await expect(block.getByTestId('lifetime-battles')).toHaveText(
      formatNumber(PLAYER_STATS_EXPECTED.titles.warplanes.battlesSum),
    );
    await expect(block.getByTestId('premium-expires')).toHaveText(WOWP_PREMIUM_EXPIRY);

    // T-05-12c: the account `NAME` column is the nickname, and Phase 3 confines
    // it to the identity header. Every account file of the fixture carries the
    // canary, so the header rendering all four titles without it is a statement
    // about the whole folder rather than about one file.
    await expect(header).not.toContainText(STATS_NAME_CANARY);
    await expect(block).not.toContainText(STATS_NAME_CANARY);

    await titleSelect.selectOption('wot');
    await expect(block).toHaveAttribute('data-state', 'ready');
  });

  test('(summary) the WoT summary lists five codes in battles order while the select offers three', async () => {
    const block = playerStatsBlock(page);
    const summary = block.getByTestId('battle-type-summary');
    const summaryRows = summary.getByTestId('battle-type-row');
    const disclosure = block.getByTestId('battle-type-summary-disclosure');

    // The h4 and its caption, then an OPEN disclosure: this is reference
    // information about the export, and a collapsed one would hide the only
    // place the export states how much of its own battle coverage it has.
    await expect(block.getByRole('heading', { name: BATTLE_TYPE_SUMMARY_HEADING })).toBeVisible();
    await expect(block).toContainText(BATTLE_TYPE_SUMMARY_CAPTION);
    await expect(disclosure).toHaveAttribute('open', '');
    await expect(disclosure.locator('summary')).toHaveText(BATTLE_TYPE_SUMMARY_DISCLOSURE);

    // The four headers, in the inventory's order.
    await expect(summary.locator('th[scope="col"]')).toHaveText(BATTLE_TYPE_SUMMARY_HEADERS);

    // D-07 / RESEARCH Pitfall 10: the summary lists EVERY code of the
    // Battle_Types file — five — while the select offers only the three that
    // have by_Type rows. The gap is a property of the export, not a defect, and
    // the test that makes it visible is this one.
    await expect(summaryRows).toHaveCount(PLAYER_STATS_EXPECTED.titles.wot.summaryCodes.length);
    expect(PLAYER_STATS_EXPECTED.titles.wot.summaryCodes.length).toBeGreaterThan(
      PLAYER_STATS_EXPECTED.titles.wot.byTypeCodes.length,
    );
    for (const [index, code] of PLAYER_STATS_EXPECTED.titles.wot.summaryCodes.entries()) {
      const row = summaryRows.nth(index);
      await expect(row).toHaveAttribute('data-code', code);
      // Never named: the export records a code and no label (D-07).
      await expect(row.locator('td').first()).toHaveText(formatBattleTypeLabel(code));
      const expected = WOT_BATTLE_TYPES[index];
      if (expected === undefined) continue;
      await expect(row.locator('td').nth(1)).toHaveText(formatNumber(expected.battles));
      await expect(row.locator('td').nth(2)).toHaveText(formatNumber(expected.wins));
      await expect(row.locator('td').nth(3)).toHaveText(formatNumber(expected.damage));
    }
    // Battles descending, with the 4/4 tie resolved by code ascending — so the
    // order is a RULE and not a coincidence of the fixture.
    await expect(summaryRows.nth(0).locator('td').nth(1)).toHaveText('80');
    await expect(summaryRows.nth(3).locator('td').first()).toHaveText(formatBattleTypeLabel('11'));
    await expect(summaryRows.nth(4).locator('td').first()).toHaveText(formatBattleTypeLabel('13'));

    // The summary is NOT interactive — the select is the only control — so
    // there is no button and no row control inside it.
    await expect(summary.locator('button')).toHaveCount(0);

    // T-05-42: the code reaches the DOM as an escaped attribute and as text.
    // A code carrying markup shows as those characters, never as markup.
    await expect(summaryRows.nth(0).locator('td').first()).toContainText('Battle type 1');
    await expect(summary).not.toContainText('<');

    // Warships carries the double-count note; a tanks account does not, because
    // the claim is about how the GAME records a battle.
    const titleSelect = block.getByTestId('player-stats-title-selector');
    await titleSelect.selectOption('wows');
    await expect(block).toContainText(BATTLE_TYPE_SUMMARY_NOTE_WARSHIPS);
    await titleSelect.selectOption('wot');
    await expect(block).not.toContainText(BATTLE_TYPE_SUMMARY_NOTE_WARSHIPS);

    // E3 (empty): Warplanes has no Battle_Types file, so there is no summary
    // and no h4 saying there would be one.
    await titleSelect.selectOption('wowp');
    await expect(block.getByTestId('battle-type-summary')).toHaveCount(0);
    await expect(block.getByRole('heading', { name: BATTLE_TYPE_SUMMARY_HEADING })).toHaveCount(0);
    await titleSelect.selectOption('wot');
    await expect(block).toHaveAttribute('data-state', 'ready');
  });

  test('(warships) all-battles reads per-battle-type, has plain headers, and code 1 swaps to numbers', async () => {
    const block = playerStatsBlock(page);
    const titleSelect = block.getByTestId('player-stats-title-selector');
    const table = block.getByTestId('vehicle-table');
    const rows = table.getByTestId('vehicle-row');
    const headers = table.locator('th[scope="col"]');

    await titleSelect.selectOption('wows');
    await expect(block).toHaveAttribute('data-state', 'ready');

    // D-08: the All-battles columns, in their own order — NOT the core six.
    // CONTAINS rather than equals, because a sortable header's cell also holds
    // the `aria-hidden` sort arrow; the arrow is asserted separately, through
    // `aria-sort`, rather than by scraping it out of the text.
    const warshipsKeys = [
      'vehicle',
      'battles',
      'lastBattle',
      'inGarage',
      'winRate',
      'avgDamage',
    ] as const;
    await expect(headers).toHaveCount(warshipsKeys.length);
    for (const [index, key] of warshipsKeys.entries()) {
      await expect(headers.nth(index)).toContainText(VEHICLE_COLUMN_LABELS[key]);
    }

    // Every win rate and average damage cell reads the same note, because
    // WOWS_Ship_Statistics.csv has neither wins nor damage: those exist only
    // in the by_Type file. Nothing is summed, guessed, or shown as 0.
    const expected = PLAYER_STATS_EXPECTED.titles.warships;
    await expect(rows).toHaveCount(expected.vehicleRows);
    for (let index = 0; index < expected.vehicleRows; index++) {
      const cells = rows.nth(index).locator('td');
      await expect(cells.nth(4)).toHaveText(VALUE_PER_BATTLE_TYPE);
      await expect(cells.nth(5)).toHaveText(VALUE_PER_BATTLE_TYPE);
    }
    // And those two headers are PLAIN TEXT: no sort button, and `aria-sort`
    // carrying the one value that means "this column is not sorted". The
    // UI-SPEC's header contract is `none` on every unsorted column, and 05-12's
    // source contract pins the attribute on every `th`; a non-sortable column
    // is identified by the ABSENCE of the button, not by a missing attribute.
    for (const key of ['winRate', 'avgDamage'] as const) {
      const header = table.locator(`th:has-text("${VEHICLE_COLUMN_LABELS[key]}")`).first();
      await expect(table.getByTestId(`vehicle-sort-${key}`)).toHaveCount(0);
      await expect(header.locator('button')).toHaveCount(0);
      await expect(header).toHaveAttribute('aria-sort', 'none');
    }
    // The four sortable ones still are.
    for (const key of ['vehicle', 'battles', 'lastBattle', 'inGarage'] as const) {
      await expect(table.getByTestId(`vehicle-sort-${key}`)).toHaveCount(1);
    }
    // And the note says WHY, above the table.
    await expect(block.getByTestId('warships-all-note')).toHaveText(WARSHIPS_ALL_NOTE);

    // The rows are the three ships in battles-descending order, with the
    // garage-only one last and muted.
    await expect(block.getByTestId('vehicle-count')).toHaveText(
      formatVehicleCount(expected.vehicleRows, expected.zeroBattleCount),
    );
    await expect(rows.nth(0)).toContainText('PJSD001_Fake_Alpha');
    await expect(rows.nth(0)).toHaveAttribute('data-battles', '7');
    await expect(rows.nth(1)).toContainText('PJSC003_Fake_Gamma');
    await expect(rows.nth(1)).toHaveAttribute('data-battles', '2');
    await expect(rows.nth(2)).toContainText('PASD002_Fake_Beta');
    await expect(rows.nth(2)).toHaveAttribute('data-battles', '0');
    await expect(rows.nth(2)).toHaveClass(/muted/);

    // Code 1 swaps to the by_Type rows and the NUMERIC win rate, and the
    // all-battles note goes with it.
    const battleType = block.getByTestId('player-stats-battle-type-selector');
    await battleType.focus();
    await battleType.selectOption('1');
    await expect(block).toHaveAttribute('data-state', 'ready');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText('PJSD001_Fake_Alpha');
    await expect(rows.nth(0)).toHaveAttribute('data-battles', '7');
    await expect(rows.nth(1)).toContainText('PJSC003_Fake_Gamma');
    await expect(rows.nth(1)).toHaveAttribute('data-battles', '2');
    // 4 wins of 7 and 1 of 2 — the ratio the export's own numbers give, NOT
    // the same figure scaled twice.
    await expect(rows.nth(0).locator('td').nth(2)).toHaveText('57.1%');
    await expect(rows.nth(1).locator('td').nth(2)).toHaveText('50.0%');
    await expect(rows.nth(0).locator('td').nth(3)).toHaveText('4,000');
    await expect(rows.nth(1).locator('td').nth(3)).toHaveText('3,000');
    // The note changes with the view: "choose a battle type" would be a reader
    // being told to do what they just did.
    await expect(block.getByTestId('warships-all-note')).toHaveCount(0);
    await expect(block.getByTestId('battle-type-note')).toHaveText(BATTLE_TYPE_NOTE_WARSHIPS);
    // And the win rate column is sortable again.
    await expect(table.getByTestId('vehicle-sort-winRate')).toHaveCount(1);

    await battleType.selectOption('');
    await expect(rows).toHaveCount(expected.vehicleRows);
    await titleSelect.selectOption('wot');
    await expect(block).toHaveAttribute('data-state', 'ready');
  });

  test('(warplanes) named planes, not defined, dashes and the WOWP_20 note', async () => {
    const block = playerStatsBlock(page);
    const titleSelect = block.getByTestId('player-stats-title-selector');
    const table = block.getByTestId('vehicle-table');
    const rows = table.getByTestId('vehicle-row');

    await titleSelect.selectOption('wowp');
    await expect(block).toHaveAttribute('data-state', 'ready');
    const expected = PLAYER_STATS_EXPECTED.titles.warplanes;

    // D-09: three NAMED planes from WOWP_19, in battles order with the two
    // zero-game planes tied and resolved by cleaned id.
    await expect(rows).toHaveCount(expected.vehicleRows);
    await expect(rows.nth(0)).toContainText('plane_fake_two');
    await expect(rows.nth(0)).toHaveAttribute('data-battles', '4');
    await expect(rows.nth(1)).toContainText('plane_fake_one');
    await expect(rows.nth(2)).toContainText('plane_fake_three');
    // No nation tag: Warplanes ids carry no `nation:` prefix.
    await expect(rows.nth(0).getByTestId('vehicle-nation-tag')).toHaveCount(0);

    // The win rate is 2 of 4, and the export's own `N/D` damage is `not
    // defined` in EVERY row — including the plane that has played four games.
    // Never a zero: a cell that reads `0` here is a claim the export never made.
    await expect(rows.nth(0).locator('td').nth(2)).toHaveText('50.0%');
    for (let index = 0; index < expected.vehicleRows; index++) {
      await expect(rows.nth(index).locator('td').nth(3)).toHaveText(VALUE_NOT_DEFINED);
    }
    // A zero-game plane's win rate is a dash, muted, with the reason beside it
    // for a screen reader rather than a `0%` that would be a number.
    for (const index of [1, 2]) {
      const cell = rows.nth(index).locator('td').nth(2);
      expect(await visibleText(cell), `row ${index} win rate`).toBe(VALUE_DASH);
      await expect(cell).toHaveClass(/muted-cell/);
      await expect(cell.locator('.sr-only')).toHaveText(VALUE_NO_BATTLES_HIDDEN);
    }
    // The no-battle planes are muted rows, not hidden ones (D-12).
    await expect(rows.nth(1)).toHaveClass(/muted/);
    await expect(block.getByTestId('vehicle-count')).toHaveText(
      formatVehicleCount(expected.vehicleRows, expected.zeroBattleCount),
    );

    // WOWP_20 is NEVER a table: it has no vehicle identifier. It is one
    // sentence stating the two things the file does say, and the figure is the
    // WOWP_20 total (8), deliberately NOT the WOWP_19 account's 4 — two files,
    // two sets of planes, and no reconciling them.
    const note = block.getByTestId('warplanes-20-note');
    await expect(note).toHaveText(
      formatWarplanes20Note(
        PLAYER_STATS_EXPECTED.warplanes20.records,
        PLAYER_STATS_EXPECTED.warplanes20.battles,
      ),
    );
    await expect(note).toContainText('no names in the export');
    await expect(rows).toHaveCount(expected.vehicleRows);
    // And it is absent for every other title, because the file is not theirs.
    await titleSelect.selectOption('wot');
    await expect(block.getByTestId('warplanes-20-note')).toHaveCount(0);

    await titleSelect.selectOption('wot');
    await expect(block).toHaveAttribute('data-state', 'ready');
  });

  // ===========================================================================
  // 05-14 Task 3 — the COLUMN PICKER
  // ===========================================================================
  test('(picker) extras are listed per view, appended at the end, cleared by a title change and kept by a battle-type change', async () => {
    const block = playerStatsBlock(page);
    const table = block.getByTestId('vehicle-table');
    const headers = table.locator('th[scope="col"]');
    const picker = block.getByTestId('column-picker');
    const coreCount = 6;

    // D-10: a native `<details>` whose summary is a button-styled control, and
    // a fieldset with a legend holding one checkbox per EXTRA the current view
    // offers. A details and a fieldset, not a div and a list: both are the
    // platform's, which is the whole reason there is no custom widget here.
    await expect(picker).toHaveCount(1);
    await expect(picker.locator('summary')).toHaveText(COLUMN_PICKER_SUMMARY);
    await expect(picker.locator('legend')).toHaveText(COLUMN_PICKER_LEGEND);
    // No button: the summary IS the control, and a button inside a summary
    // would be two tab stops for one action.
    await expect(picker.locator('button')).toHaveCount(0);

    // EXACTLY the extras the WoT All-battles file has, in the order the picker
    // lists them. Six of the eleven inventory extras are absent because
    // `WOT_Vehicle_Statistics.csv` has no such column — listing one would draw
    // a column of `not in export` the reader asked for and the export never
    // offered. `maxDamage` is the tell: WoT's by_Type file HAS it and the main
    // file does not, and it is the difference the next assertion turns on.
    const WOT_ALL_EXTRAS = [
      'survival',
      'hitRatio',
      'maxFrags',
      'maxXp',
      'damageReceived',
      'spotted',
      'lastBattle',
    ] as const;
    const toggles = picker.locator('input[type="checkbox"]');
    await expect(toggles).toHaveCount(WOT_ALL_EXTRAS.length);
    for (const [index, key] of WOT_ALL_EXTRAS.entries()) {
      const toggle = block.getByTestId(`column-toggle-${key}`);
      await expect(toggle).toHaveCount(1);
      // The ORDER is the contract as much as the contents, so the nth box is
      // asserted to BE that key rather than the set merely containing it.
      await expect(toggles.nth(index)).toHaveAttribute('data-testid', `column-toggle-${key}`);
      // Labelled from the copy inventory, keyed on the canonical key.
      await expect(toggle.locator('xpath=..')).toContainText(VEHICLE_COLUMN_LABELS[key]);
      await expect(toggle).not.toBeChecked();
    }
    // Core columns are NOT toggles, and `maxDamage` is not offered.
    for (const key of ['vehicle', 'battles', 'winRate', 'avgDamage', 'frags', 'xp']) {
      await expect(block.getByTestId(`column-toggle-${key}`)).toHaveCount(0);
    }
    await expect(block.getByTestId('column-toggle-maxDamage')).toHaveCount(0);
    // And nothing is drawn until it is asked for.
    await expect(headers).toHaveCount(coreCount);

    await openColumnPicker(picker);

    // Checking one appends the column at the END of the table — the reader
    // chose where it goes, and reordering their choice behind their back would
    // be the table second-guessing them.
    await block.getByTestId('column-toggle-survival').check();
    await expect(headers).toHaveCount(coreCount + 1);
    await expect(headers.last()).toContainText(VEHICLE_COLUMN_LABELS.survival);
    await expect(block.getByTestId('column-toggle-survival')).toBeChecked();
    // The six core headers are still the first six, in their own order.
    for (const [index, key] of (
      ['vehicle', 'battles', 'winRate', 'avgDamage', 'frags', 'xp'] as const
    ).entries()) {
      await expect(headers.nth(index)).toContainText(VEHICLE_COLUMN_LABELS[key]);
    }
    // A second one lands after the first, in PICK order rather than in the
    // order the view happens to list them.
    await block.getByTestId('column-toggle-lastBattle').check();
    await expect(headers).toHaveCount(coreCount + 2);
    await expect(headers.nth(coreCount)).toContainText(VEHICLE_COLUMN_LABELS.survival);
    await expect(headers.nth(coreCount + 1)).toContainText(VEHICLE_COLUMN_LABELS.lastBattle);

    // Unchecking removes it again. `lastBattle` is now the only pick, which is
    // what makes the battle-type change below a real test of the KEEP rule
    // rather than a test of a column that happens to exist in both views.
    await block.getByTestId('column-toggle-survival').uncheck();
    await expect(headers).toHaveCount(coreCount + 1);
    await expect(headers.last()).toContainText(VEHICLE_COLUMN_LABELS.lastBattle);

    // D-12: a BATTLE-TYPE change KEEPS the picked extras, and a pick the new
    // view cannot show is neither drawn nor an error. `WOT_Vehicle_Statistics
    // _by_Type.csv` has no `LAST_BATTLE_AT` column, so `lastBattle` is neither
    // offered nor drawn there — and `DAMAGE_MAX`, which the by_Type file DOES
    // have and the main file does not, becomes available and unchecked.
    const battleType = block.getByTestId('player-stats-battle-type-selector');
    await battleType.focus();
    await battleType.selectOption('1');
    await expect(block).toHaveAttribute('data-state', 'ready');
    await expect(block.getByTestId('column-toggle-lastBattle')).toHaveCount(0);
    await expect(headers).toHaveCount(coreCount);
    await expect(block.getByTestId('column-toggle-maxDamage')).toHaveCount(1);
    await expect(block.getByTestId('column-toggle-maxDamage')).not.toBeChecked();
    // `survival` is offered here too, and it is UNCHECKED — the pick list went
    // through a battle-type change and the only thing that survived it was what
    // the reader had actually chosen.
    await expect(block.getByTestId('column-toggle-survival')).not.toBeChecked();

    // Choosing it IN this view is what proves the list was kept rather than
    // merely emptied: it comes back checked after a round trip to All battles.
    await openColumnPicker(block.getByTestId('column-picker'));
    await block.getByTestId('column-toggle-survival').check();
    await expect(headers).toHaveCount(coreCount + 1);
    await expect(headers.last()).toContainText(VEHICLE_COLUMN_LABELS.survival);
    await battleType.selectOption('');
    await expect(block).toHaveAttribute('data-state', 'ready');
    await expect(block.getByTestId('column-toggle-survival')).toBeChecked();
    // `lastBattle` is offered again and is STILL CHECKED. It was never dropped:
    // `visibleColumns` (05-09) ignored the key while this view had no such
    // column, and a pick that vanished for the length of a battle-type change
    // would be the exact churn the keep rule exists to avoid. Pick order is
    // preserved too, so `lastBattle` — picked FIRST — is now the first extra.
    await expect(block.getByTestId('column-toggle-lastBattle')).toBeChecked();
    await expect(headers).toHaveCount(coreCount + 2);
    await expect(headers.nth(coreCount)).toContainText(VEHICLE_COLUMN_LABELS.lastBattle);
    await expect(headers.nth(coreCount + 1)).toContainText(VEHICLE_COLUMN_LABELS.survival);

    // D-12: a TITLE change is a different game and a different file, so the
    // extras go with it. Blitz's All view HAS a `survival` column, so the
    // honest assertion is that the CHECKBOX is cleared — which is the reset —
    // rather than that a column happens to disappear.
    const titleSelect = block.getByTestId('player-stats-title-selector');
    await titleSelect.selectOption('wotb');
    await expect(block).toHaveAttribute('data-state', 'ready');
    await expect(block.getByTestId('column-toggle-survival')).not.toBeChecked();
    await expect(headers).toHaveCount(coreCount);

    // E3 (empty): a view with NO extras has no picker at all. Warships'
    // by_Type view offers five, so the title that has none is... Warplanes
    // still offers six, so the picker is present for every title here. What the
    // per-view rule means on this fixture is the LIST, asserted above: the
    // picker's contents are the view's, never a fixed superset.
    await titleSelect.selectOption('wows');
    await expect(block.getByTestId('column-picker')).toHaveCount(1);
    // The Warships All view offers exactly ONE extra — Distance — because
    // `WOWS_Ship_Statistics.csv` has five columns and four are core there.
    await expect(block.getByTestId('column-toggle-distance')).toHaveCount(1);
    await expect(toggles).toHaveCount(1);
    await expect(headers).toHaveCount(6);

    // And the picker's own state does not survive a replace: handled in the
    // `(reset)` test below, which owns the whole-freshness question.
    await titleSelect.selectOption('wot');
    await expect(block).toHaveAttribute('data-state', 'ready');
  });

  test('(drift) a core column whose header is missing reads not in export, never 0', async ({
    page,
  }) => {
    await gotoApp(page);
    // `WOT_Vehicle_Statistics.csv` with the `XP_AMOUNT` column REMOVED from the
    // header and from every cell. Everything else is the hand fixture, so the
    // five derived core columns still have their sources and only the sixth
    // drifts — which is the case the test is about: a core field the FILE does
    // not have, in a table whose other five core columns are fine.
    //
    // A column is dropped by name, not by index, so the fixture's other
    // columns keep their meaning: `XP_MAX` is a different column from
    // `XP_AMOUNT` and a slice that took the wrong one would still produce a
    // table that looks right.
    const xpIndex = WOT_MAIN_HEADER.split(';').indexOf('XP_AMOUNT');
    expect(xpIndex).toBeGreaterThan(-1);
    const names = WOT_MAIN_HEADER.split(';').filter((name) => name !== 'XP_AMOUNT');
    // The fixture's data cells are all QUOTED — `renderStatsCsv` writes
    // `"cell"` — and `renderStatsCsv` quotes again on the way out, so the
    // quotes have to come off here or every cell arrives wrapped twice and
    // `"100"` is not a number. Re-splitting the fixture's own bytes rather
    // than re-typing six rows is what keeps this export the hand fixture with
    // one column removed, and not a lookalike.
    const rows = PLAYER_STATS_SAMPLE_FILES['WOT_Vehicle_Statistics.csv']!.split('\r')
      .slice(1)
      .filter((line) => line !== '')
      .map((line) =>
        line
          .split(';')
          .map((cell) => (cell.startsWith('"') ? cell.slice(1, -1) : cell))
          .filter((_, index) => index !== xpIndex),
      );
    // The positive half of that claim: the row is sixteen cells wide before
    // the slice and fifteen after, and the values that survive are numbers.
    expect(
      PLAYER_STATS_SAMPLE_FILES['WOT_Vehicle_Statistics.csv']!.split('\r')[1]!.split(';'),
    ).toHaveLength(names.length + 1);
    expect(rows[0]?.[names.indexOf('BATTLES_COUNT')]).toBe('100');

    await importExport(
      page,
      'no-xp.zip',
      buildCustomExport({
        overrides: {
          'Player_statistics/WOT_Vehicle_Statistics.csv': renderStatsCsv(names, rows),
        },
      }),
    );
    const block = playerStatsBlock(page);
    await expect(block).toHaveAttribute('data-title-state', 'ready', { timeout: 30_000 });
    const table = block.getByTestId('vehicle-table');
    const drawn = table.getByTestId('vehicle-row');
    const expectedRows = PLAYER_STATS_EXPECTED.titles.wot.vehicleRows;
    await expect(drawn).toHaveCount(expectedRows);

    // Every row's Total XP cell reads the special, and NONE of them reads a
    // number — a column of zeros would be a claim the export never made about
    // a vehicle the player may well have earned XP in.
    const xpCells = table.locator('td.w-numeric');
    await expect(xpCells).toHaveCount(expectedRows);
    for (let index = 0; index < expectedRows; index++) {
      const cell = drawn.nth(index).locator('td').nth(5);
      expect(await visibleText(cell), `row ${index} Total XP`).toBe(VALUE_NOT_IN_EXPORT);
      await expect(cell).toHaveClass(/muted-cell/);
    }
    // The page did not error, and the rest of the table is untouched: battles,
    // win rate and average damage are all still computed, because their
    // columns ARE in the file.
    await expect(block.getByTestId('player-stats-error')).toHaveCount(0);
    await expect(block).toHaveAttribute('data-state', 'ready');
    await expect(drawn.nth(0)).toHaveAttribute('data-battles', '100');
    await expect(await visibleText(drawn.nth(0).locator('td').nth(1))).toBe('100');
    await expect(await visibleText(drawn.nth(0).locator('td').nth(2))).toBe('55.0%');
    await expect(await visibleText(drawn.nth(0).locator('td').nth(3))).toBe('1,200');

    // D-09/D-12: a special sorts LAST in both directions, and when EVERY value
    // in the column is the same special there is nothing to compare — so the
    // tie-break takes over and the table comes back in cleaned-id order, which
    // is TOTAL and therefore the same order twice. Asserting the id order
    // rather than "the order did not change" is the honest form: the previous
    // order was battles-descending, and a rule that quietly kept it would be a
    // second, invisible default.
    await table.getByTestId('vehicle-sort-xp').click();
    await expect(table.locator('th:has([data-testid="vehicle-sort-xp"])')).toHaveAttribute(
      'aria-sort',
      'descending',
    );
    const byId = [
      'A12_T29',
      'Ch24_Type64',
      'Ch99_<b>bold_markup',
      'G32_PzV_PzIV',
      'R04_T-34',
      '__proto__',
    ];
    for (const [index, id] of byId.entries()) {
      await expect(drawn.nth(index).locator('td').first()).toContainText(id);
    }
    // The other direction of the same all-special column is the same order: a
    // column with no comparable values has no direction to flip.
    await table.getByTestId('vehicle-sort-xp').click();
    await expect(table.locator('th:has([data-testid="vehicle-sort-xp"])')).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
    for (const [index, id] of byId.entries()) {
      await expect(drawn.nth(index).locator('td').first()).toContainText(id);
    }
    // And the default order is one click away, so the drift has not cost the
    // reader the ordering they opened with.
    await table.getByTestId('vehicle-sort-battles').click();
    await expect(drawn.nth(0)).toHaveAttribute('data-battles', '100');
  });
});

// =============================================================================
// 05-14 Task 3 — the phone-width and the reset, in their own imports
// =============================================================================

test.describe('the column picker at 375px (05-14 Task 3)', () => {
  test('(phone-375) with extras the page never scrolls sideways and the scroller keeps its sticky axes', async ({
    page,
  }) => {
    await gotoApp(page);
    await page.setViewportSize({ width: 375, height: 667 });
    await importExport(page, 'sample.zip', buildSampleExport());
    const block = playerStatsBlock(page);
    await expect(block).toHaveAttribute('data-title-state', 'ready', { timeout: 30_000 });

    // Every extra the WoT All view offers, so the table is as wide as it can
    // get — which is the condition under which a page-level sideways scroll is
    // possible at all.
    await openColumnPicker(block.getByTestId('column-picker'));
    for (const key of [
      'survival',
      'hitRatio',
      'maxFrags',
      'maxXp',
      'damageReceived',
      'spotted',
      'lastBattle',
    ]) {
      await block.getByTestId(`column-toggle-${key}`).check();
    }
    const table = block.getByTestId('vehicle-table');
    const scroller = block.getByTestId('vehicle-scroller');
    await expect(table.locator('th[scope="col"]')).toHaveCount(13);

    // The controls row and the per-title header must not have widened the card
    // either: the header is a `max-content 1fr` grid precisely so an expiry
    // written as a long string wraps under itself at this width.
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth, `the page widened to ${scrollWidth}px at 375px`).toBeLessThanOrEqual(375);

    // The table really is wider than its container, so the assertion above is
    // about the PAGE and this one is about the scroller doing its job.
    const overflow = await scroller.evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      minWidth: el.querySelector('table')?.style.minWidth ?? '',
    }));
    expect(overflow.scrollWidth).toBeGreaterThan(overflow.clientWidth);
    // The minimum width is the SUM of the thirteen column widths, written
    // through the CSSOM because the CSP forbids a style attribute (T-05-38).
    expect(Number.parseInt(overflow.minWidth, 10)).toBeGreaterThan(0);

    // Scroll BOTH axes, and the sticky header and first column hold their own
    // edges of the scroller. A table wider than its card is the one case where
    // losing the vehicle name would be unrecoverable, so this is the assertion
    // the whole picker exists to keep true.
    await scroller.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await scroller.evaluate((el) => {
      el.scrollTop = 100;
      el.scrollLeft = 200;
    });
    const header = table.locator('th').first();
    const firstCell = block.getByTestId('vehicle-row').first().locator('td').first();
    const gap = async (which: 'top' | 'left'): Promise<number> => {
      const scrollerBox = await scroller.boundingBox();
      const headerBox = await header.boundingBox();
      const cellBox = await firstCell.boundingBox();
      if (scrollerBox === null || headerBox === null || cellBox === null) {
        return Number.POSITIVE_INFINITY;
      }
      return which === 'top'
        ? Math.abs(headerBox.y - scrollerBox.y)
        : Math.abs(cellBox.x - scrollerBox.x);
    };
    await expect
      .poll(() => gap('top'), { message: 'the sticky header at 375px' })
      .toBeLessThanOrEqual(2);
    await expect
      .poll(() => gap('left'), { message: 'the sticky first column at 375px' })
      .toBeLessThanOrEqual(2);
    // And the corner cell is above BOTH axes, so the header label is readable
    // with the table scrolled sideways — a z-order loss is invisible to a
    // position assertion and is exactly what thirteen columns can cause.
    const corner = await header.evaluate((el) => Number(getComputedStyle(el).zIndex));
    expect(corner).toBeGreaterThanOrEqual(3);
  });
});

// =============================================================================
// 05-20 Task 3 — the battle-type table at 375px, and the card it must not widen
// =============================================================================
//
// WHY ITS OWN CONTEXT AND ITS OWN IMPORT
// The default `page` fixture is sized by the Playwright config, so a test that
// needs 375px either resizes a shared page — which every later test in the file
// would inherit — or opens its own context. This describe opens its own and
// imports ONCE, because an import is the single most expensive thing this suite
// does and the six assertions below read one already-rendered DOM.
//
// WHAT "CONTAINED" MEANS HERE, PRECISELY
// Two elements in this block are SUPPOSED to scroll sideways: the vehicle
// table's scroller and the battle-type summary's new region. A blanket
// "nothing under main overflows" assertion would fail on both and would then
// be deleted. So the walk below reports an element whose content is wider than
// its box while its own `overflow-x` is `visible` — that is, overflow that
// ESCAPES its box instead of being contained by it. A deliberate scroller has
// `overflow-x: auto` and is not reported; the defect, where the battle-type
// table pushed the whole card wider, is.
// =============================================================================

test.describe('the battle-type summary at 375px (05-20 Task 3)', () => {
  test.describe.configure({ mode: 'serial' });

  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }: { browser: Browser }) => {
    context = await browser.newContext({ viewport: { width: 375, height: 667 } });
    page = await context.newPage();
    await gotoApp(page);
    await importExport(page, 'sample.zip', buildSampleExport());
    await waitForTable(page);
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test('(phone-375) the battle-type table scrolls inside its card and nothing under main spills', async () => {
    const block = playerStatsBlock(page);

    // The region, located by ROLE and by the heading constant rather than by a
    // test id or a literal string: the name is the contract here, and asking
    // for the accessible name is what proves a screen reader gets one too.
    const region = page.getByRole('region', { name: BATTLE_TYPE_SUMMARY_HEADING });
    await expect(region).toBeVisible();
    await expect(region).toHaveAttribute('tabindex', '0');

    // It really does overflow, which is the reason it exists: four nowrap
    // columns cannot fit 293px, and a region that fits proves nothing.
    const box = await region.evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }));
    expect(box.scrollWidth).toBeGreaterThan(box.clientWidth);

    // Focusable, and a keyboard reader can move the content sideways. This is
    // the WCAG 2.1.1 point the vehicle table's scroller makes: a box that
    // scrolls but cannot take focus cannot be scrolled with the arrow keys at
    // all, and then the out-of-view columns are unreachable rather than merely
    // off screen.
    await region.focus();
    expect(
      await region.evaluate((el) => el === document.activeElement),
      'the battle-type region took focus',
    ).toBe(true);
    await page.keyboard.press('ArrowRight');
    await expect
      .poll(() => region.evaluate((el) => el.scrollLeft), {
        message: 'the battle-type region scrolls sideways with ArrowRight',
      })
      .toBeGreaterThan(0);
    await page.keyboard.press('Home');

    // Scrolling sideways does not cost a reader the headers: all four are
    // still in the table inside the region.
    await expect(region.locator('th[scope="col"]')).toHaveText(BATTLE_TYPE_SUMMARY_HEADERS);
    await expect(region.getByTestId('battle-type-row')).toHaveCount(
      PLAYER_STATS_EXPECTED.titles.wot.summaryCodes.length,
    );

    // THE CONTAINMENT ASSERTION. The card's own box decides whether anything
    // below escaped it.
    const card = await block.evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }));
    expect(card.scrollWidth, `the card widened to ${card.scrollWidth}px`).toBeLessThanOrEqual(
      card.clientWidth,
    );

    // And the page: nothing anywhere widens the document at this width.
    const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(pageWidth, `the page widened to ${pageWidth}px at 375px`).toBeLessThanOrEqual(375);

    // The generic walk: any element whose content is wider than its box while
    // its own `overflow-x` is `visible`. Each offender is NAMED, because
    // "something overflowed" does not say what to fix. The 1px slack is
    // sub-pixel rounding, which the browser reports differently on the two
    // sides of a fractional layout.
    const escapes = await page.evaluate(() => {
      const offenders: string[] = [];
      for (const el of document.querySelectorAll('main *')) {
        const style = getComputedStyle(el);
        if (style.overflowX !== 'visible') continue;
        if (el.scrollWidth <= el.clientWidth + 1) continue;
        const classes =
          typeof el.className === 'string' && el.className.trim() !== ''
            ? `.${el.className.trim().split(/\s+/).join('.')}`
            : '';
        offenders.push(
          `${el.tagName.toLowerCase()}${classes} is ${el.scrollWidth}px of content in a ${el.clientWidth}px box`,
        );
      }
      return offenders;
    });
    expect(escapes, `uncontained overflow under main:\n  ${escapes.join('\n  ')}`).toEqual([]);

    // The controls from 05-20 Task 1, measured HERE rather than only at 1280:
    // the row has to be a wrapping ROW at this width too. A `nowrap` fix would
    // pass the 1280px test and overflow the card at 375px, and this is the
    // assertion that distinguishes the two.
    const controls = block.getByTestId('player-stats-controls');
    const controlsStyle = await controls.evaluate((el) => ({
      direction: getComputedStyle(el).flexDirection,
      wrap: getComputedStyle(el).flexWrap,
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }));
    expect(controlsStyle.direction).toBe('row');
    expect(controlsStyle.wrap).toBe('wrap');
    expect(controlsStyle.scrollWidth).toBeLessThanOrEqual(controlsStyle.clientWidth);

    // And the Typography floor holds at phone width too, with the picker open
    // so the toggle labels are on screen. The 05-14 describe above already
    // proved the PAGE does not scroll sideways at this width; this is the other
    // half of G-05-10, at the width the audit measured.
    await openColumnPicker(block.getByTestId('column-picker'));
    await expect(block.getByTestId('column-toggle-survival')).toBeVisible();
    const offenders = await textUnderFloor(page.locator('main'), 14);
    expect(offenders, `text under the 14px floor at 375px:\n  ${offenders.join('\n  ')}`).toEqual(
      [],
    );
  });
});

// =============================================================================
// 05-12 Task 3 — the SCALE and the GEOMETRY, and the states the sample cannot reach
// =============================================================================
//
// WHY A SEPARATE DESCRIBE AND A SEPARATE IMPORT
// The 5,000-vehicle export is imported EXACTLY ONCE in the whole suite, and the
// four tests below read that one page. Every one of them is about the size of
// the data or the geometry of the page, neither of which the six-row sample can
// exercise: at six rows the window is always the whole list, the scroller never
// scrolls, and a sticky header has nothing to stick to.
//
// WHY THE 5,000 ANSWERS COME FROM THE ORACLE
// `vehicleScaleExpected` recomputes the first row's id from the RAW generated
// CSV with the zero-import oracle in `tests/helpers/vehicle-oracle.ts`, so the
// "the first row is the one with the largest battle count" assertion below is a
// comparison against an independent read of the same bytes. Reading the first
// row's battles out of the page and checking it is the largest IN the page would
// pass against a table that renders thirty rows and silently drops the other
// 4,970.
//
// THE BOUND, AND WHY IT IS A BOUND AND NOT A COUNT
// `aria-rowcount` is 5,001 — the header plus 5,000 — while the DOM holds at most
// about thirty rows. Those two numbers being far apart IS the windowing (D-14,
// T-05-36). A table that rendered 5,000 rows would pass the rowcount assertion
// and fail the count one; a table that rendered 5,000 and claimed 30 would pass
// the count one and fail the rowcount one.
// =============================================================================

/** The 5,000-vehicle answer key, from the zero-import oracle. */
const SCALE = vehicleScaleExpected(VEHICLE_SCALE_5K_SPEC);

/**
 * How long the 5,000-vehicle import may take from the drop to the first drawn
 * row.
 *
 * Deliberately generous: this is a BOUND against a freeze, not a performance
 * target, and a tighter figure would measure the CI runner rather than the app.
 * The same 60 s `playtime-scale.spec.ts` allows for a 60,000-session import.
 */
const SCALE_READY_BUDGET_MS = 60_000;

/** The export the scale describe imports: the sample with a 5,000-row WoT file. */
function buildScaleVehicleExport(): Uint8Array {
  return buildCustomExport({
    overrides: {
      'Player_statistics/WOT_Vehicle_Statistics.csv': generateVehicleMainCsv(VEHICLE_SCALE_5K_SPEC),
    },
  });
}

test.describe('the Vehicle statistics block at 5,000 vehicles (05-12 Task 3)', () => {
  test.describe.configure({ mode: 'serial' });

  let context: BrowserContext;
  let page: Page;
  let importToFirstRowMs = 0;

  test.beforeAll(async ({ browser }: { browser: Browser }) => {
    test.setTimeout(120_000);
    context = await browser.newContext();
    page = await context.newPage();
    await gotoApp(page);

    const started = Date.now();
    await importExport(page, 'scale.zip', buildScaleVehicleExport());
    await expect(page.getByTestId('vehicle-row').first()).toBeVisible({ timeout: 60_000 });
    importToFirstRowMs = Date.now() - started;
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test('(window) at most 30 rows in the DOM, aria-rowcount 5,001, and the oracle’s first row', async () => {
    const block = playerStatsBlock(page);
    const table = block.getByTestId('vehicle-table');
    const rows = table.getByTestId('vehicle-row');
    const scroller = block.getByTestId('vehicle-scroller');

    // D-14 / T-05-36: the DOM holds the WINDOW, not the list. The bound is
    // "at most 30" rather than an exact count because the window is a function
    // of the viewport and of the scroll offset, both of which the browser
    // rounds; the point is that it is bounded and does not scale with 5,000.
    expect(await rows.count()).toBeLessThanOrEqual(30);
    // And the table still tells the truth about its own size.
    await expect(table).toHaveAttribute('aria-rowcount', String(SCALE.rowCount + 1));
    await expect(scroller).toHaveAttribute('aria-label', formatVehicleRegionName('wot', null));

    // D-12's default order: the largest battle count first, and the ORACLE's
    // id for it, not a re-derivation from the page.
    const first = rows.first();
    await expect(first).toHaveAttribute('data-battles', String(SCALE.largestBattles));
    // The CLEANED id, because that is the cell's own text: the nation is a
    // separate chip and the id follows it, and 5,000 rows make the largest
    // battle count a tie that only the cleaned-id tie-break resolves (D-12).
    await expect(first).toContainText(SCALE.firstRowCleanId);
    // And the count line reads the whole list, not the window — 250 zero-battle
    // vehicles out of 5,000, one in every twenty.
    await expect(block.getByTestId('vehicle-count')).toHaveText(
      formatVehicleCount(SCALE.rowCount, SCALE.zeroBattleCount),
    );

    // A bounded time to the first row, reported even when a later assertion
    // fails: the number is the diagnosis.
    expect(
      importToFirstRowMs,
      `5,000 vehicles reached their first row in ${importToFirstRowMs} ms (budget ${SCALE_READY_BUDGET_MS} ms)`,
    ).toBeLessThan(SCALE_READY_BUDGET_MS);
  });

  test('(window-end) scrolling to the end draws the last rows and still at most 30', async () => {
    const block = playerStatsBlock(page);
    const rows = block.getByTestId('vehicle-table').getByTestId('vehicle-row');
    const scroller = block.getByTestId('vehicle-scroller');

    // Scroll by the scrollbar, not by setting a number: the windowing reads
    // `scrollTop`, so a synthetic offset that the element never really had
    // would test the arithmetic and not the wiring.
    await scroller.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });

    // The last drawn row is the last row of the LIST, whose `aria-rowindex` is
    // 5,001 (the header is 1). A window that clamped short would end earlier,
    // and a window that did not move would end at 18.
    await expect(rows.last()).toHaveAttribute('aria-rowindex', String(SCALE.rowCount + 1));
    expect(await rows.count()).toBeLessThanOrEqual(30);
    // The first drawn row is the one SIX ROWS of overscan above the fold, so
    // the window moved rather than redrawing from the top.
    const firstIndex = Number(await rows.first().getAttribute('aria-rowindex'));
    expect(firstIndex).toBeGreaterThan(SCALE.rowCount - 30);

    await scroller.evaluate((el) => {
      el.scrollTop = 0;
    });
  });

  test('(sort-top) every sort and a search return the scroller to the top', async () => {
    const block = playerStatsBlock(page);
    const table = block.getByTestId('vehicle-table');
    const scroller = block.getByTestId('vehicle-scroller');
    const rows = table.getByTestId('vehicle-row');

    // Research Pitfall 15: a list that SHRINKS under a stale scroll offset
    // windows onto nothing, which reads as "no data" for an account that has
    // plenty of it. So every control that re-draws the list sends the scroller
    // home.
    await scroller.evaluate((el) => {
      el.scrollTop = 4000;
    });
    expect(await scroller.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);

    for (const key of ['vehicle', 'battles', 'winRate', 'avgDamage', 'frags', 'xp']) {
      await table.getByTestId(`vehicle-sort-${key}`).click();
      expect(await scroller.evaluate((el) => el.scrollTop), `after sorting by ${key}`).toBe(0);
      // And a window that actually drew something, which is the failure the
      // offset would otherwise cause.
      expect(await rows.count(), `after sorting by ${key}`).toBeGreaterThan(0);
    }

    // The default order is back, so the first row is the oracle's again.
    await table.getByTestId('vehicle-sort-battles').click();
    await expect(rows.first()).toContainText(SCALE.firstRowCleanId);

    // A search too: 5,000 rows narrowed to a handful must not leave the window
    // at row 100.
    await scroller.evaluate((el) => {
      el.scrollTop = 8000;
    });
    await block.getByTestId('vehicle-search').fill(SCALE.firstRowCleanId);
    expect(await scroller.evaluate((el) => el.scrollTop)).toBe(0);
    await expect(rows.first()).toContainText(SCALE.firstRowCleanId);

    await block.getByTestId('vehicle-search').fill('');
    await expect(block.getByTestId('vehicle-count')).toHaveText(
      formatVehicleCount(SCALE.rowCount, SCALE.zeroBattleCount),
    );
  });

  test('(sticky) the header and the first column hold at both widths', async () => {
    const block = playerStatsBlock(page);
    const scroller = block.getByTestId('vehicle-scroller');
    const header = block.getByTestId('vehicle-table').locator('th').first();
    const firstCell = block.getByTestId('vehicle-row').first().locator('td').first();

    for (const size of [
      { width: 1280, height: 720 },
      { width: 375, height: 667 },
    ]) {
      await page.setViewportSize(size);
      // Put the table ON SCREEN first. A sticky element's position is a
      // function of where its scroll container is relative to the viewport, and
      // a container that is entirely below the fold has a header that is too —
      // so measuring before scrolling the page to the table would be measuring
      // a layout the reader never sees.
      await scroller.evaluate((el) => el.scrollIntoView({ block: 'center' }));
      // Then scroll the TABLE sideways and downwards, which is the gesture
      // that would expose a header that has stopped sticking or a first column
      // that has scrolled off.
      await scroller.evaluate((el) => {
        el.scrollTop = 2000;
        el.scrollLeft = 200;
      });

      // POLLED, not read once. Sticky offsets are resolved at paint, and
      // `boundingBox()` forces layout without forcing one — so a single read
      // taken between the scroll and the next frame catches a header that has
      // not been repositioned yet, which is a measurement artefact rather than
      // a fault. A null box is the same class of artefact (an element the
      // browser has not laid out yet), so the poll treats it as "not settled"
      // rather than dereferencing it.
      const gap = async (which: 'top' | 'left'): Promise<number> => {
        const scrollerBox = await scroller.boundingBox();
        const headerBox = await header.boundingBox();
        const cellBox = await firstCell.boundingBox();
        if (scrollerBox === null || headerBox === null || cellBox === null) {
          return Number.POSITIVE_INFINITY;
        }
        return which === 'top'
          ? Math.abs(headerBox.y - scrollerBox.y)
          : Math.abs(cellBox.x - scrollerBox.x);
      };

      // Two pixels of tolerance: the scroller's own 1px border, plus a
      // subpixel from the fractional layout the browser rounds. The header
      // stays at the TOP EDGE OF THE SCROLLER, not at the top of the page: a
      // sticky element inside an `overflow` container sticks to that container
      // (RESEARCH Pitfall 6). And the first column stays at its LEFT edge,
      // which is the point of pinning it: a row scrolled sideways has lost its
      // vehicle name otherwise.
      // One poll per axis, so a failure says WHICH axis drifted rather than
      // "the poll timed out".
      await expect
        .poll(() => gap('top'), { message: `the sticky header at ${size.width}px` })
        .toBeLessThanOrEqual(2);
      await expect
        .poll(() => gap('left'), { message: `the sticky first column at ${size.width}px` })
        .toBeLessThanOrEqual(2);

      // The nav is a sticky sibling higher up the page, and the table must
      // never end up UNDER it: a header under the nav is unreadable and
      // unreachable with the keyboard.
      // How far the table's top edge sits ABOVE the nav's bottom edge: zero
      // or less means the nav is clear of it. A box the browser has not laid
      // out yet reads as `Number.POSITIVE_INFINITY` so the poll keeps waiting
      // rather than dereferencing null.
      const navOverlap = async (): Promise<number> => {
        const navBox = await page.getByTestId('dashboard-nav').boundingBox();
        const scrollerBox = await scroller.boundingBox();
        if (navBox === null || scrollerBox === null) return Number.POSITIVE_INFINITY;
        return navBox.y + navBox.height - scrollerBox.y;
      };
      await expect
        .poll(navOverlap, { message: `the nav clears the table at ${size.width}px` })
        .toBeLessThanOrEqual(2);
    }

    await scroller.evaluate((el) => {
      el.scrollTop = 0;
      el.scrollLeft = 0;
    });
  });
});

test.describe('the Vehicle statistics block: the states and the privacy rule (05-12 Task 3)', () => {
  test('(privacy) the account nickname from the stats files is nowhere on the page', async ({
    page,
  }) => {
    await gotoApp(page);
    await importExport(page, 'sample.zip', buildSampleExport());
    await waitForTable(page);

    // D-13 / T-05-12c: the account `NAME` column is the nickname, and Phase 3
    // confines it to the identity header. `STATS_NAME_CANARY` is written into
    // every `*_Account_Statistics.csv` of the hand fixture, so its absence from
    // the page is a statement about the whole Player_statistics folder rather
    // than about one file.
    //
    // The TEXT of the page, and every attribute, because either alone is
    // incomplete: a `title` attribute or a `data-` hook would carry the string
    // without a reader ever seeing it, and a reader who saw it is the failure
    // this is here for.
    const canary = STATS_NAME_CANARY;
    const found = await page.evaluate((needle) => {
      if ((document.body.textContent ?? '').includes(needle)) return 'text content';
      for (const element of document.querySelectorAll('*')) {
        for (const attribute of element.attributes) {
          if (attribute.value.includes(needle)) {
            return `${element.tagName}[${attribute.name}]`;
          }
        }
      }
      return null;
    }, canary);
    expect(found, `the account canary reached the page as ${found}`).toBeNull();
  });

  test('(states) a folder holding one title marks the other three absent, and an empty title says so', async ({
    page,
  }) => {
    await gotoApp(page);
    // Only the WoT main file: the other three titles have NO file at all, which
    // is D-05's `not-in-export` and is a DIFFERENT fact from a file that is
    // present with no rows.
    // The paths are RELATIVE TO THE ACCOUNT ROOT, folder included, which is
    // the same shape `overrides` uses and the reason one option covers both
    // kinds of edit.
    const wotOnly = buildCustomExport({
      omitFiles: Object.keys(PLAYER_STATS_SAMPLE_FILES)
        .filter((name) => name !== 'WOT_Vehicle_Statistics.csv')
        .map((name) => `Player_statistics/${name}`),
    });
    await importExport(page, 'wot-only.zip', wotOnly);
    const block = playerStatsBlock(page);
    await expect(block).toHaveAttribute('data-title-state', 'ready', { timeout: 30_000 });

    const select = block.getByTestId('player-stats-title-selector');
    // The options KEEP all four titles, with the reason in the text, and are
    // never disabled — otherwise the reason would be unreadable in the content
    // area.
    await expect(select.locator('option')).toHaveCount(4);
    await expect(select.locator('option[value="wot"]')).toHaveText(
      formatTitleOption('wot', 'ready'),
    );
    for (const title of ['wotb', 'wows', 'wowp'] as const) {
      await expect(select.locator(`option[value="${title}"]`)).toHaveText(
        formatTitleOption(title, 'not-in-export'),
      );
    }
    await expect(select.locator('option[disabled]')).toHaveCount(0);

    // Choosing an absent title shows its ONE neutral line and no table.
    await select.selectOption('wowp');
    await expect(block).toHaveAttribute('data-state', 'ready');
    await expect(block).toHaveAttribute('data-title-state', 'not-in-export');
    await expect(block.getByTestId('player-stats-title-state')).toHaveText(
      formatTitleNotInExport(VEHICLE_TITLE_LABELS.wowp),
    );
    await expect(block.getByTestId('vehicle-table')).toHaveCount(0);
    await expect(block.getByTestId('vehicle-count')).toHaveCount(0);
    // And nothing is announced for a table that does not exist.
    await expect(block.getByTestId('player-stats-status')).toHaveText('');
  });

  test('(states) a header-only vehicle file is "no rows", not "not in this export"', async ({
    page,
  }) => {
    await gotoApp(page);
    // A header and no data rows, and NOBODY ELSE'S EITHER — so the other three
    // titles are out of scope here and the only question is whether WoT, whose
    // file is PRESENT with nothing in it, reads `no-rows`.
    //
    // The file's presence is the whole claim: it is not absent — the game
    // granted nothing, which is a different problem for the reader from a
    // game that was never exported, and only the second of the two is fixed by
    // a wider export range (D-02's rule, applied to a title).
    //
    // The WoT ACCOUNT file stays, with its one hand row, and it is load
    // bearing: the SECTION is `ready` when the folder holds at least one
    // parsed row, and a folder of nothing but header-only files reads `empty`
    // and renders no block at all — which would leave this state untestable
    // from the only place a reader can reach it.
    const emptyMain = buildCustomExport({
      omitFiles: Object.keys(PLAYER_STATS_SAMPLE_FILES)
        .filter((name) => !name.startsWith('WOT_Account_'))
        .map((name) => `Player_statistics/${name}`),
      overrides: {
        'Player_statistics/WOT_Vehicle_Statistics.csv': renderStatsCsv(WOT_MAIN_HEADER, []),
      },
    });
    await importExport(page, 'empty-wot.zip', emptyMain);
    const block = playerStatsBlock(page);
    await expect(block).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });

    const select = block.getByTestId('player-stats-title-selector');
    // The worker falls back to WoT when no title has rows (D-05), and the
    // option says `no rows`, never `not in this export`.
    await expect(select).toHaveValue('wot');
    await expect(select.locator('option[value="wot"]')).toHaveText(
      formatTitleOption('wot', 'no-rows'),
    );
    await expect(block).toHaveAttribute('data-title-state', 'no-rows');
    await expect(block.getByTestId('player-stats-title-state')).toHaveText(
      formatTitleNoRows(VEHICLE_TITLE_LABELS.wot),
    );
    await expect(block.getByTestId('vehicle-table')).toHaveCount(0);
    // D-13: the header is about the ACCOUNT file, which is a different file
    // from the header-only vehicle one, so it is still real and still shown.
    // Hiding it here would tell a reader that the game never granted them
    // anything, which is a different and false claim from "this export holds
    // no rows for WoT".
    await expect(block.getByTestId('player-stats-header')).toHaveCount(1);
    await expect(block.getByTestId('lifetime-battles')).toHaveText(
      formatNumber(PLAYER_STATS_EXPECTED.titles.wot.battlesSum),
    );
    await expect(block.getByTestId('premium-expires')).toHaveText(WOT_PREMIUM_EXPIRY);
  });

  test('(long-text) an 80-character unbroken id is ellipsised and never widens the page', async ({
    page,
  }) => {
    await gotoApp(page);
    // One vehicle whose cleaned id is 80 unbroken characters — no spaces, no
    // hyphens, nothing for the browser to break at. A cell that is not
    // ellipsised would push the whole table, the scroller's min width and the
    // page to 720px+ (T-05-35, D-11).
    const longId = 'A'.repeat(80);
    const longRow = [
      `germany:${longId}`,
      '2021-09-30 18:00:00',
      '100',
      '55',
      '120000',
      '150',
      '90000',
      '40',
      '800',
      '1000',
      '6',
      '2100',
      '90000',
      '120',
      '',
      '',
    ];
    await importExport(
      page,
      'long-id.zip',
      buildCustomExport({
        overrides: {
          'Player_statistics/WOT_Vehicle_Statistics.csv': renderStatsCsv(WOT_MAIN_HEADER, [
            longRow,
          ]),
        },
      }),
    );
    const block = playerStatsBlock(page);
    await expect(block).toHaveAttribute('data-title-state', 'ready', { timeout: 30_000 });

    const cell = block.getByTestId('vehicle-row').first().locator('td').first();
    // The FULL text is in `title`, because the cell shows one line.
    await expect(cell).toHaveAttribute('title', longId);
    await expect(cell).toContainText(longId);

    for (const width of [720, 375]) {
      await page.setViewportSize({ width, height: 800 });
      // The page must not scroll sideways at either width. The table scrolls
      // INSIDE its own scroller and the page never does (D-14).
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(scrollWidth, `the page widened to ${scrollWidth}px at ${width}px`).toBeLessThanOrEqual(
        width,
      );
      // And the cell really is clipped rather than merely narrow: the text is
      // wider than the box it is in.
      const clipped = await cell.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
      expect(clipped, `the id is not ellipsised at ${width}px`).toBe(true);
    }
  });

  test('(header) no account row omits the header, and a missing column reads not in export', async ({
    page,
  }) => {
    await gotoApp(page);
    // TWO exports, and the pair is the whole claim. They differ only in the
    // account file, and they produce OPPOSITE rendering of the same header:
    //
    //   1. Blitz's account file is present but holds no data row. A file that
    //      says nothing is not a header, so the header is OMITTED — not
    //      rendered with `not in export` and not rendered empty. The omission
    //      is a property of the ANSWER (`header === null`), not a second list
    //      of titles kept in the component.
    //   2. WoT's account file has a row but neither of the two columns. That
    //      IS a header, and both cells read `not in export` — the reading the
    //      builder gives a column it looked for and did not find, and never a
    //      zero (D-09).
    //
    // The header-only account file parses to zero rows, which is the case the
    // stored file-presence fact exists for (05-07): without it, a file that is
    // present with nothing in it would be indistinguishable from one absent.
    await importExport(
      page,
      'account-header-only.zip',
      buildCustomExport({
        overrides: {
          'Player_statistics/WOTB_Account_Statistics.csv': headerOnly(
            'WOTB_Account_Statistics.csv',
          ),
        },
      }),
    );
    const block = playerStatsBlock(page);
    await expect(block).toHaveAttribute('data-title-state', 'ready', { timeout: 30_000 });

    const select = block.getByTestId('player-stats-title-selector');
    await select.selectOption('wotb');
    await expect(block).toHaveAttribute('data-state', 'ready');
    await expect(block.getByTestId('player-stats-header')).toHaveCount(0);
    // The table is still there, because the omission is about the header and
    // nothing else: a reader who has vehicles has not lost them.
    await expect(block.getByTestId('vehicle-table')).toHaveCount(1);

    // The second export, on the same page: the account file with a row and
    // neither column. A different archive, so this is a replace rather than a
    // same-bytes duplicate.
    await replaceExport(
      page,
      'account-missing-columns.zip',
      buildCustomExport({
        overrides: {
          'Player_statistics/WOT_Account_Statistics.csv': renderStatsCsv('NAME', [
            [STATS_NAME_CANARY],
          ]),
        },
      }),
    );
    await expect(block).toHaveAttribute('data-title-state', 'ready', { timeout: 30_000 });
    await select.selectOption('wot');
    await expect(block).toHaveAttribute('data-state', 'ready');
    await expect(block.getByTestId('player-stats-header')).toHaveCount(1);
    await expect(block.getByTestId('lifetime-battles')).toHaveText(VALUE_NOT_IN_EXPORT);
    await expect(block.getByTestId('premium-expires')).toHaveText(VALUE_NOT_IN_EXPORT);
    // The rule D-09 exists to enforce: a value the export did not give is
    // never rendered as a number, and a header is no exception to it.
    await expect(block.getByTestId('player-stats-header')).not.toContainText('0');
    // The nickname is still confined to the identity header (T-05-12c), and
    // this export wrote it into the ONE column the account file is read for.
    await expect(block.getByTestId('player-stats-header')).not.toContainText(STATS_NAME_CANARY);
  });

  test('(reset) a replace and a clear both put every control back to its default', async ({
    page,
  }) => {
    await gotoApp(page);
    await importExport(page, 'sample.zip', buildSampleExport());
    const block = playerStatsBlock(page);
    await expect(block).toHaveAttribute('data-title-state', 'ready', { timeout: 30_000 });

    const select = block.getByTestId('player-stats-title-selector');
    const battleType = block.getByTestId('player-stats-battle-type-selector');
    const search = block.getByTestId('vehicle-search');
    const table = block.getByTestId('vehicle-table');
    const rows = table.getByTestId('vehicle-row');
    const headers = table.locator('th[scope="col"]');

    // Put EVERY selector somewhere it would be visible if it survived: another
    // title, a battle type, a non-default sort, two extra columns and a query
    // that narrows the list to one row. 05-14 added the battle type and the
    // extras, and a reset test that only exercises the three 05-12 owned would
    // pass against a picker that survived every replace.
    await select.selectOption('wotb');
    await expect(select).toHaveValue('wotb');
    // Code 3, not code 1: the hand fixture puts `R12_Blitz` under Blitz battle
    // type 3 and `blitz_alpha` under type 1, so code 1 would leave a query that
    // matches nothing and the no-match message would stand in for the table.
    await battleType.selectOption('3');
    await expect(battleType).toHaveValue('3');
    await table.getByTestId('vehicle-sort-vehicle').click();
    await openColumnPicker(block.getByTestId('column-picker'));
    await block.getByTestId('column-toggle-survival').check();
    await block.getByTestId('column-toggle-spotted').check();
    await expect(headers).toHaveCount(8);
    // `R12_Blitz` is the one row under Blitz code 3, so the filter narrows the
    // list to exactly one and a SURVIVING query would be obvious. It is also
    // the one Blitz name with a nation prefix, so this doubles as a check that
    // the search is over the CLEANED id and the prefix is not required.
    await search.fill('R12_Blitz');
    await expect(rows).toHaveCount(1);

    // D-28: a dataset replace resets everything. A different archive, so
    // fflate's mtime stamp cannot make the two byte-identical and the
    // duplicate path is not what is under test.
    await replaceExport(
      page,
      'replacement.zip',
      buildCustomExport({ omitFolders: ['Payment_history'] }),
    );
    await expect(block).toHaveAttribute('data-title-state', 'ready', { timeout: 30_000 });
    await expect(select).toHaveValue('wot');
    await expect(search).toHaveValue('');
    await expect(table.locator('th:has([data-testid="vehicle-sort-battles"])')).toHaveAttribute(
      'aria-sort',
      'descending',
    );
    // 05-14's two: the battle type is back to All battles and every extra is
    // back to unchecked, with the table six columns wide again.
    await expect(battleType).toHaveValue('');
    await expect(block.getByTestId('column-toggle-survival')).not.toBeChecked();
    await expect(block.getByTestId('column-toggle-spotted')).not.toBeChecked();
    await expect(headers).toHaveCount(6);
    // The default sort really is in effect, not just declared: the first row
    // has the largest battle count.
    await expect(rows.first()).toHaveAttribute('data-battles', String(WOT_BATTLES[WOT_ORDER[0]!]));

    // Set them all again, then CLEAR. The block is discarded with the section
    // (D-28), so a re-import is a fresh component with nothing to migrate.
    // Warships code 2, whose by_Type file has a `SURVIVED` column and so a
    // `survival` extra — and NOT a `DISTANCE` one, which lives only in the
    // All-battles file. Picking the extra this view actually has is the point:
    // a key the view lacks is neither offered nor drawn, so asking for it here
    // would test nothing.
    await select.selectOption('wows');
    await battleType.selectOption('2');
    await expect(battleType).toHaveValue('2');
    await expect(block.getByTestId('column-toggle-distance')).toHaveCount(0);
    await table.getByTestId('vehicle-sort-vehicle').click();
    await openColumnPicker(block.getByTestId('column-picker'));
    await block.getByTestId('column-toggle-survival').check();
    // A query that matches nothing, so the no-match message is on screen and a
    // SURVIVING query would be obvious without reading the count line.
    await search.fill('no-such-vehicle');
    await expect(block.getByTestId('vehicle-no-match')).toBeVisible();
    await startOver(page);
    await importExport(page, 'again.zip', buildSampleExport());
    await expect(block).toHaveAttribute('data-title-state', 'ready', { timeout: 30_000 });
    await expect(select).toHaveValue('wot');
    await expect(search).toHaveValue('');
    await expect(battleType).toHaveValue('');
    await expect(block.getByTestId('column-toggle-survival')).not.toBeChecked();
    await expect(headers).toHaveCount(6);
    await expect(table.locator('th:has([data-testid="vehicle-sort-battles"])')).toHaveAttribute(
      'aria-sort',
      'descending',
    );
    await expect(rows.first()).toHaveAttribute('data-battles', String(WOT_BATTLES[WOT_ORDER[0]!]));
  });
});
