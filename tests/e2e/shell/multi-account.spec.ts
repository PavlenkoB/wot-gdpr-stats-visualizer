import '../_support/pin-locale';
import { expect, test, type ConsoleMessage, type Locator, type Page } from '@playwright/test';
import {
  MA_CANARIES,
  MA_CHAT_CANARY,
  MA_CREATED_EU,
  MA_EXPECTED_GAMES,
  MA_EXPECTED_YEARS,
  MA_FORUM_EMAIL_CANARY,
  MA_FORUM_IP_CANARY,
  MA_LONG_NICKNAME,
  MA_LONG_ROOT,
  MA_NICKNAME_EU,
  MA_NICKNAME_NA,
  MA_REGION_EU,
  MA_REGION_NA,
  MA_ROOT_EU,
  MA_ROOT_NA,
  MA_ROOT_RU,
  buildLongTextAccountsExport,
  buildOneAccountExport,
  buildOneDataLessOfTwoExport,
  buildRealShapeThreeAccountExport,
  buildTwoAccountExport,
} from '../../fixtures/multi-account-fixtures.ts';
import {
  SAMPLE_CREATED_DATE,
  SAMPLE_NICKNAME,
  SAMPLE_REGION,
  buildSampleExport,
} from '../../fixtures/export-fixtures.ts';
import { formatAccountId } from '../../../src/lib/ui-copy.ts';
// A NAMESPACE import on purpose, for the RED run's sake: a named import of an
// export that does not exist yet is a link error that takes the whole file down
// and reports "No tests found", which would be a broken RED rather than a
// behavioural one. Under a namespace each assertion below fails on its own
// value. This follows the same reasoning as `tests/unit/shell/ui-copy.test.ts`.
import * as copy from '../../../src/lib/ui-copy.ts';
import { PANE_IDS, PANE_SECTION, type PaneId } from '../../../src/lib/shell/selection-state.ts';
import {
  SYNTHETIC_ZIP_NAME,
  ensureListScreen,
  gotoApp,
  importExport,
  listRow,
  openSection,
  playerStatsBlock,
  replaceExport,
  startOver,
} from '../_support/helpers.ts';

// =============================================================================
// Phase 9, plan 09-04 — the multi-account identity header (ACCOUNT-05)
//
// WHAT THIS SPEC IS
// The FIRST of the two e2e tests Phase 9 is allowed to add (D-23: the suite sits
// at 256 listed tests against a ceiling of 258, so the phase adds exactly two).
// It is written as named `test.step` blocks rather than as three separate tests
// on purpose: a three-account import is ONE expensive fixture, and plans 09-05
// and 09-06 append their own steps to THIS test rather than paying for a second
// import of the same archive.
//
// WHAT IT PROVES
//   - the header lists three rows, in the D-16 order the worker stored, with the
//     ID-only row for the account that has no User_Info (T-09-20: a row shows
//     only its OWN identity);
//   - every root's privacy canary — its login domain, its birth date, its
//     overflow cell — plus the deferred categories' canaries are absent from
//     every observable surface: the rendered text, `outerHTML` (which includes
//     <title>, every attribute and every hidden node), the accessibility tree,
//     the console of BOTH the page and the worker, and the raw IndexedDB dump;
//   - all of it holds again after a RELOAD, which is the replay path off the
//     cached meta record rather than the freshly parsed result still in memory.
//
// The negative assertions are paired with controls that cannot pass on an empty
// or missing page: the IP column is NOT stripped, so the dump must still contain
// it; each nickname must occur exactly once in the rendered text; and the
// document title must be the static one (D-21).
// =============================================================================

/**
 * The static document title, asserted on every path (D-21): a nickname must
 * never be promoted out of the header's own visible text.
 */
const DOCUMENT_TITLE = 'WG Data Export Viewer';

/**
 * The value the browser computes for `color: var(--{token})`, as `rgb(...)`.
 *
 * Read rather than hardcoded so the assertion tracks the TOKEN rather than a
 * stale hex: a probe element is coloured from the token and then read through
 * `getComputedStyle`, so the returned string is in exactly the form
 * `toHaveCSS('color', …)` sees on a real element, whatever the token's own
 * text happens to be.
 */
async function resolvedTokenColor(page: Page, token: string): Promise<string> {
  return page.evaluate((name) => {
    const probe = document.createElement('span');
    probe.style.color = `var(${name})`;
    document.body.append(probe);
    const value = getComputedStyle(probe).color;
    probe.remove();
    return value;
  }, `--${token}`);
}

/**
 * Start collecting console output from the page AND from every web worker the
 * page creates.
 *
 * MUST be called before the first navigation: the ingest worker is spawned by
 * `IngestClient`'s constructor during module init, and Playwright emits
 * `page.on('worker')` only at spawn time.
 */
function collectConsole(page: Page): string[] {
  const messages: string[] = [];
  const record = (message: ConsoleMessage): void => {
    messages.push(message.text());
  };
  page.on('console', record);
  page.on('worker', (worker) => {
    worker.on('console', record);
  });
  return messages;
}

/**
 * Uncaught exceptions, collected from the same first navigation (09-05).
 *
 * Separate from {@link collectConsole} because they are different failures: an
 * uncaught error is what a pane throws while rendering (a duplicate keyed-each
 * key is the one this phase is about), and a `console` message may be a warning
 * the app has always printed. Both lists must be empty at the end of the flow.
 */
function collectPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => {
    errors.push(error.message);
  });
  return errors;
}

interface PageSurface {
  outerHtml: string;
  title: string;
  innerText: string;
}

/** Everything a script on the page can read off the DOM, in one round-trip. */
async function readPageSurface(page: Page): Promise<PageSurface> {
  return page.evaluate(() => ({
    outerHtml: document.documentElement.outerHTML,
    title: document.title,
    innerText: document.body.innerText,
  }));
}

/**
 * The accessibility snapshot, which covers accessible names that neither
 * `innerText` nor a substring search of the markup can see.
 */
async function readAriaSnapshot(page: Page): Promise<string> {
  return page.locator('body').ariaSnapshot();
}

/**
 * A raw, dependency-free dump of the `rows` and `meta` object stores.
 *
 * The raw `indexedDB` API on purpose: Dexie would show only what the app
 * chooses to read, and these assertions are about what is AT REST.
 */
