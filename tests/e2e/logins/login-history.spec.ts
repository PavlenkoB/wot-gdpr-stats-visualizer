import '../_support/pin-locale';
import { expect, test, type Page } from '@playwright/test';
import {
  SYNTHETIC_ZIP_NAME,
  failLoginsQuery,
  gotoApp,
  importAndOpen,
  loginHistoryBlock,
  openSection,
  replaceExport,
  startOver,
} from '../_support/helpers.ts';
import {
  LOGINS_HAND_KEY,
  LOGINS_IP_HOME,
  LOGINS_IP_THIRD,
  LOGINS_IP_WORK,
  buildLoginsHandExport,
} from '../../fixtures/logins-fixtures.ts';
import { buildCustomExport } from '../../fixtures/export-fixtures.ts';
import {
  buildRealShapeCsv,
  type RealShapeRow,
} from '../../fixtures/playtime-real-shape-fixture.ts';
import {
  LOGIN_HISTORY_ERROR,
  LOGIN_HISTORY_LOADING,
  LOGIN_HISTORY_NO_SOURCE,
  LOGIN_HISTORY_NO_USABLE,
  LOGIN_COL_COUNTRY,
  LOGIN_MULTI_FILE_NOTE,
  LOGIN_TILE_COUNTRIES,
  LOGIN_TILE_IPS,
  LOGIN_TILE_RANGE,
  LOGIN_TILE_TOP_COUNTRY,
  LOGIN_TILE_TOP_IP,
  LOGIN_TILE_UNKNOWN,
  LOGIN_UNKNOWN_COUNTRY,
  MASK_ANNOUNCE_MASKED,
  MASK_ANNOUNCE_SHOWN,
  MASK_TOGGLE_HIDE,
  MASK_TOGGLE_SHOW,
  SECTION_NOTE_PENDING,
  formatLoginDateRange,
  formatLoginExcludedPill,
  formatLoginShareLine,
  formatNumber,
} from '../../../src/lib/ui-copy.ts';
import { maskIp } from '../../../src/lib/geo/ip.ts';

// =============================================================================
// Phase 06, plan 06-08 — the Login history BLOCK, in a real browser
// =============================================================================
//
// WHY A BROWSER SPEC AND NOT A UNIT TEST
// Vitest has no DOM, and every claim in this file is about what a user SEES:
// a state name on an element, a masked address in a tile, one click changing
// the label, and — the reason the block exists at all — the guarantee that no
// full address is anywhere in the page while the mask is on. None of that
// exists until a component renders, so the instrument has to be a browser.
//
// WHY THE ADDRESSES ARE LITERALS
// Every expected value comes from `tests/fixtures/logins-fixtures.ts`, whose
// answer key was derived BY HAND from nine rows and proved against an
// INDEPENDENT oracle that shares no primitive with the aggregator. The masked
// form is computed here through the app's OWN `maskIp` rather than retyped, so
// a change to the mask rule is a deliberate change to this expectation. Every
// SENTENCE is imported from `src/lib/ui-copy.ts` for the same reason: this
// file retypes no copy, so a wording change fails here as a change to the
// expectation rather than passing against a stale literal.
//
// D-17 holds literally: all three addresses are RFC 5737 documentation
// blocks, and the browser suite only sees countries because
// `playwright.config.ts` is the one place in the repository that selects the
// committed geo fixture table.
// =============================================================================

/** The nine hand rows as the export the app actually reads. */
const HAND_EXPORT = buildLoginsHandExport();

/** Every full address the fixture contains. The privacy assertions read this. */
const FULL_ADDRESSES = [LOGINS_IP_HOME, LOGINS_IP_WORK, LOGINS_IP_THIRD];

/**
 * An `Activity_history` that is present and populated but carries no file that
 * can hold an address — the `no-source` case (D-10's two empty states must
 * stay apart).
 *
 * The sample's own two invented files are OMITTED rather than overridden, and
 * a third, unrelated file takes their place. It has a header and rows, so the
 * SECTION is `ready` and the block is mounted at all — a `no-source` block
 * behind a greyed card would assert nothing about the block.
 */