async function readIndexedDbDump(page: Page): Promise<string> {
  return page.evaluate(
    () =>
      new Promise<string>((resolve, reject) => {
        const open = indexedDB.open('wg-export-viewer');
        open.onerror = () => reject(open.error ?? new Error('indexedDB.open failed'));
        open.onsuccess = () => {
          const db = open.result;
          const stores = ['rows', 'meta'].filter((name) => db.objectStoreNames.contains(name));
          if (stores.length === 0) {
            db.close();
            resolve('[]');
            return;
          }
          const out: unknown[] = [];
          const tx = db.transaction(stores, 'readonly');
          for (const name of stores) {
            const request = tx.objectStore(name).getAll();
            request.onsuccess = () => out.push(request.result);
          }
          tx.oncomplete = () => {
            db.close();
            resolve(JSON.stringify(out));
          };
          tx.onerror = () => reject(tx.error ?? new Error('read transaction failed'));
        };
      }),
  );
}

/** Escape a literal needle before counting its occurrences in a document. */
function escapeForRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** The non-overlapping occurrences of a literal in a text. */
function countOccurrences(text: string, needle: string): number {
  return (text.match(new RegExp(escapeForRegExp(needle), 'g')) ?? []).length;
}

/**
 * EVERY needle that must not be readable on the page that is currently loaded.
 *
 * Per-root rather than shared, for the reason `MA_CANARIES` documents: a single
 * canary would prove only that ONE root was stripped, and a leak from a second
 * root would look identical. The three deferred categories carry their own
 * canaries too — D-18 parses those rows for counts and never stores them, so
 * the forum e-mail, the forum IP and the chat body must be absent from the dump
 * as well as from the DOM.
 */
const NEEDLES: readonly string[] = [
  ...Object.values(MA_CANARIES).flatMap((canary) => [
    canary.loginDomain,
    canary.birthDate,
    canary.overflow,
  ]),
  MA_FORUM_EMAIL_CANARY,
  MA_FORUM_IP_CANARY,
  MA_CHAT_CANARY,
];

/**
 * Run the multi-account leak scan on whatever view is loaded.
 *
 * `where` names the view in each assertion message, so a failure says whether
 * the landing view or the Account pane leaked rather than leaving it to the
 * step name alone.
 */
async function expectNoLeak(
  page: Page,
  consoleMessages: readonly string[],
  where: string,
): Promise<void> {
  const surface = await readPageSurface(page);
  const aria = await readAriaSnapshot(page);
  const dump = await readIndexedDbDump(page);
  const logged = consoleMessages.join('\n');

  for (const needle of NEEDLES) {
    expect(surface.innerText, `${where}: rendered text leaks ${needle}`).not.toContain(needle);
    expect(surface.outerHtml, `${where}: markup leaks ${needle}`).not.toContain(needle);
    expect(aria, `${where}: accessible name leaks ${needle}`).not.toContain(needle);
    expect(logged, `${where}: console leaks ${needle}`).not.toContain(needle);
    expect(dump, `${where}: IndexedDB leaks ${needle}`).not.toContain(needle);
  }

  // D-21 RESTATED PER ROW: the nickname is visible text and nothing else. Two
  // accounts may share one, so the rule is "once in its own row", not "once in
  // the document" — which is why only the two nicknames this fixture has are
  // counted.
  //
  // "In the rendered text exactly once" and "in the whole markup exactly once"
  // are asserted together on purpose: the second is the stronger statement and
  // it is what proves the FIRST occurrence is text rather than markup. An
  // occurrence inside a `title`, an `aria-label`, a tooltip or any other
  // attribute would be a second occurrence of the raw string in `outerHTML`,
  // because Svelte's text interpolation writes the value as text while an
  // attribute carrying it would repeat the same literal. The aria snapshot is
  // counted rather than excluded, because a row's text IS its accessible name
  // by design (UI-SPEC Accessibility) — what must not happen is a SECOND
  // announcement from an attribute.
  for (const nickname of [MA_NICKNAME_EU, MA_NICKNAME_NA]) {
    expect(
      countOccurrences(surface.innerText, nickname),
      `${where}: ${nickname} appears exactly once in the rendered text`,
    ).toBe(1);
    expect(
      countOccurrences(surface.outerHtml, nickname),
      `${where}: ${nickname} appears once in the markup, so never in an attribute`,
    ).toBe(1);
    expect(
      countOccurrences(aria, nickname),
      `${where}: ${nickname} is announced once, from its own row's text`,
    ).toBe(1);
  }

  // The static title, on every path.
  expect(surface.title, `${where}: document title`).toBe(DOCUMENT_TITLE);

  // Control: the IP column is deliberately NOT stripped, so a dump that read
  // empty would fail here instead of passing every negative assertion above.
  expect(dump, `${where}: the IP column must still be at rest`).toContain('"IP"');
}

/**
 * Assert the whole header, in the D-16 order the worker stored.
 *
 * Written as one function so the fresh-import step and the after-reload step
 * assert the same thing rather than two similar blocks that can drift — which is
 * the exact defect the replay paths are supposed to prevent.
 */