const NO_SOURCE_EXPORT = buildCustomExport({
  omitFiles: ['Activity_history/Sessions.csv', 'Activity_history/Logins.csv'],
  overrides: {
    'Activity_history/Clan_Stats.csv': '\r\nNAME;MEMBERS\r\nRavens;4\r\n',
  },
});

/**
 * A session file whose every address is unreadable — the `no-usable` case.
 *
 * A blank cell and a zero-padded octet, the same two shapes the hand fixture
 * hides among readable rows. Here they are all there is, so the file EXISTS
 * and no row could be read: a different fact from `no-source`, and the UI-SPEC
 * gives it a different sentence for exactly that reason.
 */
const UNREADABLE_ROWS: readonly RealShapeRow[] = [
  ['13.03.2019 20:00', '13.03.2019 21:00', ''],
  ['14.03.2019 23:30', '15.03.2019 00:30', '192.0.2.010'],
];

const NO_USABLE_EXPORT = buildCustomExport({
  omitFiles: ['Activity_history/Sessions.csv', 'Activity_history/Logins.csv'],
  overrides: { 'Activity_history/WOT_Game_Sessions.csv': buildRealShapeCsv(UNREADABLE_ROWS) },
});

/** One file, so no multi-file note (D-01). The hand fixture has two. */
const SINGLE_FILE_EXPORT = buildCustomExport({
  omitFiles: ['Activity_history/Sessions.csv', 'Activity_history/Logins.csv'],
  overrides: {
    'Activity_history/WOT_Game_Sessions.csv': buildRealShapeCsv([
      ['13.03.2019 20:00', '13.03.2019 21:30', LOGINS_IP_HOME],
      ['14.03.2019 23:30', '15.03.2019 00:30', LOGINS_IP_WORK],
    ]),
  },
});

/**
 * Delay every `logins` channel query AFTER the first, by `ms`.
 *
 * The two states that can only be seen while an answer is in flight are
 * `loading` and the race where a replace lands mid-query, and neither is
 * reachable without making an answer late. This is the real seam and not a stub
 * of the worker: it wraps `Worker.prototype.postMessage` and defers the
 * message, so the real worker runs, really parses, and really answers — the
 * page simply has not heard yet.
 *
 * `afterFirst` exists because the REPLACE case needs the FIRST import to
 * answer normally: the state under test is the one a second, later answer
 * leaves behind, and a patch that delayed everything would leave the first
 * import stuck in `loading` and make the case meaningless.
 *
 * MUST be called before the first navigation, because the worker is spawned
 * during module init and the client posts through the prototype this wraps.
 */
async function delayLoginsQueriesAfter(page: Page, afterFirst: number, ms: number): Promise<void> {
  await page.addInitScript(
    ({ after, delay }) => {
      const original = Worker.prototype.postMessage;
      let seen = 0;
      Worker.prototype.postMessage = function patched(
        this: Worker,
        message: unknown,
        ...rest: unknown[]
      ) {
        const query =
          typeof message === 'object' && message !== null
            ? (message as { type?: unknown; query?: { channel?: unknown } })
            : null;
        const isLogins = query?.type === 'data-query' && query.query?.channel === 'logins';
        if (!isLogins) {
          original.apply(this, [message, ...rest] as never);
          return;
        }
        seen += 1;
        if (seen <= after) {
          original.apply(this, [message, ...rest] as never);
          return;
        }
        // `structuredClone` rather than the original object: a caller may reuse
        // or mutate the message after posting, and the delay is long enough for
        // that to matter.
        const copy = structuredClone(message);
        window.setTimeout(() => {
          original.apply(this, [copy, ...rest] as never);
        }, delay);
      };
    },
    { after: afterFirst, delay: ms },
  );
}

/** The whole document as one selection, which is what a reader would copy. */
async function selectedText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const range = document.createRange();
    range.selectNodeContents(document.body);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    return selection?.toString() ?? '';
  });
}