async function expectHeaderRows(page: Page, where: string): Promise<void> {
  const header = page.getByTestId('identity-header');
  await expect(header, `${where}: the multi variant`).toHaveAttribute('data-variant', 'multi');

  // The single-account DOM is not merely hidden — it is absent, so a test
  // asking for the v1.0 nickname finds nothing rather than a stale node.
  await expect(page.getByTestId('identity-nickname'), `${where}: single-account title`).toHaveCount(
    0,
  );

  await expect(page.getByTestId('identity-multi-title'), `${where}: title`).toHaveText(
    copy.formatAccountCount(3),
  );

  const list = page.getByTestId('identity-multi-list');
  await expect(list, `${where}: the list is a list`).toHaveAttribute('role', 'list');
  await expect(list, `${where}: the list's accessible name`).toHaveAttribute(
    'aria-label',
    copy.IDENTITY_MULTI_LIST_LABEL,
  );

  const rows = page.getByTestId('identity-multi-row');
  await expect(rows, `${where}: three rows`).toHaveCount(3);

  // D-16 order: first activity year ascending — RU 2012, EU 2018, NA 2021.
  const roots = [MA_ROOT_RU, MA_ROOT_EU, MA_ROOT_NA];
  const mutedColor = await resolvedTokenColor(page, 'muted');
  const inkColor = await resolvedTokenColor(page, 'ink');
  for (const [index, root] of roots.entries()) {
    const row = rows.nth(index);
    const isIdOnly = root === MA_ROOT_RU;

    await expect(row.getByTestId('identity-multi-name'), `${where}: row ${root} name`).toHaveText(
      isIdOnly ? root : root === MA_ROOT_EU ? MA_NICKNAME_EU : MA_NICKNAME_NA,
    );

    if (isIdOnly) {
      // D-17 / T-09-20: the account with no User_Info shows its ID and never
      // another account's nickname, and its ID line is omitted because the ID
      // is already the title.
      await expect(row, `${where}: the ID-only row is marked`).toHaveAttribute(
        'data-user-info',
        'absent',
      );
      await expect(row.getByTestId('identity-multi-id'), `${where}: ID line omitted`).toHaveCount(
        0,
      );

      // T-09-28: the demotion is a TYPE change, so the root text is still here,
      // inside the same `h3`, still this row's accessible name — and it now
      // computes as an ID line (Label role, muted) rather than as the row's
      // most prominent type.
      const idOnlyName = row.getByTestId('identity-multi-name');
      await expect(idOnlyName, `${where}: the ID-only title still carries the root`).toHaveText(
        root,
      );
      await expect(idOnlyName, `${where}: the ID-only title size`).toHaveCSS('font-size', '14px');
      await expect(idOnlyName, `${where}: the ID-only title weight`).toHaveCSS(
        'font-weight',
        '600',
      );
      await expect(idOnlyName, `${where}: the ID-only title colour is muted`).toHaveCSS(
        'color',
        mutedColor,
      );
      // The control, on the SAME element class: a named account still takes the
      // Heading role, so the id-only demotion is a real difference and not a
      // rule that quietly flattened every title in the list.
      const namedName = rows.nth(1).getByTestId('identity-multi-name');
      await expect(namedName, `${where}: a named row keeps the Heading size`).toHaveCSS(
        'font-size',
        '18px',
      );
      await expect(namedName, `${where}: a named row keeps the Heading weight`).toHaveCSS(
        'font-weight',
        '600',
      );
      await expect(namedName, `${where}: a named row keeps the ink colour`).toHaveCSS(
        'color',
        inkColor,
      );
    } else {
      await expect(
        row,
        `${where}: a row with an identity is not marked absent`,
      ).not.toHaveAttribute('data-user-info', 'absent');
      await expect(row.getByTestId('identity-multi-id'), `${where}: ID line`).toHaveText(
        formatAccountId(root),
      );
    }

    await expect(row.getByTestId('identity-multi-games'), `${where}: games`).toHaveText(
      copy.formatAccountGames(MA_EXPECTED_GAMES[root] ?? []),
    );
    const years = MA_EXPECTED_YEARS[root];
    await expect(row.getByTestId('identity-multi-years'), `${where}: years`).toHaveText(
      years === undefined ? 'No activity recorded' : copy.formatActivityYears(years[0], years[1]),
    );
  }
}

/**
 * Assert the header and the Account list row for the one-data-less-of-two
 * archive (plan 09-11, VERIFICATION Truth 21).
 *
 * One function so the fresh import and the reload assert one thing. The second
 * folder is a real archive entry that stores nothing, so the published list is
 * ONE account while the archive held two: the header keeps the multi variant,
 * titled for the one account, and never shows the first folder's region or
 * creation date as the export's.
 */
async function expectOneOfTwoHeader(page: Page, where: string): Promise<void> {
  await expect(
    page.getByTestId('identity-header'),
    `${where}: the multi variant, never loaded or fallback`,
  ).toHaveAttribute('data-variant', 'multi');

  // The single-account DOM is absent, not hidden.
  for (const id of ['identity-nickname', 'identity-region', 'identity-created']) {
    await expect(page.getByTestId(id), `${where}: ${id} is absent`).toHaveCount(0);
  }

  await expect(page.getByTestId('identity-multi-title'), `${where}: title`).toHaveText(
    copy.formatAccountCount(1),
  );
  await expect(page.getByTestId('identity-multi-row'), `${where}: one row`).toHaveCount(1);
  await expect(
    page.getByTestId('identity-multi-row').getByTestId('identity-multi-name'),
    `${where}: the row is the EU account`,
  ).toHaveText(MA_NICKNAME_EU);

  const row = await readAccountRow(page);
  expect(row.headline, `${where}: the Account row headline is the count`).toBe(
    copy.formatAccountCount(1),
  );
  expect(row.summary, `${where}: the Account row summary`).toBe(copy.ACCOUNT_ROW_MULTI_SUMMARY);
}

/**
 * The six panes that read MERGED rows and therefore carry the combined caption
 * (D-11; UI-SPEC Surface 2).
 *
 * Playtime and Login history are two views of ONE section, so both names are
 * walked and both open the same section id.
 */
const PANES_WITH_CAPTION: readonly PaneId[] = [
  'playtime',
  'login-history',
  'vehicles',
  'finance',
  'payments',
  'device-info',
];

/**
 * The three panes that never carry the caption, and why each one is correct
 * without it (UI-SPEC Surface 2).
 *
 * Overview shows cards rather than rows; Account IS the list of accounts, so
 * "3 accounts combined" there would say nothing; "Not yet supported" is a list
 * of folders, not of rows.
 */
const PANES_WITHOUT_CAPTION: readonly PaneId[] = ['overview', 'account', 'not-yet-supported'];

/**
 * Assert that the open pane carries exactly one combined caption, with the
 * right text, as the FIRST child of the provenance block.
 *
 * "First child" is asserted rather than merely present because the caption's
 * whole job is to sit above the source line: a caption that rendered after the
 * `From Activity_history · 3 files` line would read as a property of that line.
 */
/**
 * Every table-body row a pane has drawn, as normalised text, with the panes'
 * known-good repetitions and the virtualisation spacers removed.
 *
 * Read the way a user sees it — the rendered row text — because a dropped or
 * duplicated keyed row is exactly a row of text that is missing or repeated.
 * Three exclusions, all narrow, all scoped by test id rather than by
 * "whatever happens to repeat", so the rest of the dataset stays strict:
 *
 *   - `tr.spacer[aria-hidden="true"]`: the virtualised tables' scroll-offset
 *     nodes. They carry no cells, so two of them read as identical empty rows.
 *   - `vehicle-table` and `battle-type-summary` (D-12): their CSVs are in two or
 *     three of the three roots, so the same vehicle id and the same battle-type
 *     code repeat across accounts BY DESIGN. That repetition is the property
 *     09-04's keyed-each fix made drawable; asserting it as "no duplicates"
 *     would be asserting the defect.
 *   - `device-info-table` (D-11, dedupe deferred to Phase 10): every root of a
 *     multi-account export carries the same `Device_info` files, so each device
 *     legitimately draws once per account. D-11 makes every pane read ALL
 *     accounts' rows and defers dedupe to Phase 10, so this is specified
 *     repetition too — for a different reason from D-12's, which concerns two
 *     files inside ONE account.
 */