/**
 * Every attribute value, on every element of the open pane AND of the shell
 * beside it, that contains one of the given addresses (`name=address`).
 *
 * The walk root used to be the block alone. Since the master-detail shell the
 * block sits in a detail pane next to a list pane, under an identity header, and
 * a leak in that surrounding chrome (a row `title`, an `aria-label`, a `data-*`)
 * would be as much a disclosure as one inside the block. So the roots are the
 * block, the detail pane, the list pane and the header, each proven present first
 * so the walk cannot pass by visiting nothing, and each walked together with the
 * root element's own attributes.
 */
async function attributeHitsAround(page: Page, addresses: readonly string[]): Promise<string[]> {
  const roots = [
    loginHistoryBlock(page),
    page.getByTestId('detail-pane'),
    page.getByTestId('list-pane'),
    page.getByTestId('identity-header'),
  ];
  const hits: string[] = [];
  for (const root of roots) {
    await expect(root).toHaveCount(1);
    hits.push(
      ...(await root.evaluate((element, list) => {
        const found: string[] = [];
        for (const node of [element, ...element.querySelectorAll('*')]) {
          for (const name of node.getAttributeNames()) {
            const value = node.getAttribute(name) ?? '';
            for (const address of list) {
              if (value.includes(address)) found.push(`${name}=${address}`);
            }
          }
        }
        return found;
      }, addresses)),
    );
  }
  return hits;
}

test('tracer: import, a masked Most-used address, and one click that reveals it', async ({
  page,
}) => {
  await gotoApp(page);
  await importAndOpen(page, SYNTHETIC_ZIP_NAME, HAND_EXPORT, 'login-history');

  const block = loginHistoryBlock(page);
  await expect(block).toHaveAttribute('data-state', 'ready');

  // The count tile: three distinct readable addresses. The Account record is
  // not a login and is not counted (D-02), and the two unreadable rows
  // (a blank cell and a zero-padded octet) are counted nowhere (D-06).
  await expect(page.getByTestId('login-tile-ips')).toHaveText(formatNumber(3));

  // The fact tile shows the MASKED form of the most-used address, and the
  // mask is on because nothing revealed it.
  const topIp = page.getByTestId('login-tile-top-ip');
  await expect(topIp).toHaveText(maskIp(LOGINS_IP_HOME));
  const toggle = page.getByTestId('login-mask-toggle');
  await expect(toggle).toHaveAttribute('data-masked', 'true');
  await expect(toggle).toHaveText(MASK_TOGGLE_SHOW);

  // One click. The label swaps and there is no `aria-pressed` to keep in step
  // with it (06-UI-SPEC section 3, a11y Decision).
  await toggle.click();
  await expect(toggle).toHaveAttribute('data-masked', 'false');
  await expect(toggle).toHaveText(MASK_TOGGLE_HIDE);
  await expect(topIp).toHaveText(LOGINS_IP_HOME);
  // Focus stays on the button: it is never re-created, only re-labelled.
  await expect(toggle).toBeFocused();

  // Back to masked, and the DOM holds the masked string only.
  await toggle.click();
  await expect(toggle).toHaveAttribute('data-masked', 'true');
  await expect(topIp).toHaveText(maskIp(LOGINS_IP_HOME));
});

test('the Activity card no longer promises a dashboard, and the block is its reason', async ({
  page,
}) => {
  await gotoApp(page);
  await importAndOpen(page, SYNTHETIC_ZIP_NAME, HAND_EXPORT, 'login-history');
  const card = page.getByTestId('dashboard-section-activity-history');
  await expect(loginHistoryBlock(page)).toHaveAttribute('data-state', 'ready');
  // The placeholder element is gone with the component that carried it.
  await expect(page.getByTestId('login-history-placeholder')).toHaveCount(0);
  await expect(card).not.toContainText(SECTION_NOTE_PENDING);
});