async function readPaneRows(section: Locator): Promise<string[]> {
  return section.locator('tbody tr:not([aria-hidden="true"])').evaluateAll((nodes) =>
    nodes
      .filter(
        (node) =>
          node.closest('[data-testid="battle-type-summary"]') === null &&
          node.closest('[data-testid="vehicle-table"]') === null &&
          node.closest('[data-testid="device-info-table"]') === null,
      )
      .map((node) => (node.textContent ?? '').replace(/\s+/g, ' ').trim())
      .filter((text) => text.length > 0),
  );
}

async function expectCombinedCaption(page: Page, pane: PaneId): Promise<void> {
  const section = page.getByTestId('dashboard-section-' + PANE_SECTION[pane]);
  await expect(section, `${pane}: the section is open and ready`).toHaveAttribute(
    'data-status',
    'ready',
    { timeout: 30_000 },
  );

  const caption = section.getByTestId('combined-caption');
  await expect(caption, `${pane}: exactly one combined caption`).toHaveCount(1);
  await expect(caption, `${pane}: caption text`).toHaveText(copy.formatCombinedCaption(3));

  const isFirstChild = await section.evaluate((root) => {
    const provenance = root.querySelector('[data-testid="provenance"]');
    const node = provenance?.firstElementChild;
    return node?.getAttribute('data-testid') ?? null;
  });
  expect(isFirstChild, `${pane}: the caption is the provenance block's first child`).toBe(
    'combined-caption',
  );

  // UI review fix 2: the caption takes the full width, so it becomes its own
  // flex line — and with a zero row gap the 600-weight caption sat exactly one
  // line-height from the 400-weight "From …" line it introduces. Every other
  // block in this phase separates with the 4px rhythm; this one did not, and it
  // is the only place two blocks of different weight sit adjacent.
  const provenance = section.getByTestId('provenance');
  await expect(provenance, `${pane}: the provenance block's row gap`).toHaveCSS('row-gap', '4px');
  await expect(provenance, `${pane}: the provenance block's column gap`).toHaveCSS(
    'column-gap',
    '4px',
  );
}

/**
 * The Account list row's headline and summary, read off the two spans the row
 * renders. The classes rather than new test ids, because the row is v1.0
 * markup that 09-05 must not change shape.
 */
async function readAccountRow(page: Page): Promise<{ headline: string; summary: string }> {
  const row = listRow(page, 'account');
  return {
    headline: (await row.locator('.headline').innerText()).trim(),
    summary: (await row.locator('.sub').innerText()).trim(),
  };
}

/**
 * The pane-by-pane leak scan (09-05), scoped to the DETAIL pane.
 *
 * Narrower than {@link expectNoLeak} on purpose: that one is the whole-surface
 * scan (accessibility tree, both consoles, IndexedDB) and runs three times for
 * the dataset-level proof. This one runs once per pane over the pane's own
 * `outerHTML` and `innerText`, which is where a pane-level leak could only
 * appear now that every pane has been opened — the stored data was already
 * proven clean at rest by the three full scans.
 */
async function expectNoPaneLeak(page: Page, where: string): Promise<void> {
  const surface = await page.getByTestId('detail-pane').evaluate((el) => ({
    outerHtml: (el as HTMLElement).outerHTML,
    innerText: (el as HTMLElement).innerText,
  }));
  for (const needle of NEEDLES) {
    expect(surface.innerText, `${where}: pane text leaks ${needle}`).not.toContain(needle);
    expect(surface.outerHtml, `${where}: pane markup leaks ${needle}`).not.toContain(needle);
  }
}

/**
 * What is AT REST in the raw `rows` and `meta` stores (09-06, T-09-23).
 *
 * Local to this spec, not added to `tests/e2e/_support/helpers.ts`: that file is
 * read by every spec, and one reader is enough for one spec. The raw
 * `indexedDB` API for the same reason {@link readIndexedDbDump} uses it — Dexie
 * would show only what the app chooses to read, and these assertions are about
 * what survives a replace, a clear and a Start Over.
 *
 * `accounts` is the SORTED DISTINCT set of the rows' `account` values, so the
 * expectation is order-independent at the STORE level while the header's order
 * (D-16) is asserted separately against the DOM. A row whose `account` is
 * absent is counted as `''`, which no real dataset has: a rootless export
 * stores `''`, and a multi-root export never does.
 */
interface StoreSnapshot {
  accounts: string[];
  rowCount: number;
  metaCount: number;
}

async function readStoreSnapshot(page: Page): Promise<StoreSnapshot> {
  return page.evaluate(
    () =>
      new Promise<{ accounts: string[]; rowCount: number; metaCount: number }>(
        (resolve, reject) => {
          const open = indexedDB.open('wg-export-viewer');
          open.onerror = () => reject(open.error ?? new Error('indexedDB.open failed'));
          open.onsuccess = () => {
            const db = open.result;
            const hasRows = db.objectStoreNames.contains('rows');
            const hasMeta = db.objectStoreNames.contains('meta');
            const names = [hasRows ? 'rows' : null, hasMeta ? 'meta' : null].filter(
              (name): name is string => name !== null,
            );
            if (names.length === 0) {
              db.close();
              resolve({ accounts: [], rowCount: 0, metaCount: 0 });
              return;
            }

            let accounts: string[] = [];
            let rowCount = 0;
            let metaCount = 0;
            const tx = db.transaction(names, 'readonly');
            if (hasRows) {
              const request = tx.objectStore('rows').getAll();
              request.onsuccess = () => {
                const rows = request.result as Array<{ account?: string }>;
                rowCount = rows.length;
                accounts = [...new Set(rows.map((row) => row.account ?? ''))].sort();
              };
            }
            if (hasMeta) {
              const request = tx.objectStore('meta').getAll();
              request.onsuccess = () => {
                metaCount = request.result.length;
              };
            }
            tx.oncomplete = () => {
              db.close();
              resolve({ accounts, rowCount, metaCount });
            };
            tx.onerror = () => reject(tx.error ?? new Error('read transaction failed'));
          };
        },
      ),
  );
}

/**
 * The expected store-level account set for a set of roots: sorted, so the
 * expectation never depends on the order the store happens to hand them back.
 */
function sortedRoots(roots: readonly string[]): string[] {
  return [...roots].sort();
}