test('while masked, no full address exists anywhere on the page (D-07, T-06-28)', async ({
  page,
}) => {
  await gotoApp(page);
  await importAndOpen(page, SYNTHETIC_ZIP_NAME, HAND_EXPORT, 'login-history');
  const block = loginHistoryBlock(page);
  await expect(block).toHaveAttribute('data-state', 'ready');

  const titleBefore = await page.title();

  // The DOM text, the whole of it.
  const html = await page.evaluate(() => document.body.innerHTML);
  for (const address of FULL_ADDRESSES) {
    expect(html).not.toContain(address);
  }

  // The document title, which this page never sets and must keep not setting.
  expect(await page.title()).toBe(titleBefore);

  // No ATTRIBUTE anywhere in the block carries one either: a `title`,
  // an `aria-label`, a `data-*`. The check walks every element of the block, of
  // the detail pane around it, of the list pane beside it and of the header,
  // rather than the innerHTML, because an attribute value is not text and
  // would not appear in the string above.
  expect(await attributeHitsAround(page, FULL_ADDRESSES)).toEqual([]);

  // And the reveal really is the only way an address appears.
  await page.getByTestId('login-mask-toggle').click();
  const revealedHtml = await page.evaluate(() => document.body.innerHTML);
  expect(revealedHtml).toContain(LOGINS_IP_HOME);
});

// =============================================================================
// Plan 06-08 Task 3 — the states, the reset rules and the masked surfaces
// =============================================================================

test('the six tiles show the answer key values, with the note under the counts', async ({
  page,
}) => {
  await gotoApp(page);
  await importAndOpen(page, SYNTHETIC_ZIP_NAME, HAND_EXPORT, 'login-history');
  await expect(loginHistoryBlock(page)).toHaveAttribute('data-state', 'ready');

  // Three counts. The Account record is not a login and is not counted (D-02);
  // the two unreadable rows are counted nowhere (D-06).
  await expect(page.getByTestId('login-tile-ips')).toHaveText(formatNumber(3));
  await expect(page.getByTestId('login-tile-countries')).toHaveText(formatNumber(2));
  await expect(page.getByTestId('login-tile-unknown')).toHaveText(formatNumber(1));

  // Three facts. The address is masked; the country is its English name
  // whatever the viewer's locale (D-11); the range is date-only with no
  // timezone shift (D-03).
  await expect(page.getByTestId('login-tile-top-ip')).toHaveText(maskIp(LOGINS_IP_HOME));
  await expect(page.getByTestId('login-tile-top-country')).toHaveText('Germany');
  // `formatLoginDateRange` answers `null` rather than a dash when an end is
  // missing — a choice the COMPONENT makes, not the formatter — so the null
  // case is asserted here and the rendered value is only compared once it is
  // known to be a string.
  const range = formatLoginDateRange(LOGINS_HAND_KEY.first, LOGINS_HAND_KEY.last);
  expect(range, 'the answer key has both ends of a range').not.toBeNull();
  if (range !== null) {
    await expect(page.getByTestId('login-tile-range')).toHaveText(range);
  }

  // The six labels, from ui-copy. A tile whose `dt` went missing would leave
  // the reader a number with nothing to say what it counts.
  await expect(page.getByTestId('login-summary-counts')).toContainText(LOGIN_TILE_IPS);
  await expect(page.getByTestId('login-summary-counts')).toContainText(LOGIN_TILE_COUNTRIES);
  await expect(page.getByTestId('login-summary-counts')).toContainText(LOGIN_TILE_UNKNOWN);
  await expect(page.getByTestId('login-summary-facts')).toContainText(LOGIN_TILE_TOP_IP);
  await expect(page.getByTestId('login-summary-facts')).toContainText(LOGIN_TILE_TOP_COUNTRY);
  await expect(page.getByTestId('login-summary-facts')).toContainText(LOGIN_TILE_RANGE);

  // Both share tiles read the same denominator, so the two percentages on
  // screen cannot disagree (D-10).
  const share = formatLoginShareLine(3, 7);
  await expect(page.getByTestId('login-tile-top-ip-share')).toHaveText(share);
  await expect(page.getByTestId('login-tile-top-country-share')).toHaveText(share);

  // D-01's note, because the hand fixture is TWO session files and both sets
  // of rows are counted.
  await expect(page.getByTestId('login-multi-file-note')).toHaveText(LOGIN_MULTI_FILE_NOTE);

  // The Countries tile and the table agree (quick 261009-0qw). The tile counts
  // the distinct NAMED country cells of the login rows. The pinned Account
  // record row carries its own country (the account file's recorded value) but
  // is never counted in a tile (Phase 6 D-02), so it is outside that set by
  // construction. The distinct-cell comparison is valid only because the table
  // is windowed to a few dozen rows and this fixture renders every row.
  const cells = await page.getByTestId('login-table').evaluate((table, countryHeader) => {
    const headers = Array.from(table.querySelectorAll('thead th'));
    const col = headers.findIndex(
      (th) => th.querySelector('button span')?.textContent?.trim() === countryHeader,
    );
    // The cell's own text, never its visually hidden span.
    const own = (tr: Element): string => {
      const td = tr.querySelectorAll('td')[col];
      return Array.from(td?.childNodes ?? [])
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.textContent ?? '')
        .join('')
        .trim();
    };
    return {
      col,
      login: Array.from(table.querySelectorAll('[data-testid="login-row"]')).map(own),
      account: Array.from(table.querySelectorAll('[data-testid="login-account-row"]')).map(own),
    };
  }, LOGIN_COL_COUNTRY);
  expect(cells.col, 'the Country column is found by its header').toBeGreaterThanOrEqual(0);
  const namedLoginCountries = new Set(
    cells.login.filter((name) => name !== '' && name !== LOGIN_UNKNOWN_COUNTRY),
  );
  await expect(page.getByTestId('login-tile-countries')).toHaveText(
    formatNumber(namedLoginCountries.size),
  );
  // The exclusion is visible: the Account record row has a country cell, its
  // name is not among the login rows, and counting it would be one too many.
  expect(cells.account).toHaveLength(1);
  const accountCountry = cells.account[0]!;
  expect(accountCountry).not.toBe('');
  expect(namedLoginCountries.has(accountCountry)).toBe(false);
  expect(new Set([...namedLoginCountries, accountCountry]).size).toBe(namedLoginCountries.size + 1);

  // The label that explains the pinned row sits directly above the table, so it
  // is read with the row (it was below the fold, under the hints).
  const note = page.getByTestId('login-account-note');
  await expect(note).toHaveCount(1);
  await expect(note).toBeVisible();
  const noteBox = (await note.boundingBox())!;
  const scrollerBox = (await page.getByTestId('login-scroller').boundingBox())!;
  expect(noteBox.y + noteBox.height).toBeLessThanOrEqual(scrollerBox.y);
});