test.describe('multi-account identity header (ACCOUNT-05, D-13 … D-17)', () => {
  test('(a) a three-account dataset lists its accounts in activity order, leaks nothing and survives a reload', async ({
    page,
  }) => {
    // 09-05 appends an import-time scan of every pane, a title switch and a
    // one-account replace to THIS test, and 09-06 the lifecycle paths, so the
    // budget is set here once instead of being discovered as a timeout later.
    test.setTimeout(240_000);

    const consoleMessages = collectConsole(page);
    const pageErrors = collectPageErrors(page);
    await gotoApp(page);
    await importExport(page, SYNTHETIC_ZIP_NAME, buildRealShapeThreeAccountExport());

    await test.step('the header lists three rows in activity order', async () => {
      await expectHeaderRows(page, 'fresh import');
    });

    await test.step('the landing view leaks nothing', async () => {
      await expectNoLeak(page, consoleMessages, 'landing view');
    });

    await test.step('the Account pane leaks nothing', async () => {
      // The pane that would be most likely to re-present an identity: it is
      // where the v1.0 Account record row lives.
      await openSection(page, 'account');
      await expectNoLeak(page, consoleMessages, 'pane account');
      await expectHeaderRows(page, 'pane account');
    });

    // 09-05 below. Every existing pane must OPEN on this dataset (roadmap SC2),
    // the six that read merged rows must say so, and the two keyed each blocks
    // whose keys repeat across accounts must not stop the Vehicles pane
    // rendering. Nothing here re-imports: the dataset is already on screen.
    await test.step('every pane opens on the three-account dataset', async () => {
      for (const pane of PANE_IDS) {
        await openSection(page, pane);
        await expectNoPaneLeak(page, `pane ${pane}`);
      }
    });

    await test.step('no pane draws a duplicate row on this dataset', async () => {
      // T-09-22 widened. The keyed-each fix in 09-04 was proved in the browser
      // on the Vehicles pane alone, which left every OTHER keyed list that can
      // repeat a value across accounts unchecked in a real browser. This is the
      // same check applied to every pane: the pane list is `PANE_IDS` itself,
      // the same source every other walk in this spec drives from, so a new pane
      // is covered by construction rather than by remembering to add it here.
      //
      // The measurement is the RENDERED row text, because that is what a
      // dropped or duplicated keyed row looks like to a user. A pane with no
      // rows is skipped: this asserts uniqueness, not that a pane has content.
      for (const pane of PANE_IDS) {
        await openSection(page, pane);

        // The Overview pane has no `DashboardSection` at all
        // (`PANE_SECTION.overview` is null), so it is scoped to the detail pane
        // the leak walk already reads.
        const sectionId = PANE_SECTION[pane];
        const section =
          sectionId === null
            ? page.getByTestId('detail-pane')
            : page.getByTestId('dashboard-section-' + sectionId);

        // Waiting on `data-status="ready"` is NOT a usable gate here, and the
        // reason is worth recording: the Account pane is `pending` forever on a
        // multi-account dataset, because there is no single User_Info record to
        // present, so a `ready` wait would time out on a pane that is behaving
        // correctly. Nor is it sufficient where it does hold — Finance computes
        // its totals and Device info reads its tables off the worker AFTER the
        // section is already "ready", so scanning then compares an empty body
        // and passes vacuously. That is precisely how a widened scan turns into
        // a weaker one.
        //
        // So the row set is read through `expect.poll` and the wait is for the
        // count to HOLD still across three consecutive polls. That is what
        // "finished rendering" looks like from outside, and it needs no
        // per-pane knowledge of which pane loads how.
        let lastCount = -1;
        let stableReads = 0;
        let rows: string[] = [];
        await expect
          .poll(
            async () => {
              rows = await readPaneRows(section);
              if (rows.length !== lastCount) {
                lastCount = rows.length;
                stableReads = 1;
              } else {
                stableReads += 1;
              }
              return stableReads;
            },
            { timeout: 30_000, intervals: [100, 200, 300, 500] },
          )
          .toBeGreaterThanOrEqual(3);

        // The panes' known-good repetitions are excluded FROM THIS SCAN BY SCOPE
        // (`readPaneRows` names all three and why), never exempted inline: an
        // inline exemption would silently accept a SECOND, wrong duplication in
        // the same pane. Each exclusion is proven still real by its own
        // assertion — D-12's vehicle and battle-type duplication by the
        // Vehicles step below, D-11's per-account device rows by the Device info
        // step after it — so none can quietly become a defect of its own.
        //
        // A pane with no rows is SKIPPED rather than failed: this asserts
        // uniqueness, not that a pane has content, and the merged panes are
        // legitimately empty for the files this dataset does not carry.
        if (rows.length === 0) continue;

        expect(
          rows.filter((text, index) => rows.indexOf(text) !== index),
          `${pane}: ${rows.length} rows, ${new Set(rows).size} distinct`,
        ).toEqual([]);
      }

      // The account list itself is the other keyed list this dataset opens: three
      // roots, three rows, and every row's rendered text distinct because the
      // ID-only row shows its own root rather than a nickname.
      const identityRows = await page
        .getByTestId('identity-multi-row')
        .evaluateAll((nodes) => nodes.map((node) => (node.textContent ?? '').replace(/\s+/g, ' ')));
      expect(
        identityRows.filter((text, index) => identityRows.indexOf(text) !== index),
        'no account row renders identically to another',
      ).toEqual([]);
    });

    await test.step('the six merged panes carry the combined caption', async () => {
      for (const pane of PANES_WITH_CAPTION) {
        await openSection(page, pane);
        await expectCombinedCaption(page, pane);
      }
    });

    await test.step('Overview, Account and Not yet supported carry no caption', async () => {
      for (const pane of PANES_WITHOUT_CAPTION) {
        await openSection(page, pane);
        await expect(page.getByTestId('combined-caption'), `${pane}: no caption`).toHaveCount(0);
      }
    });

    await test.step('the Vehicles pane renders the repeated ids and codes', async () => {
      await openSection(page, 'vehicles');
      const block = playerStatsBlock(page);
      await expect(block).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });

      // The Blitz title: `WOTB_Vehicle_Statistics.csv` is in all THREE roots and
      // `WOTB_Battle_Types_Statistics.csv` in TWO, so its rows and its codes are
      // exactly the values the old keyed each blocks would have collided on
      // (D-12). The counts below are the visible ones — whether the table
      // virtualises, a DUPlicated id still has to draw twice, which is what a
      // keyed each refuses to do.
      await block.getByTestId('player-stats-title-selector').selectOption('wotb');
      await expect(block).toHaveAttribute('data-state', 'ready');

      const drawnRows = await page.getByTestId('vehicle-row').count();
      expect(drawnRows, 'the Blitz table draws at least one row').toBeGreaterThan(0);

      const ids = await page.getByTestId('vehicle-row').locator('td.sticky-first').allInnerTexts();
      const distinctIds = new Set(ids.map((text) => text.trim()));
      expect(
        distinctIds.size,
        `the drawn Blitz rows really repeat an id (${drawnRows} rows, ${distinctIds.size} distinct)`,
      ).toBeLessThan(drawnRows);

      const summary = page.getByTestId('battle-type-summary');
      const codes = await summary
        .getByTestId('battle-type-row')
        .evaluateAll((rows) => rows.map((row) => row.getAttribute('data-code')));
      expect(codes.length, 'the battle-type summary draws at least two rows').toBeGreaterThan(1);
      expect(
        new Set(codes).size,
        `the drawn battle-type codes really repeat (${codes.length} rows, ${new Set(codes).size} distinct)`,
      ).toBeLessThan(codes.length);
      // The duplicate scan above excludes this table BY SCOPE, so this step is
      // also the proof the exclusion is not hiding a defect: the duplication
      // D-12 calls for is still really there, code for code.

      // T-09-22's other half: the pane rendered, and nothing complained about it.
      expect(
        consoleMessages.filter((message) => /duplicate key/i.test(message)),
        'no console message mentions a duplicate key',
      ).toEqual([]);
    });

    await test.step('the Device info pane draws each device once per account', async () => {
      // The device pane's exclusion from the duplicate scan needs the same
      // proof D-12's gets, for a different reason. D-11 makes every pane read
      // ALL accounts' rows and defers DEDUPE to Phase 10, and every root of this
      // fixture carries the same `Device_info` files — so the same device row
      // drawing three times is this phase's specified behaviour, not a dropped
      // or duplicated keyed row. Asserted here so the exclusion cannot rot into
      // hiding a defect of its own.
      await openSection(page, 'device-info');
      const section = page.getByTestId('dashboard-section-' + PANE_SECTION['device-info']);
      await expect(section, 'device-info: the section is open and ready').toHaveAttribute(
        'data-status',
        'ready',
        { timeout: 30_000 },
      );

      // The same settle wait the duplicate scan uses: this pane's tables are
      // read off the worker after the section already reads "ready", so reading
      // immediately would find zero rows and prove nothing.
      const readDeviceRows = async (): Promise<string[]> =>
        section
          .locator('[data-testid="device-info-table"] tbody tr')
          .evaluateAll((nodes) =>
            nodes.map((node) => (node.textContent ?? '').replace(/\s+/g, ' ').trim()),
          );
      let lastCount = -1;
      let stableReads = 0;
      let deviceRows: string[] = [];
      await expect
        .poll(
          async () => {
            deviceRows = await readDeviceRows();
            if (deviceRows.length !== lastCount) {
              lastCount = deviceRows.length;
              stableReads = 1;
            } else {
              stableReads += 1;
            }
            return stableReads;
          },
          { timeout: 30_000, intervals: [100, 200, 300, 500] },
        )
        .toBeGreaterThanOrEqual(3);
      expect(deviceRows.length, 'the device tables draw rows').toBeGreaterThan(0);
      expect(
        new Set(deviceRows).size,
        `each device really does draw once per account (${deviceRows.length} rows, ${new Set(deviceRows).size} distinct)`,
      ).toBeLessThan(deviceRows.length);
    });

    await test.step('the Account row and the Overview card name the accounts', async () => {
      // Placed AFTER the pane walk rather than before it: this step's wording
      // comes from Task 2's model, and the pane walk is Task 1's own proof. A
      // step order that fails on the later plan's wording would hide the earlier
      // plan's result.
      await openSection(page, 'overview');

      const row = await readAccountRow(page);
      expect(row.headline, 'the Account row headline is the account count').toBe(
        copy.formatAccountCount(3),
      );
      expect(row.summary, 'the Account row summary describes every account').toBe(
        copy.ACCOUNT_ROW_MULTI_SUMMARY,
      );

      // The card names the count and the EARLIEST creation date across the three
      // accounts, which the fixture wrote by hand for the EU root — a literal,
      // never a value read back off the page.
      const card = page.getByTestId('ov-card-account');
      await expect(card.locator('.label')).toHaveText(copy.formatAccountCount(3));
      await expect(card.locator('.summary')).toHaveText(
        copy.formatEarliestCreated(MA_CREATED_EU.slice(0, 10)),
      );

      // D-13 / UI-SPEC Surface 3: no single account's region and no nickname is
      // presented as the dataset's.
      await expect(card).not.toContainText(MA_REGION_EU);
      await expect(card).not.toContainText(MA_NICKNAME_EU);
      await expect(page.getByTestId('overview')).not.toContainText(MA_REGION_NA);
    });

    await test.step('the reload replays the same header and still leaks nothing', async () => {
      // The replay path: the account list comes off the CACHED meta record, not
      // from the parsed result still held in memory, so this is a different code
      // path (`accountsOfMeta`) and a separate proof.
      await page.reload();
      await expect(page.locator('main')).toHaveAttribute('data-worker-ready', 'true', {
        timeout: 10_000,
      });
      await expect(page.getByTestId('identity-multi-title')).toBeVisible({ timeout: 30_000 });

      await expectHeaderRows(page, 'after reload');
      await expectNoLeak(page, consoleMessages, 'after reload');

      await openSection(page, 'account');
      await expectNoLeak(page, consoleMessages, 'after reload, pane account');
    });

    await test.step('a one-account replace removes every caption and restores v1.0', async () => {
      // The other direction of the caption rule: one account is NOT a combined
      // dataset, so no caption node may exist at all — not a hidden one, not an
      // empty one — and the v1.0 header and Account row come back byte for byte.
      await replaceExport(page, SYNTHETIC_ZIP_NAME, buildSampleExport());

      await expect(page.getByTestId('identity-nickname'), 'the v1.0 header is back').toHaveText(
        SAMPLE_NICKNAME,
      );
      await expect(page.getByTestId('identity-header')).toHaveAttribute('data-variant', 'loaded');
      await expect(page.getByTestId('identity-multi-title'), 'no multi header').toHaveCount(0);

      const row = await readAccountRow(page);
      expect(row.headline, 'the Account row is the single account region again').toBe(
        SAMPLE_REGION,
      );

      for (const pane of PANES_WITH_CAPTION) {
        await openSection(page, pane);
        await expect(
          page.getByTestId('combined-caption'),
          `${pane}: no caption for one account`,
        ).toHaveCount(0);
      }

      // And the card is the single-account wording again, which is the stronger
      // statement: it proves the multi branch is a branch and not a new default.
      await openSection(page, 'overview');
      await expect(page.getByTestId('ov-card-account').locator('.summary')).toHaveText(
        `${copy.IDENTITY_CREATED_LABEL} ${SAMPLE_CREATED_DATE}`,
      );
    });

    await test.step('no page error and no console error across the whole flow', async () => {
      expect(pageErrors, 'no uncaught page error').toEqual([]);
      // Vite's dev/build banner is not an error, but a thrown render failure is,
      // and this is the assertion that catches a pane that "opened" by rendering
      // nothing at all.
      expect(
        consoleMessages.filter((message) => /^uncaught|error:/i.test(message)),
        'no console error',
      ).toEqual([]);
    });
  });

  // =============================================================================
  // 09-06 Task 1 — the one-dataset lifecycle (roadmap SC3, ACCOUNT-08)
  //
  // The SECOND and last listed test this phase adds (D-23: 256 measured before
  // the phase, 258 is the ceiling). The fixture MATRIX for one, two and three
  // accounts is already unit-tested through the real worker by plan 09-03, so
  // the browser runs the chain once: 3 accounts, a reload, the identical bytes,
  // a 2-account replace, a Clear, then 3 again, a 1-account replace and a Start
  // Over — every account count and both destructive controls.
  //
  // What only a browser can prove is the AT REST half (T-09-23): after every
  // step the raw store holds exactly the current dataset's accounts, and after
  // Clear or Start Over it holds no row and no meta record at all. A fake
  // IndexedDB cannot stand in for the real worker transaction that replaces
  // the dataset.
  // =============================================================================
  test('(b) one cached dataset survives reload, duplicate, replace, clear and start over with three, two and one accounts', async ({
    page,
  }) => {
    // Five archives and two reloads. The same generous budget test (a) sets,
    // because a timeout here would read as a lifecycle failure.
    test.setTimeout(240_000);

    const pageErrors = collectPageErrors(page);
    const threeRoots = sortedRoots([MA_ROOT_RU, MA_ROOT_EU, MA_ROOT_NA]);
    // ONE byte array, handed to both imports: fflate stamps each archive with a
    // second-resolution mtime, so a second `buildRealShapeThreeAccountExport()`
    // call would be a DIFFERENT file and the duplicate path unreachable.
    const threeAccountBytes = buildRealShapeThreeAccountExport();

    let rowsAfterImport = 0;

    await gotoApp(page);
    await importExport(page, SYNTHETIC_ZIP_NAME, threeAccountBytes);

    await test.step('a three-account import stores exactly the three roots', async () => {
      await expectHeaderRows(page, 'lifecycle import');
      const snapshot = await readStoreSnapshot(page);
      expect(snapshot.rowCount, 'the store holds rows').toBeGreaterThan(0);
      expect(snapshot.accounts, 'the stored rows belong to exactly the three roots').toEqual(
        threeRoots,
      );
      expect(snapshot.metaCount, 'exactly one dataset record').toBe(1);
      rowsAfterImport = snapshot.rowCount;
    });

    await test.step('a reload replays the same three rows without re-uploading', async () => {
      await page.reload();
      await expect(page.locator('main')).toHaveAttribute('data-worker-ready', 'true', {
        timeout: 10_000,
      });
      await expect(page.getByTestId('identity-multi-title')).toBeVisible({ timeout: 30_000 });

      await expectHeaderRows(page, 'lifecycle after reload');
      await expect(page.getByTestId('processing-status')).toHaveCount(0);
      // "No re-upload" is proved by the input itself being empty (03-07's
      // argument), because the co-rendered dropzone is the D-13 replace affordance
      // rather than the thing that is absent once a dataset is loaded.
      await expect(page.getByTestId('file-input')).toHaveJSProperty('files.length', 0);

      const snapshot = await readStoreSnapshot(page);
      expect(snapshot.accounts, 'the reload changed nothing at rest').toEqual(threeRoots);
      expect(snapshot.rowCount, 'the reload wrote no rows').toBe(rowsAfterImport);
    });

    await test.step('the identical archive reports a duplicate and changes nothing', async () => {
      // The replace confirmation PRECEDES the worker's hash check, so the
      // duplicate is reached through the same confirm panel as any other replace.
      await replaceExport(page, SYNTHETIC_ZIP_NAME, threeAccountBytes);

      await expect(page.getByTestId('duplicate-notice')).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId('duplicate-notice')).toHaveText(copy.DUPLICATE_BANNER_MESSAGE);
      await expectHeaderRows(page, 'lifecycle after duplicate');

      const snapshot = await readStoreSnapshot(page);
      expect(snapshot.accounts, 'a duplicate leaves the accounts alone').toEqual(threeRoots);
      expect(snapshot.rowCount, 'a duplicate writes no rows').toBe(rowsAfterImport);
    });

    await test.step('a two-account replace leaves no row of the removed account', async () => {
      await replaceExport(page, SYNTHETIC_ZIP_NAME, buildTwoAccountExport());

      await expect(page.getByTestId('identity-multi-title')).toHaveText(copy.formatAccountCount(2));
      const rows = page.getByTestId('identity-multi-row');
      await expect(rows).toHaveCount(2);
      // D-16 order survives the replace: EU (2018) then NA (2021).
      await expect(rows.nth(0).getByTestId('identity-multi-name')).toHaveText(MA_NICKNAME_EU);
      await expect(rows.nth(1).getByTestId('identity-multi-name')).toHaveText(MA_NICKNAME_NA);

      const snapshot = await readStoreSnapshot(page);
      expect(snapshot.accounts, 'the store holds exactly the two new roots').toEqual(
        sortedRoots([MA_ROOT_EU, MA_ROOT_NA]),
      );
      expect(snapshot.accounts, 'no row of the replaced account survives').not.toContain(
        MA_ROOT_RU,
      );
      rowsAfterImport = snapshot.rowCount;
    });

    await test.step('Clear my cached data empties the store', async () => {
      const control = page.getByTestId('clear-data-control');
      await expect(control, 'the dedicated clear control is on screen').toBeVisible();
      await control.click();

      const panel = page.getByTestId('confirm-panel');
      await expect(panel).toBeVisible();
      await panel.getByTestId('confirm-commit').click();

      await expect(page.getByTestId('cleared-ack')).toHaveText(copy.CLEARED_ACK_MESSAGE);
      await expect(page.getByTestId('identity-header')).toHaveAttribute('data-variant', 'skeleton');

      const snapshot = await readStoreSnapshot(page);
      expect(snapshot.rowCount, 'a clear leaves no row').toBe(0);
      expect(snapshot.metaCount, 'a clear leaves no dataset record').toBe(0);
      expect(snapshot.accounts, 'a clear leaves no account at all').toEqual([]);
    });

    await test.step('a three-account import after the clear is a first import again', async () => {
      // No confirm panel: a cleared store is a FIRST import (D-15/D-16), and the
      // count assertion is what proves it rather than assuming it.
      await importExport(page, SYNTHETIC_ZIP_NAME, threeAccountBytes);
      await expect(page.getByTestId('confirm-panel')).toHaveCount(0);

      await expectHeaderRows(page, 'lifecycle second import');
      const snapshot = await readStoreSnapshot(page);
      expect(snapshot.accounts, 'the three roots are back').toEqual(threeRoots);
      rowsAfterImport = snapshot.rowCount;
    });

    await test.step('a one-account replace restores the v1.0 header', async () => {
      await replaceExport(page, SYNTHETIC_ZIP_NAME, buildOneAccountExport());

      await expect(page.getByTestId('identity-nickname')).toHaveText(MA_NICKNAME_EU);
      await expect(page.getByTestId('identity-header')).toHaveAttribute('data-variant', 'loaded');
      await expect(page.getByTestId('identity-multi-title'), 'no multi header').toHaveCount(0);

      const snapshot = await readStoreSnapshot(page);
      expect(snapshot.accounts, 'the store holds exactly the one root').toEqual([MA_ROOT_EU]);
    });

    // Plan 09-11, Truth 21. The second folder is a real archive entry that stores
    // nothing, so the published list has ONE account while the archive held two,
    // and the header must not turn into the single-account variant (which would
    // present the first folder's region and creation date as the export's).
    await test.step('a two-folder archive with one data-less folder keeps the multi header', async () => {
      await replaceExport(page, SYNTHETIC_ZIP_NAME, buildOneDataLessOfTwoExport());
      await expectOneOfTwoHeader(page, 'one of two, fresh import');

      await openSection(page, 'overview');
      const card = page.getByTestId('ov-card-account');
      await expect(card.locator('.label')).toHaveText(copy.formatAccountCount(1));
      await expect(card.locator('.summary')).toHaveText(
        copy.formatEarliestCreated(MA_CREATED_EU.slice(0, 10)),
      );
      await expect(card).not.toContainText(MA_REGION_EU);

      // The published count still decides every caption (09-10 option-a), so a
      // one-account list carries none on any of the six panes.
      for (const pane of PANES_WITH_CAPTION) {
        await openSection(page, pane);
        await expect(
          page.getByTestId('combined-caption'),
          `${pane}: no caption for one published account`,
        ).toHaveCount(0);
      }

      // The replay path: the root count comes off the cached meta record.
      await page.reload();
      await expect(page.locator('main')).toHaveAttribute('data-worker-ready', 'true', {
        timeout: 10_000,
      });
      await expect(page.getByTestId('identity-multi-title')).toBeVisible({ timeout: 30_000 });
      await expectOneOfTwoHeader(page, 'one of two, after reload');
    });

    await test.step('Start Over empties the store and a reload stays empty', async () => {
      await startOver(page);

      const snapshot = await readStoreSnapshot(page);
      expect(snapshot.rowCount, 'Start Over leaves no row').toBe(0);
      expect(snapshot.metaCount, 'Start Over leaves no dataset record').toBe(0);

      await page.reload();
      await expect(page.locator('main')).toHaveAttribute('data-worker-ready', 'true', {
        timeout: 10_000,
      });
      await expect(page.getByTestId('identity-header')).toHaveAttribute(
        'data-variant',
        'skeleton',
        {
          timeout: 30_000,
        },
      );
      await expect(page.getByTestId('persistent-bar')).toHaveCount(0);

      const afterReload = await readStoreSnapshot(page);
      expect(afterReload.rowCount, 'the reload found nothing cached').toBe(0);
      expect(afterReload.metaCount, 'the reload found no dataset record').toBe(0);
    });

    // 09-06 Task 2 — the phone layout with long untrusted text.
    //
    // This step MEASURES; whether the wrapped result reads well is a visual
    // judgement, so it is recorded as a backstop truth and routed to a human
    // rather than asserted here. What is asserted is the measurable half: no
    // horizontal overflow, every row inside the viewport, and the FULL text
    // present in the rendered DOM (never truncated with an ellipsis, never
    // clipped by `text-overflow`).
    await test.step('at 375px a 40-character nickname and a 20-digit id stay readable', async () => {
      await page.setViewportSize({ width: 375, height: 812 });
      // A first import: the store was emptied by Start Over, so nothing may ask
      // for a confirmation here.
      await importExport(page, SYNTHETIC_ZIP_NAME, buildLongTextAccountsExport());
      await ensureListScreen(page);

      await expect(page.getByTestId('identity-header')).toHaveAttribute('data-variant', 'multi');
      await expect(page.getByTestId('identity-multi-row')).toHaveCount(2);

      const viewport = await page.evaluate(() => ({
        innerWidth: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(
        viewport.scrollWidth,
        'the document is never wider than the viewport',
      ).toBeLessThanOrEqual(viewport.innerWidth);

      // Every row, its name and its ID line, plus its right edge — read as the
      // layout actually laid out rather than as a style rule.
      const drawn = await page.getByTestId('identity-multi-row').evaluateAll((nodes) =>
        nodes.map((node) => ({
          name:
            node.querySelector('[data-testid="identity-multi-name"]')?.textContent?.trim() ?? '',
          id: node.querySelector('[data-testid="identity-multi-id"]')?.textContent?.trim() ?? '',
          right: node.getBoundingClientRect().right,
        })),
      );
      expect(drawn, 'both rows are drawn').toHaveLength(2);
      for (const row of drawn) {
        expect(row.right, `a row ends at ${row.right}px`).toBeLessThanOrEqual(viewport.innerWidth);
      }

      // Matched by VALUE, not by index: neither of these two roots has any
      // activity, so their D-16 order is a tie this test has no reason to know.
      const long = drawn.find((row) => row.name === MA_LONG_NICKNAME);
      expect(
        long,
        `the long nickname is rendered in full (rows: ${drawn.map((r) => r.name)})`,
      ).toBeDefined();
      expect(long!.id, 'the 20-digit account id is rendered in full').toContain(MA_LONG_ROOT);
    });

    await test.step('no page error across the lifecycle', async () => {
      expect(pageErrors, 'no uncaught page error').toEqual([]);
    });
  });
});