test('one session file raises no multi-file note (D-01)', async ({ page }) => {
  await gotoApp(page);
  await importAndOpen(page, SYNTHETIC_ZIP_NAME, SINGLE_FILE_EXPORT, 'login-history');
  await expect(loginHistoryBlock(page)).toHaveAttribute('data-state', 'ready');
  await expect(page.getByTestId('login-tile-ips')).toHaveText(formatNumber(2));
  // The note is absent, not empty: there is nothing here to explain.
  await expect(page.getByTestId('login-multi-file-note')).toHaveCount(0);
  await expect(loginHistoryBlock(page)).not.toContainText(LOGIN_MULTI_FILE_NOTE);
});

test('loading says it is calculating, and no tile is on screen', async ({ page }) => {
  // 10s, not 3s: the window has to outlast the four assertions that observe it,
  // and this suite runs on one Playwright worker alongside the rest of the
  // browser suite. A delay that expires mid-assertion fails as a flake rather
  // than as a missing state, which is the worst way for this test to fail.
  await delayLoginsQueriesAfter(page, 0, 10_000);
  await gotoApp(page);
  await importAndOpen(page, SYNTHETIC_ZIP_NAME, HAND_EXPORT, 'login-history');

  const block = loginHistoryBlock(page);
  await expect(block).toHaveAttribute('data-state', 'loading');
  await expect(block).toHaveAttribute('aria-busy', 'true');
  // The calculating line IS the live region, so it is announced rather than
  // only drawn (06-UI-SPEC section 2).
  await expect(page.getByTestId('login-history-status')).toHaveText(LOGIN_HISTORY_LOADING);
  await expect(page.getByTestId('login-tile-ips')).toHaveCount(0);
  await expect(page.getByTestId('login-mask-toggle')).toHaveCount(0);

  // And it settles, which is the other half of the claim. The timeout has to
  // outlast the delay above, or this assertion would be measuring the patch
  // rather than the block.
  await expect(block).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });
  await expect(block).toHaveAttribute('aria-busy', 'false');
});

test('an Activity_history with no session or login file says exactly that (D-10)', async ({
  page,
}) => {
  await gotoApp(page);
  await importAndOpen(page, SYNTHETIC_ZIP_NAME, NO_SOURCE_EXPORT, 'login-history');
  const block = loginHistoryBlock(page);
  await expect(block).toHaveAttribute('data-state', 'no-source');
  await expect(block).toContainText(LOGIN_HISTORY_NO_SOURCE);
  // No controls and no tiles: a block that showed a reveal control here would
  // be offering to reveal addresses it has none of.
  await expect(page.getByTestId('login-mask-toggle')).toHaveCount(0);
  await expect(page.getByTestId('login-tile-ips')).toHaveCount(0);
});

test('a session file whose every address is unreadable says a different thing (D-10)', async ({
  page,
}) => {
  await gotoApp(page);
  await importAndOpen(page, SYNTHETIC_ZIP_NAME, NO_USABLE_EXPORT, 'login-history');
  const block = loginHistoryBlock(page);
  await expect(block).toHaveAttribute('data-state', 'no-usable');
  await expect(block).toContainText(LOGIN_HISTORY_NO_USABLE);
  // The two empty states are NOT collapsed: the file was there, and no row in
  // it could be read, which is a different fact about the user's own zip.
  await expect(block).not.toContainText(LOGIN_HISTORY_NO_SOURCE);
  await expect(page.getByTestId('login-mask-toggle')).toHaveCount(0);
  // The two rows that could not be read are counted, as a number and nothing
  // else (D-06): the pill is shown in this state too, with no table around it.
  await expect(page.getByTestId('login-excluded')).toContainText(formatLoginExcludedPill(2));
  await expect(page.getByTestId('login-table')).toHaveCount(0);
});

test('a query that cannot be asked renders the fixed sentence and no retry (T-06-31)', async ({
  page,
}) => {
  await failLoginsQuery(page);
  await gotoApp(page);
  await importAndOpen(page, SYNTHETIC_ZIP_NAME, HAND_EXPORT, 'login-history');

  const block = loginHistoryBlock(page);
  await expect(block).toHaveAttribute('data-state', 'error');
  const alert = page.getByTestId('login-history-error');
  await expect(alert).toHaveText(LOGIN_HISTORY_ERROR);
  // `role="alert"` and NO `aria-live` attribute: announced once, and not
  // counted by the page-wide explicit-`aria-live` assertion.
  await expect(alert).toHaveAttribute('role', 'alert');
  await expect(alert).not.toHaveAttribute('aria-live', /./);
  // No tiles, and no control: dropping the export again is the retry, and the
  // dataset on screen is unchanged either way.
  await expect(page.getByTestId('login-tile-ips')).toHaveCount(0);
  await expect(page.getByTestId('login-mask-toggle')).toHaveCount(0);
  // The other blocks are unaffected: the seam fails ONE channel. Only the open
  // pane's section is in the DOM (R4), so the Playtime pane is opened to read it.
  await openSection(page, 'playtime');
  await expect(page.getByTestId('playtime')).toHaveAttribute('data-state', 'ready');
});

test('pressing the toggle keeps focus and announces the new state, with no address', async ({
  page,
}) => {
  await gotoApp(page);
  await importAndOpen(page, SYNTHETIC_ZIP_NAME, HAND_EXPORT, 'login-history');
  const status = page.getByTestId('login-history-status');
  const toggle = page.getByTestId('login-mask-toggle');
  await expect(toggle).toHaveAttribute('data-masked', 'true');
  await expect(status).toHaveText('');

  await toggle.click();
  await expect(toggle).toBeFocused();
  await expect(status).toHaveText(MASK_ANNOUNCE_SHOWN);

  await toggle.click();
  await expect(toggle).toBeFocused();
  await expect(status).toHaveText(MASK_ANNOUNCE_MASKED);

  // The announcement is STATE WORDS ONLY. A live region is read aloud whether
  // or not anyone is looking at the screen, so an address in it would be the
  // one unmasked address the mask could not hide (D-07, T-06-28).
  for (const address of FULL_ADDRESSES) {
    await expect(status).not.toContainText(address);
    for (const part of address.split('.')) {
      await expect(status).not.toContainText(part);
    }
  }
});

test('while masked, the selection carries no address either; revealed, the tile does', async ({
  page,
}) => {
  await gotoApp(page);
  await importAndOpen(page, SYNTHETIC_ZIP_NAME, HAND_EXPORT, 'login-history');
  await expect(loginHistoryBlock(page)).toHaveAttribute('data-state', 'ready');

  // Native selection and the browser's own copy act on the DISPLAYED text, so
  // a reader who selects the page and presses the copy shortcut gets the
  // masked form (06-UI-SPEC section 3, Copy and text selection). There is no
  // copy button in this phase and no clipboard code anywhere.
  const maskedSelection = await selectedText(page);
  for (const address of FULL_ADDRESSES) {
    expect(maskedSelection).not.toContain(address);
  }

  await page.getByTestId('login-mask-toggle').click();
  // Revealed, the address is in the tile's TEXT and nowhere else: the page
  // holds the string being displayed and no second copy behind a rule.
  const revealedSelection = await selectedText(page);
  expect(revealedSelection).toContain(LOGINS_IP_HOME);
  const attributeHits = await attributeHitsAround(page, FULL_ADDRESSES);
  // Attributes carry NO address in EITHER state — not a `title`, not a
  // `data-*`, not an `aria-label`.
  expect(attributeHits).toEqual([]);
});

test('at 375px the block wraps and the page does not scroll sideways', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await gotoApp(page);
  await importAndOpen(page, SYNTHETIC_ZIP_NAME, HAND_EXPORT, 'login-history');
  await expect(loginHistoryBlock(page)).toHaveAttribute('data-state', 'ready');

  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(375);

  // The count tiles show TWO per row at 375px, which is what the 128px minimum
  // in their grid is for. Read as GEOMETRY rather than as a class, because the
  // claim is about the layout the reader gets.
  const boxes = await page
    .getByTestId('login-summary-counts')
    .locator('.tile')
    .evaluateAll((tiles) =>
      tiles.map((tile) => {
        const rect = tile.getBoundingClientRect();
        return { x: Math.round(rect.x), y: Math.round(rect.y) };
      }),
    );
  expect(boxes).toHaveLength(3);
  expect(boxes[0]!.y).toBe(boxes[1]!.y);
  expect(boxes[0]!.x).not.toBe(boxes[1]!.x);
  expect(boxes[2]!.y).toBeGreaterThan(boxes[0]!.y);

  // The fact tiles show ONE per row at this width, which is what the 200px
  // minimum in their grid is for: three would need 632px of track and the detail
  // pane is 343px. Same x, rising y — the opposite shape to the counts above.
  const factBoxes = await page
    .getByTestId('login-summary-facts')
    .locator('.tile')
    .evaluateAll((tiles) =>
      tiles.map((tile) => {
        const rect = tile.getBoundingClientRect();
        return { x: Math.round(rect.x), y: Math.round(rect.y) };
      }),
    );
  expect(factBoxes).toHaveLength(3);
  expect(factBoxes[0]!.x).toBe(factBoxes[1]!.x);
  expect(factBoxes[1]!.y).toBeGreaterThan(factBoxes[0]!.y);
  expect(factBoxes[2]!.y).toBeGreaterThan(factBoxes[1]!.y);

  // The address wraps INSIDE its tile rather than widening it, and the page
  // still has no horizontal scroll after the fact grid is in view.
  await page.getByTestId('login-tile-top-ip').scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});

test('reveal, then replace: the block is masked again and never shows the old tiles', async ({
  page,
}) => {
  // The delay is what makes the race observable: a replace that lands while
  // this dataset's answer is still in flight is the case T-06-30 is about.
  await delayLoginsQueriesAfter(page, 1, 12_000);
  await gotoApp(page);
  await importAndOpen(page, SYNTHETIC_ZIP_NAME, HAND_EXPORT, 'login-history');

  const block = loginHistoryBlock(page);
  const toggle = page.getByTestId('login-mask-toggle');
  await expect(block).toHaveAttribute('data-state', 'ready');
  await toggle.click();
  await expect(toggle).toHaveAttribute('data-masked', 'false');

  // A different export: a replace, confirmed.
  await replaceExport(page, SYNTHETIC_ZIP_NAME, SINGLE_FILE_EXPORT, 'login-history');

  // While the new answer is in flight the block is LOADING, not `ready` with
  // the previous dataset's addresses still on screen.
  await expect(block).toHaveAttribute('data-state', 'loading');
  await expect(page.getByTestId('login-tile-top-ip')).toHaveCount(0);
  await expect(page.getByTestId('login-tile-range')).toHaveCount(0);

  // And it settles on the NEW dataset, masked, with the new figures.
  await expect(block).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });
  await expect(toggle).toHaveAttribute('data-masked', 'true');
  await expect(toggle).toHaveText(MASK_TOGGLE_SHOW);
  await expect(page.getByTestId('login-tile-top-ip')).toHaveText(maskIp(LOGINS_IP_HOME));
  await expect(page.getByTestId('login-tile-ips')).toHaveText(formatNumber(2));
});

test('reveal, then clear, then import again: masked again (D-07)', async ({ page }) => {
  await gotoApp(page);
  await importAndOpen(page, SYNTHETIC_ZIP_NAME, HAND_EXPORT, 'login-history');
  const toggle = page.getByTestId('login-mask-toggle');
  await expect(toggle).toHaveAttribute('data-masked', 'true');
  await toggle.click();
  await expect(toggle).toHaveAttribute('data-masked', 'false');

  await startOver(page);
  await importAndOpen(page, SYNTHETIC_ZIP_NAME, HAND_EXPORT, 'login-history');
  await expect(loginHistoryBlock(page)).toHaveAttribute('data-state', 'ready');
  // The mask is not a property of the user or the session: a fresh import is
  // masked because the block never persisted anything.
  await expect(toggle).toHaveAttribute('data-masked', 'true');
  await expect(toggle).toHaveText(MASK_TOGGLE_SHOW);
  await expect(page.getByTestId('login-tile-top-ip')).toHaveText(maskIp(LOGINS_IP_HOME));
});

test('a reload after a reveal comes back masked (D-07, T-06-29)', async ({ page }) => {
  await gotoApp(page);
  await importAndOpen(page, SYNTHETIC_ZIP_NAME, HAND_EXPORT, 'login-history');
  await page.getByTestId('login-mask-toggle').click();
  await expect(page.getByTestId('login-mask-toggle')).toHaveAttribute('data-masked', 'false');

  // The DATASET is cached, so the block comes straight back — with the mask
  // off. The only thing that could restore it is storage, and the feature
  // touches none.
  await page.reload();
  await expect(page.locator('main')).toHaveAttribute('data-worker-ready', 'true', {
    timeout: 10_000,
  });
  // A reload lands on Overview (R1), so the pane is opened again.
  await openSection(page, 'login-history');
  const toggle = page.getByTestId('login-mask-toggle');
  await expect(loginHistoryBlock(page)).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });
  await expect(toggle).toHaveAttribute('data-masked', 'true');
  await expect(toggle).toHaveText(MASK_TOGGLE_SHOW);
  await expect(page.getByTestId('login-tile-top-ip')).toHaveText(maskIp(LOGINS_IP_HOME));
});
