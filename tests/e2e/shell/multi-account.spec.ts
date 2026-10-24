import '../_support/pin-locale';
import { expect, test, type ConsoleMessage, type Locator, type Page } from '@playwright/test';
import {
  MA_CANARIES,
  MA_CHAT_CANARY,
  MA_EXPECTED_GAMES,
  MA_EXPECTED_PLAYTIME,
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
  SAMPLE_NICKNAME,
  SAMPLE_REGION,
  buildSampleExport,
} from '../../fixtures/export-fixtures.ts';
import { formatAccountId } from '../../../src/lib/ui-copy.ts';
import { ORDERS_HAND_EXPECTED } from '../../fixtures/finance-fixtures.ts';
import { REAL_SHAPE_IP } from '../../fixtures/playtime-real-shape-fixture.ts';
import { maskIp } from '../../../src/lib/geo/ip.ts';
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
 * The address every session row in the three-account fixture shares.
 *
 * `buildRealShapeCsv` fills the IP column with `REAL_SHAPE_IP` for a row that
 * names none, and all three roots have such rows — so this is the busiest
 * address and the one that must carry all three letters (D-18). It is imported
 * from the fixture rather than written out so the step cannot drift from the
 * archive it is reading.
 */
const MA_SHARED_IP = REAL_SHAPE_IP;

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
  // This "exactly once" block is a SINGLE-ACCOUNT-pane rule and is deliberately
  // not loosened for Phase 10. Every call site below runs on a view that carries
  // no tagged rows (the landing view, the Account pane and the post-reload
  // replay of each), where the nickname is still visible exactly once in the
  // header. A TAGGED pane repeats the nickname into one visually-hidden phrase
  // per drawn row (D-19), so there the count is a function of the window and
  // `expectNicknameTextOnly` below states the rule that does hold on every pane:
  // text count equals markup count, and no attribute holds either nickname.
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
 * D-19 RESTATED for a TAGGED pane: a nickname is TEXT and only text.
 *
 * `expectNoLeak` above cannot be used here, and the difference is the point.
 * Its rule is "exactly once in the document", which is a single-account rule: on
 * a one-account pane the nickname is visible once in the header and nowhere
 * else. Phase 10's tag puts the nickname into a visually-hidden phrase on EVERY
 * tagged Vehicles row (D-19, relaxing v1.0's D-21 for those rows), so the count
 * on a tagged pane is a function of how many rows the window drew — a number no
 * test should hardcode.
 *
 * What does NOT vary is WHERE each occurrence lives. The rule here is
 * COUNT-IN-TEXT == COUNT-IN-MARKUP, per nickname: an occurrence in a `title`, an
 * `aria-label`, a `data-*` value or any other attribute would be a second
 * occurrence of the raw literal in `outerHTML` that `innerText` cannot match,
 * because Svelte's text interpolation writes a value as text while an attribute
 * carrying it repeats the same literal in the markup. The second assertion
 * closes the loophole from the other side: no attribute VALUE anywhere in the
 * detail pane or the identity header may hold either nickname or any of the
 * three roots, which is stronger than counting because it does not depend on how
 * many rows happened to draw.
 */
async function expectNicknameTextOnly(
  page: Page,
  where: string,
  scopeSelector = '[data-testid="player-stats"]',
): Promise<void> {
  const surface = await readPageSurface(page);

  for (const nickname of [MA_NICKNAME_EU, MA_NICKNAME_NA]) {
    expect(
      countOccurrences(surface.outerHtml, nickname),
      `${where}: ${nickname} occurs as often in the markup as in the text, so never in an attribute`,
    ).toBe(countOccurrences(surface.innerText, nickname));
  }

  // A control that cannot pass on a page that drew nothing: a pane with no
  // tagged row would satisfy both equalities trivially with zero on both sides.
  expect(
    countOccurrences(surface.innerText, MA_NICKNAME_EU),
    `${where}: the EU nickname is drawn as text at least once`,
  ).toBeGreaterThanOrEqual(1);

  const offenders = await page.evaluate(
    ([needles, scopeSelectors]) => {
      const found: string[] = [];
      for (const selector of scopeSelectors) {
        const scope = document.querySelector(selector);
        if (scope === null) {
          found.push(`${selector} is absent, so this scan proved nothing`);
          continue;
        }
        for (const element of scope.querySelectorAll('*')) {
          for (const attribute of element.attributes) {
            for (const needle of needles) {
              if (attribute.value.includes(needle)) {
                found.push(`${selector} ${element.tagName}[${attribute.name}] holds ${needle}`);
              }
            }
          }
        }
      }
      return found;
    },
    [
      [MA_NICKNAME_EU, MA_NICKNAME_NA, MA_ROOT_RU, MA_ROOT_EU, MA_ROOT_NA],
      // The pane under test, named by the caller rather than hardcoded to
      // Vehicles: the rule is the rule for every TAGGED pane, and a hardcoded
      // selector would have made this scan pass vacuously on any other one —
      // which the `is absent` branch above reports as the failure it is.
      [scopeSelector, '[data-testid="identity-header"]'],
    ] as const,
  );
  expect(offenders, `${where}: no attribute holds a nickname or an account id`).toEqual([]);
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
 * The account phrase of every DRAWN Vehicles row, in drawing order.
 *
 * Read through the tag's own sibling rather than off the cell's text: the cell
 * holds the chip, the hidden phrase, the nation chip and the vehicle id, so its
 * text is the cell and not the phrase (D-10). An empty string means the row
 * carries no tag at all, which on a multi-account dataset is a failure the
 * caller sees as a mismatched phrase rather than as a missing node.
 */
async function readVehicleTagPhrases(page: Page): Promise<string[]> {
  return page
    .getByTestId('vehicle-row')
    .locator('td.sticky-first')
    .evaluateAll((cells) =>
      cells.map((cell) =>
        (
          cell.querySelector('[data-testid="account-tag"]')?.nextElementSibling?.textContent ?? ''
        ).trim(),
      ),
    );
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

    // =============================================================================
    // 10-02 Task 1 — the game filter chip row (ACCOUNT-06, D-01/D-03/D-05)
    //
    // One click in, real numbers out. The expected figures are the
    // `MA_EXPECTED_PLAYTIME` literals, hand-derived in the fixture beside the
    // session rows that produce them and NOT read back off the page — so a
    // change in the aggregator cannot move this expectation with it.
    //
    // HEAT and WOTC are the interesting half: they have real sessions AND
    // their own chip, since 11-01 (D-05, D-13) — the worker already stored a
    // per-game scope for each, and making the file readable was all that was
    // missing. So the six chips below are All games plus the five filterable
    // tokens, while the all-games total is still larger than those five added
    // together (two accounts overlap across games).
    // =============================================================================
    await test.step('the game filter narrows Playtime to one game across all accounts', async () => {
      await openSection(page, 'playtime');
      await expect(page.getByTestId('playtime')).toHaveAttribute('data-state', 'ready', {
        timeout: 30_000,
      });

      // The chips, named by the fixed token list rather than by a count, so a
      // chip for a non-filterable game (WOWP) and a MISSING chip for a
      // filterable one both fail here.
      for (const chip of ['all', 'wot', 'wotb', 'wows', 'wotc', 'heat']) {
        await expect(
          page.getByTestId(`game-filter-chip-${chip}`),
          `the ${chip} chip exists`,
        ).toHaveCount(1);
      }

      await page.getByTestId('game-filter-chip-wot').click();
      await expect(page.getByTestId('playtime')).toHaveAttribute('data-state', 'ready');
      await expect(page.getByTestId('playtime-total-hours')).toHaveText(
        copy.formatHours(MA_EXPECTED_PLAYTIME.byGame.WOT.seconds),
      );
      await expect(page.getByTestId('playtime-total-sessions')).toHaveText(
        String(MA_EXPECTED_PLAYTIME.byGame.WOT.sessions),
      );
      await expect(page.getByTestId('playtime-active-days')).toHaveText(
        String(MA_EXPECTED_PLAYTIME.byGame.WOT.days),
      );
      await expect(
        page.getByTestId('game-filter-chip-wot').locator('input'),
        'the WoT radio is the checked one',
      ).toBeChecked();

      // And back to All, which restores the merged figure — the one that counts
      // HEAT and WOTC as well.
      await page.getByTestId('game-filter-chip-all').click();
      await expect(page.getByTestId('playtime')).toHaveAttribute('data-state', 'ready');
      await expect(page.getByTestId('playtime-total-hours')).toHaveText(
        copy.formatHours(MA_EXPECTED_PLAYTIME.all.seconds),
      );
      await expect(page.getByTestId('playtime-total-sessions')).toHaveText(
        String(MA_EXPECTED_PLAYTIME.all.sessions),
      );
      await expect(page.getByTestId('playtime-active-days')).toHaveText(
        String(MA_EXPECTED_PLAYTIME.all.days),
      );
    });

    // =============================================================================
    // 10-02 Task 3 — Vehicles follows the shared filter, and the filter is
    // session-only (ACCOUNT-06, D-04, D-21)
    //
    // One cell, two faces. Playtime offers it as chips and Vehicles as the Game
    // select it already had; no second widget appears on Vehicles, so the round
    // trip is proven by the SELECT's value changing and the chips changing
    // back, not by anything new on the page.
    // =============================================================================
    await test.step('Vehicles follows the shared filter through its own Game select', async () => {
      await page.getByTestId('game-filter-chip-wotb').click();
      await expect(page.getByTestId('playtime')).toHaveAttribute('data-state', 'ready');

      await openSection(page, 'vehicles');
      const block = playerStatsBlock(page);
      await expect(block).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });
      await expect(block.getByTestId('player-stats-title-selector')).toHaveValue('wotb');
      expect(
        await page.getByTestId('vehicle-row').count(),
        'the Blitz table has rows',
      ).toBeGreaterThan(0);

      // And the other direction: a title chosen HERE sets the filter Playtime
      // reads. D-21 for WoT.
      await block.getByTestId('player-stats-title-selector').selectOption('wot');
      await openSection(page, 'playtime');
      await expect(page.getByTestId('playtime')).toHaveAttribute('data-state', 'ready');
      await expect(
        page.getByTestId('game-filter-chip-wot').locator('input'),
        'the WoT chip is checked after choosing WoT on Vehicles',
      ).toBeChecked();
      await expect(page.getByTestId('playtime-total-hours')).toHaveText(
        copy.formatHours(MA_EXPECTED_PLAYTIME.byGame.WOT.seconds),
      );

      // Warplanes is Vehicles-local: it writes nothing, so the filter is still
      // WoT when the reader comes back.
      await openSection(page, 'vehicles');
      await playerStatsBlock(page).getByTestId('player-stats-title-selector').selectOption('wowp');
      await openSection(page, 'playtime');
      await expect(
        page.getByTestId('game-filter-chip-wot').locator('input'),
        'Warplanes left the shared filter alone',
      ).toBeChecked();

      // All games hands the title choice back to the worker, whose own
      // first-title-with-rows rule then decides. Which title that is is the
      // worker's answer, not a contract, so only "the select shows a title"
      // is asserted here (UI-SPEC Recorded Choices 1 and 4).
      await page.getByTestId('game-filter-chip-all').click();
      await expect(page.getByTestId('playtime')).toHaveAttribute('data-state', 'ready');
      await openSection(page, 'vehicles');
      await expect(playerStatsBlock(page)).toHaveAttribute('data-state', 'ready', {
        timeout: 30_000,
      });
      expect(
        await playerStatsBlock(page).getByTestId('player-stats-title-selector').inputValue(),
        'the select shows whichever title the worker applied',
      ).toMatch(/^(wot|wotb|wows|wowp)$/);
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

    await test.step('the Vehicles pane repeats the ids and folds the codes (D-09, D-20)', async () => {
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

      // Read the id from its own `.id` span rather than from the cell's text.
      // The cell's text is now the account tag's letter and hidden phrase plus
      // the nation chip plus the id (D-10), so `allInnerTexts()` on the cell
      // would no longer be "the vehicle id" — it would be the cell.
      const ids = await page
        .getByTestId('vehicle-row')
        .locator('td.sticky-first .id')
        .allInnerTexts();
      const distinctIds = new Set(ids.map((text) => text.trim()));
      // D-09's half that does NOT change: a vehicle two accounts own stays two
      // rows, because merging them would invent a battle count that belongs to
      // neither account.
      expect(
        distinctIds.size,
        `the drawn Blitz rows still repeat an id (${drawnRows} rows, ${distinctIds.size} distinct)`,
      ).toBeLessThan(drawnRows);

      const summary = page.getByTestId('battle-type-summary');
      const codes = await summary
        .getByTestId('battle-type-row')
        .evaluateAll((rows) => rows.map((row) => row.getAttribute('data-code')));
      expect(codes.length, 'the battle-type summary draws at least two rows').toBeGreaterThan(1);
      // D-09's other half — PHASE 10, and the flip this step's name records.
      // The summary FOLDS across accounts, so a code two roots both wrote is one
      // row with their figures added up. This assertion is the inverse of
      // Phase 9's, which is why the step was renamed rather than reworded: a
      // duplicate-key failure here is now a regression, not the expected shape.
      expect(
        new Set(codes).size,
        `the drawn battle-type codes are now distinct (${codes.length} rows, ${new Set(codes).size} distinct)`,
      ).toBe(codes.length);

      // D-20: two accounts contribute a row, so the lifetime battles SUM and
      // the premium expiry is dropped rather than filled with one account's
      // value. The header is still there — one honest figure beats none.
      await expect(
        block.getByTestId('player-stats-header'),
        'the combined header is shown',
      ).toHaveCount(1);
      await expect(
        block.getByTestId('lifetime-battles'),
        'the combined lifetime figure is shown',
      ).toHaveCount(1);
      await expect(
        block.getByTestId('premium-expires'),
        'no account’s expiry is presented as the combined figure',
      ).toHaveCount(0);

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

    await test.step('the Account row names the accounts and the Overview carries no account detail', async () => {
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

      // D-13 / UI-SPEC Surface 3: no single account's region and no nickname is
      // presented as the dataset's, and the insights page carries no Account
      // tile at all (the Account row and the identity header keep these facts).
      const overview = page.getByTestId('overview');
      await expect(overview).not.toContainText(MA_REGION_EU);
      await expect(overview).not.toContainText(MA_REGION_NA);
      await expect(overview).not.toContainText(MA_NICKNAME_EU);
      await expect(overview).not.toContainText(MA_NICKNAME_NA);

      // D-15 (10-05): no pane-level combined total, currency note or per-account
      // split appears on the Overview.
      await expect(page.getByTestId('overview').getByTestId('finance-combined-note')).toHaveCount(
        0,
      );
      await expect(page.getByTestId('overview').getByTestId('spend-per-account')).toHaveCount(0);
    });

    // =============================================================================
    // 10-03 Task 1 — D-10: the account tag, in the legend and on a Vehicles row
    // (ACCOUNT-04, T-10-08, T-10-09)
    //
    // Three things at once, because the tag is only useful if all three hold:
    // the header row shows the letter, a data row shows the SAME letter, and the
    // full phrase is TEXT — an account ID and a nickname in a visually-hidden
    // span and nowhere else.
    // =============================================================================
    await test.step('the account tag names each account in the header and on a Vehicles row', async () => {
      // (1) THE LEGEND. Three chips, letters A, B, C, in the D-16 order the
      // header rows are already asserted in: RU, EU, NA.
      const headerRows = page.getByTestId('identity-multi-row');
      await expect(headerRows, 'the legend has one row per account').toHaveCount(3);
      const lettersByRoot: Record<string, string> = {};
      for (const [index, root] of [MA_ROOT_RU, MA_ROOT_EU, MA_ROOT_NA].entries()) {
        const tag = headerRows.nth(index).getByTestId('account-tag');
        await expect(tag, `${root}: one chip in its row`).toHaveCount(1);
        const letter = (await tag.innerText()).trim();
        expect(letter, `${root}: the chip is one letter`).toMatch(/^[A-Z]{1,2}$/);
        lettersByRoot[root] = letter;

        // The legend phrase is `Account {letter}` and NOTHING more: the row
        // already shows the nickname and the ID as visible text, and repeating
        // them in hidden text would break D-21's once-per-row rule.
        await expect(tag.locator('xpath=following-sibling::span[1]')).toHaveText(
          copy.formatAccountLegendLabel(letter),
        );
      }
      expect(lettersByRoot[MA_ROOT_RU], 'RU is A').toBe('A');
      expect(lettersByRoot[MA_ROOT_EU], 'EU is B').toBe('B');
      expect(lettersByRoot[MA_ROOT_NA], 'NA is C').toBe('C');

      // (2) THE DATA ROWS. The Blitz title, whose vehicle file is in all three
      // roots — so drawn rows genuinely carry more than one account's letter.
      await openSection(page, 'vehicles');
      const block = playerStatsBlock(page);
      await expect(block).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });
      await block.getByTestId('player-stats-title-selector').selectOption('wotb');
      await expect(block).toHaveAttribute('data-state', 'ready');

      const rows = page.getByTestId('vehicle-row');
      const drawnRows = await rows.count();
      expect(drawnRows, 'the Blitz table draws rows').toBeGreaterThan(0);

      const drawnTags = await rows.locator('td.sticky-first').evaluateAll((cells) =>
        cells.map((cell) => {
          const tag = cell.querySelector('[data-testid="account-tag"]');
          const hidden = tag?.nextElementSibling;
          return {
            letter: (tag?.textContent ?? '').trim(),
            ariaHidden: tag?.firstElementChild?.getAttribute('aria-hidden'),
            phrase: (hidden?.textContent ?? '').trim(),
          };
        }),
      );
      // EVERY drawn row is tagged: a row whose root the map did not hold would
      // be silent, which is exactly the gap this step exists to close.
      expect(
        drawnTags.every((entry) => entry.letter !== ''),
        'every drawn Vehicles row carries a letter',
      ).toBe(true);

      // The letters the rows wear are the letters the legend assigned.
      const expectedLetters = Object.values(lettersByRoot);
      for (const entry of drawnTags) {
        expect(expectedLetters, `${entry.letter} is one of the legend's letters`).toContain(
          entry.letter,
        );
        // The letter itself is hidden from assistive technology, because the
        // phrase beside it says the same thing in words.
        expect(entry.ariaHidden, 'the bare letter is not announced').toBe('true');
      }

      // At least one row per letter DRAWN, so the check above is not vacuous on
      // a window that happens to hold one account's rows. Which accounts are
      // drawn is the windowing's business, not this step's.
      const drawnLetters = new Set(drawnTags.map((entry) => entry.letter));
      expect(
        drawnLetters.size,
        `drawn letters were ${[...drawnLetters].join(', ')}`,
      ).toBeGreaterThanOrEqual(2);

      // (3) THE PHRASE, which is where the account and its row are tied
      // together. It opens with the letter and the account's own root, and the
      // root is the legend's account for that letter — so a row attributed to
      // the wrong account fails here rather than passing on a letter that
      // happened to be right.
      //
      // The nickname clause (D-19) follows the ACCOUNT and not the row: an
      // account with a nickname ends its phrase with it, and the RU account —
      // which has no `User_Info` row at all (D-17) — stops at the ID. Asserted
      // per drawn row rather than for a named account, because which accounts
      // the window holds is the virtualiser's business, not this step's.
      const nicknameOf: Record<string, string> = {
        [MA_ROOT_RU]: '',
        [MA_ROOT_EU]: MA_NICKNAME_EU,
        [MA_ROOT_NA]: MA_NICKNAME_NA,
      };
      for (const entry of drawnTags) {
        const root = Object.entries(lettersByRoot).find(
          ([, letter]) => letter === entry.letter,
        )?.[0];
        expect(root, `letter ${entry.letter} maps to a known account`).toBeDefined();
        expect(
          entry.phrase.startsWith(`Account ${entry.letter}, ID ${root}`),
          `${entry.letter}'s phrase opens with its own account`,
        ).toBe(true);
        const nickname = root === undefined ? undefined : nicknameOf[root];
        if (nickname === undefined || nickname === '') {
          expect(entry.phrase, `${root ?? entry.letter}: no nickname clause`).not.toContain(
            'nickname',
          );
        } else {
          expect(entry.phrase, `${root}: the phrase ends with its own nickname`).toBe(
            `Account ${entry.letter}, ID ${root}, nickname ${nickname}`,
          );
        }
      }
    });

    // =============================================================================
    // Plan 10-03 Task 3 — D-11 (the account is searchable TEXT) and D-19's
    // privacy rule restated for a tagged pane.
    //
    // The three facts below are asserted in this order on purpose. The hint is
    // asserted BEFORE any typing, because a filter that works but is
    // undiscoverable is a defect D-11 exists to prevent and a missing hint is
    // easy to miss when the table has already narrowed to one account.
    // =============================================================================
    await test.step('the Vehicles search finds an account by its ID and by its letter (D-11)', async () => {
      const block = playerStatsBlock(page);
      const search = block.getByTestId('vehicle-search');

      // (1) THE HINT, and the link that announces it with the input rather than
      // leaving it to be read as an unrelated paragraph under the controls.
      const hint = block.getByTestId('vehicle-search-hint');
      await expect(hint, 'a multi-account dataset shows the search hint').toHaveCount(1);
      await expect(hint, 'the hint is the sentence the unit test pins').toHaveText(
        copy.VEHICLE_SEARCH_ACCOUNT_HINT,
      );
      const describedBy = await search.getAttribute('aria-describedby');
      expect(describedBy, 'the input is described').not.toBeNull();
      expect(
        await hint.getAttribute('id'),
        'the id the input names IS the hint, so the reference resolves',
      ).toBe(describedBy);

      // (2) BY ACCOUNT ID. `filterRows` compares the root as its own field, so
      // every drawn row is that account's — and its phrase ends with its own
      // nickname, which is the half of the phrase an ID query cannot fake.
      await search.fill(MA_ROOT_EU);
      await expect
        .poll(() => readVehicleTagPhrases(page), { timeout: 10_000 })
        .toEqual([
          copy.formatAccountTagLabel('B', MA_ROOT_EU, MA_NICKNAME_EU),
          copy.formatAccountTagLabel('B', MA_ROOT_EU, MA_NICKNAME_EU),
          copy.formatAccountTagLabel('B', MA_ROOT_EU, MA_NICKNAME_EU),
        ]);
      // And the ID query found SOMETHING: the Blitz file holds three rows per
      // root, so an equal-length list of three is the whole account, not a
      // truncated window that happened to match.
      expect(
        await page.getByTestId('vehicle-row').count(),
        'the ID query draws the EU rows and nothing else',
      ).toBe(3);

      // (3) D-19, asserted on the pane that actually shows a nickname: every
      // occurrence is text, and no attribute anywhere in the pane or the header
      // holds either nickname or any of the three roots.
      await expectNicknameTextOnly(page, 'Vehicles pane, EU rows drawn');

      // (4) BY LETTER. `C` is the interesting needle here because none of this
      // fixture's Blitz ids contains the letter — `blitz_alpha`, `ussr:R12_Blitz`
      // and `blitz_gamma` — so every drawn row is NA's and the letter alone did
      // the narrowing. A needle that also matched ids would not separate the two
      // reasons a row was kept.
      await search.fill('C');
      await expect
        .poll(() => readVehicleTagPhrases(page), { timeout: 10_000 })
        .toEqual([
          copy.formatAccountTagLabel('C', MA_ROOT_NA, MA_NICKNAME_NA),
          copy.formatAccountTagLabel('C', MA_ROOT_NA, MA_NICKNAME_NA),
          copy.formatAccountTagLabel('C', MA_ROOT_NA, MA_NICKNAME_NA),
        ]);

      // The count line still reads as a count, and no-match copy is not what a
      // three-row answer shows — the hint promised account matching and the pane
      // delivered it.
      await expect(block.getByTestId('vehicle-count')).toContainText('3');

      // (5) Back to the whole table, so the rest of the test sees what it saw
      // before this step typed anything.
      await search.fill('');
      await expect(page.getByTestId('vehicle-row')).toHaveCount(9);
    });

    // =============================================================================
    // Plan 10-04 Task 1 — D-18 (one chip per account on a login row) and D-13
    // (ONE table, one map, no per-account record card).
    //
    // Logins are the one pane where a ROW is not owned by one account: an
    // address is one row however many accounts logged in from it, so this step
    // reads two rows rather than one — the address all three share, and the one
    // only the NA root holds. A table that quietly dropped one of the chips, or
    // drew the whole set as one chip, would still look tagged.
    // =============================================================================
    await test.step('the Login history rows name every account that logged in (D-18, D-13)', async () => {
      await openSection(page, 'login-history');
      const block = page.getByTestId('login-history');
      await expect(block).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });

      // D-13: ONE table and ONE map, and the Account record row is ABSENT —
      // with two or more accounts there is no single account record, so the
      // 'Account record' tag and the account chips never share a table.
      await expect(page.getByTestId('login-account-row'), 'no per-account record row').toHaveCount(
        0,
      );
      await expect(page.getByTestId('login-table'), 'one table across the accounts').toHaveCount(1);
      await expect(
        page.getByTestId('login-map-section'),
        'one map across the accounts',
      ).toHaveCount(1);

      const rows = page.getByTestId('login-row');
      await expect.poll(() => rows.count(), { timeout: 10_000 }).toBeGreaterThan(1);

      /**
       * The first cell of every drawn row, read from the DOM: its chips' letters
       * and the visually-hidden phrase beside each one.
       *
       * Read through `evaluateAll` rather than through Playwright locators because
       * the phrases live inside `.visually-hidden` spans, and a locator's text
       * would not separate a chip's letter from the phrase that follows it. The
       * rows are found by their CHIPS and never by their address, which is the
       * point of the whole step: while masked there is nothing to find them by.
       */
      const cellsOf = (): Promise<{ letters: string[]; phrases: string[] }[]> =>
        rows.locator('td.sticky-first').evaluateAll((nodes) =>
          nodes.map((cell) => {
            const tags = [...cell.querySelectorAll('[data-testid="account-tag"]')];
            const phrases = [...cell.querySelectorAll('.visually-hidden')].map((span) =>
              (span.textContent ?? '').trim(),
            );
            return {
              letters: tags.map((tag) => (tag.textContent ?? '').trim()),
              phrases,
            };
          }),
        );

      // The busiest row is the shared one: every session row in this fixture that
      // names no address carries `REAL_SHAPE_IP`, and all three roots have some.
      const busiest = rows.first();
      const busiestCell = busiest.locator('td.sticky-first');
      await expect(
        busiestCell.getByTestId('account-tag'),
        'the busiest row carries three chips',
      ).toHaveCount(3);
      const busiestLetters = await busiestCell
        .getByTestId('account-tag')
        .evaluateAll((tags) => tags.map((tag) => (tag.textContent ?? '').trim()));
      expect(busiestLetters, 'A, B, C in the published header order').toEqual(['A', 'B', 'C']);

      // Each chip's phrase names ITS OWN account — the letter, the root and (where
      // the account has one) the nickname. Tied to the header's own letters, so a
      // row attributed to the wrong account fails here rather than passing on a
      // letter that happened to be right.
      const busiestPhrases = await busiestCell
        .locator('.visually-hidden')
        .evaluateAll((spans) => spans.map((span) => (span.textContent ?? '').trim()));
      expect(busiestPhrases).toEqual([
        copy.formatAccountTagLabel('A', MA_ROOT_RU, null),
        copy.formatAccountTagLabel('B', MA_ROOT_EU, MA_NICKNAME_EU),
        copy.formatAccountTagLabel('C', MA_ROOT_NA, MA_NICKNAME_NA),
      ]);

      // The RU account has no `User_Info` row (D-17), so its phrase stops at the
      // ID rather than reading "nickname" and then nothing.
      expect(busiestPhrases[0], 'the ID-only account names no nickname').not.toContain('nickname');

      // Three chips draw no overflow count: `+N` is for accounts past the third,
      // and a three-account dataset has none.
      await expect(busiestCell.locator('.more'), 'no overflow at three').toHaveCount(0);

      // The lone-address rows: one chip, C. Only the NA root has a session file
      // whose row names its own address (the alias-header WOT row), so the one
      // address that belongs to a single account is C's — and the panel holds it
      // as ONE row, not one row per account.
      const drawn = await cellsOf();
      expect(drawn.length, 'the table drew rows').toBeGreaterThan(1);
      const oneChip = drawn.filter((cell) => cell.letters.length === 1);
      expect(oneChip.length, 'a row owned by one account exists').toBeGreaterThan(0);
      for (const cell of oneChip) {
        expect(cell.letters, 'the lone chip is C').toEqual(['C']);
        expect(cell.phrases).toEqual([copy.formatAccountTagLabel('C', MA_ROOT_NA, MA_NICKNAME_NA)]);
      }
      expect(
        drawn.filter((cell) => cell.letters.length === 3).length,
        'the shared address is ONE row, not one per account',
      ).toBe(1);

      // D-19 restated for this pane: every occurrence of a nickname or a root is
      // TEXT, and no attribute anywhere in the pane or the header holds one. The
      // chips are a second and third appearance in text, which is exactly what
      // `expectNicknameTextOnly` allows and `expectNoLeak`'s once-per-row rule
      // does not.
      await expectNicknameTextOnly(
        page,
        'Login history pane, tagged rows',
        '[data-testid="login-history"]',
      );

      // =======================================================================
      // Task 2 — ACCOUNT-07's "masking and the city opt-in unchanged". Four
      // claims, in the order they can fail: nothing is fetched, the address is
      // masked, the reveal is local to the text, and the merged figures still add
      // up. Each one is a claim about behaviour that Task 1 did not write, so a
      // failure here is a defect in Task 1 rather than something to fix here.
      // =======================================================================

      // (1) NOTHING IS FETCHED (T-10-13). The city detail is the project's one
      // sanctioned request and it is behind an explicit opt-in, so opening and
      // sorting the merged table must issue nothing at all. The listener is
      // registered HERE, so it covers this step's own requests and cannot be
      // fooled by an earlier one.
      const issued: string[] = [];
      const onRequest = (request: import('@playwright/test').Request): void => {
        issued.push(request.url());
      };
      page.on('request', onRequest);
      try {
        await page.getByTestId('login-sort-logins').click();
        await page.getByTestId('login-sort-ip').click();
        await expect(page.getByTestId('login-history')).toHaveAttribute('data-state', 'ready');
      } finally {
        page.off('request', onRequest);
      }
      expect(issued, 'opening and sorting the merged Login history fetched nothing').toEqual([]);
      // The control that makes the empty list mean something: the opt-in is on
      // screen and still idle, so a request WOULD be visible if one were made.
      await expect(page.getByTestId('city-optin')).toHaveAttribute('data-state', 'idle');

      // (2) MASKED, beside three chips. The busiest row's text holds the masked
      // form and not the address, and the whole document — markup included — does
      // not hold it either. The chips have changed what is IN the cell; they have
      // not changed what the cell says about the address.
      await page.getByTestId('login-sort-logins').click();
      await expect(page.getByTestId('login-row').first()).toBeVisible();
      const maskedText = await page.getByTestId('login-row').first().innerText();
      expect(maskedText, 'the busiest row shows the masked form').toContain(maskIp(MA_SHARED_IP));
      expect(maskedText, 'the busiest row does not show the address').not.toContain(MA_SHARED_IP);
      expect(
        await page.evaluate(() => document.documentElement.outerHTML),
        'no full address exists anywhere in the markup while masked',
      ).not.toContain(MA_SHARED_IP);

      // (3) THE REVEAL is one global action and it changes TEXT only. This is the
      // half `displayIp` has always owned; the chips are beside it and must not
      // turn an address into an attribute, so the scan covers EVERY attribute of
      // EVERY element in the pane after the reveal, not the row's own text.
      await page.getByTestId('login-mask-toggle').click();
      await expect
        .poll(async () => page.getByTestId('login-row').first().innerText(), { timeout: 5_000 })
        .toContain(MA_SHARED_IP);
      const attributeLeaks = await page.evaluate(
        ([needles]) => {
          const found: string[] = [];
          const scope = document.querySelector('[data-testid="login-history"]');
          if (scope === null) return ['the pane is absent, so this scan proved nothing'];
          for (const element of scope.querySelectorAll('*')) {
            for (const attribute of element.attributes) {
              for (const needle of needles) {
                if (attribute.value.includes(needle)) {
                  found.push(`${element.tagName}[${attribute.name}] holds ${needle}`);
                }
              }
            }
          }
          return found;
        },
        [[MA_SHARED_IP, MA_ROOT_RU, MA_ROOT_EU, MA_ROOT_NA, MA_NICKNAME_EU, MA_NICKNAME_NA]],
      );
      expect(
        attributeLeaks,
        'a revealed address, a root and a nickname are TEXT, never attributes',
      ).toEqual([]);
      // Back to masked, so every later step of this test sees what it saw before.
      await page.getByTestId('login-mask-toggle').click();
      await expect
        .poll(async () => page.getByTestId('login-row').first().innerText(), { timeout: 5_000 })
        .not.toContain(MA_SHARED_IP);

      // (4) THE MERGED FIGURES still add up (D-13, success criterion 4). One
      // country list and one map cover every account, and the drawn countries,
      // the not-drawn countries and the unknown-country row sum to the tile
      // total — the relationship `MAX_LOGIN_IPS` exists to keep and this plan's
      // tagging must leave alone. It is asserted as arithmetic rather than as
      // "the list is there", because a list that quietly lost a country would
      // still render.
      await expect(page.getByTestId('login-country').first()).toBeVisible();
      const countryTotals = await page.evaluate(() => {
        const digits = (text: string | null | undefined): number =>
          Number((text ?? '').replace(/[^0-9]/g, ''));
        const cell = (row: Element | null | undefined): number =>
          digits(row?.children[1]?.textContent);
        const drawn = [...document.querySelectorAll('[data-testid="country-row"]')].map(cell);
        const unknown = cell(document.querySelector('[data-testid="login-unknown-row"]'));
        // The count line is `{addresses} · {logins}` and is the LISTED figure.
        // This fixture is four orders of magnitude below `MAX_LOGIN_IPS`, so
        // listed logins and `totalLogins` are the same number here — which is
        // what lets a rendered DOM check restate the aggregate's sum.
        const countLine = document.querySelector('[data-testid="login-count"]')?.textContent ?? '';
        return { drawn, unknown, listedLogins: digits(countLine.split('·')[1]) };
      });
      expect(countryTotals.drawn.length, 'the country list drew rows').toBeGreaterThan(0);
      const countrySum = countryTotals.drawn.reduce((sum, value) => sum + value, 0);
      expect(
        countrySum + countryTotals.unknown,
        'the drawn countries plus the unknown row are the whole of the counted logins',
      ).toBe(countryTotals.listedLogins);
      // And the country count agrees with the tile above the table, so the list
      // is not showing fewer countries than the summary claims.
      expect(countryTotals.drawn.length, 'one row per drawn country').toBe(
        await page
          .getByTestId('login-tile-countries')
          .innerText()
          .then((text) => Number(text.replace(/[^0-9]/g, ''))),
      );
      await expectNicknameTextOnly(
        page,
        'Login history pane, tagged rows after the reveal',
        '[data-testid="login-history"]',
      );

      // (5) AT 375px the 224px first column does not widen the PAGE. The table is
      // wider than the card by design and scrolls inside its own scroller, so the
      // assertion is about the document, not the table — and the row is still one
      // 40px line, which is the constant `windowRange` divides by (D-18).
      await page.setViewportSize({ width: 375, height: 812 });
      const atPhone = await page.evaluate(() => {
        const table = document.querySelector('[data-testid="login-table"]');
        const first = document.querySelector('[data-testid="login-row"] td.sticky-first');
        return {
          innerWidth: window.innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
          firstCellWidth: first instanceof HTMLElement ? first.clientWidth : -1,
          declaredCellWidth: first instanceof HTMLElement ? getComputedStyle(first).width : '',
          declaredCellPx:
            first instanceof HTMLElement ? parseFloat(getComputedStyle(first).width) : -1,
          rowHeight:
            (document.querySelector('[data-testid="login-row"]') as HTMLElement | null)
              ?.clientHeight ?? -1,
          tableWidth: table instanceof HTMLElement ? table.getBoundingClientRect().width : -1,
        };
      });
      expect(
        atPhone.scrollWidth,
        'the tagged Login table at 375px never widens the document',
      ).toBeLessThanOrEqual(atPhone.innerWidth);
      // The cell is the 224px the model declared, and the row is still 40px —
      // three chips beside a masked address must not make a windowed row taller
      // than the constant the virtualiser divides by.
      // The declared width is the 224px D-18 specifies. Read from the COMPUTED style
      // rather than `clientWidth`, because the table gives every cell 8px of
      // padding on each side and `clientWidth` includes it — so it reads 240 and
      // would be asserting a number no element produces.
      expect(atPhone.declaredCellWidth, 'the first column declares 224px').toBe('224px');
      expect(
        atPhone.firstCellWidth - atPhone.declaredCellPx,
        'the rendered cell is the declared width plus its own padding',
      ).toBe(16);
      expect(atPhone.rowHeight, 'a tagged row stays one 40px line').toBe(40);
      // The table still scrolls INSIDE its own scroller rather than the page.
      expect(
        atPhone.tableWidth,
        'the table is wider than the card, which is what the scroller is for',
      ).toBeGreaterThan(atPhone.innerWidth);
      await page.setViewportSize({ width: 1280, height: 720 });
    });

    // =============================================================================
    // 10-05 Task 1 — D-14/D-10: the Payments per-account split, in detail only
    //
    // EU and NA both carry `Orders.csv` in this fixture and both carry the SAME
    // sixteen hand rows, so "exactly double" is a figure this step can state
    // rather than approximate — and the single-account counts it doubles come
    // from the hand answer key, never from the page.
    // =============================================================================
    await test.step('a Payments card divides its combined total per account (D-14, D-10)', async () => {
      await openSection(page, 'payments');
      const block = page.getByTestId('spend-block');
      await expect(block).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });

      /** The hand answer key's card for one code, or a thrown failure — never a default. */
      function handCard(code: string): { paid: number; totalThousandths: number } {
        const card = ORDERS_HAND_EXPECTED.cards.find((entry) => entry.code === code);
        if (card === undefined) throw new Error(`the hand key has no ${code} card`);
        return { paid: card.paid, totalThousandths: card.totalThousandths };
      }

      // (1) THE CARD. USD is the hand key's top card by paid orders, so it is
      // also the first card drawn — but it is found BY ITS CODE rather than by
      // position, so card ordering is not what this step is about.
      const card = page.locator('[data-testid="spend-card"][data-currency="USD"]');
      await expect(card, 'the USD card exists').toHaveCount(1);
      const single = handCard('USD');
      await expect(card.getByTestId('spend-paid-count')).toHaveText(
        copy.formatPaidOrders(single.paid * 2),
      );

      // (2) THE DISCLOSURE, and it is CLOSED to begin with: D-14 puts the split
      // in detail only, so a reader who came for the combined figure never has
      // to open anything.
      const split = card.getByTestId('spend-per-account');
      await expect(split, 'one per-account disclosure per card').toHaveCount(1);
      await expect(split).not.toHaveAttribute('open', /.*/);
      await split.locator('summary').click();

      // (3) THE ROWS, in IDENTITY-HEADER ORDER: EU is B and NA is C, so the
      // disclosure reads B then C under a header that publishes A, B, C. The
      // aggregate stores these roots code-unit sorted — 1000000003 before
      // 500000001 — which is why this assertion is worth making (10-04's bug).
      const rows = split.locator('tbody tr');
      await expect(rows, 'exactly the two accounts that ordered').toHaveCount(2);
      const letters = await split
        .getByTestId('account-tag')
        .evaluateAll((tags) => tags.map((tag) => (tag.textContent ?? '').trim()));
      expect(letters, 'B then C, the published order').toEqual(['B', 'C']);

      const phrases = await split
        .locator('td:first-child .visually-hidden')
        .evaluateAll((spans) => spans.map((span) => (span.textContent ?? '').trim()));
      expect(phrases[0]).toContain(`Account B, ID ${MA_ROOT_EU}`);
      expect(phrases[1]).toContain(`Account C, ID ${MA_ROOT_NA}`);

      // Each row's Paid cell is the SINGLE-account count, because each account
      // placed exactly the single account's orders, and the two of them are the
      // doubled headline above. Read from the DOM, not recomputed by the test.
      const paidCells = await rows
        .locator('td:nth-child(2)')
        .evaluateAll((cells) => cells.map((cell) => (cell.textContent ?? '').trim()));
      expect(paidCells).toEqual([
        copy.formatPaidOrders(single.paid),
        copy.formatPaidOrders(single.paid),
      ]);

      // (4) THE AGGREGATED TABLES CARRY NO TAG (UI-SPEC Recorded Choice 5):
      // there is no per-payment row to attribute, so the split is the only
      // place an account tag appears on this pane. Two tags, both in the split.
      await expect(
        card.getByTestId('spend-breakdown').getByTestId('account-tag'),
        'the year and game tables carry no tag',
      ).toHaveCount(0);
      await expect(
        card.getByTestId('account-tag'),
        'the split holds exactly the two tags',
      ).toHaveCount(2);

      // (5) THE PRIVACY RULE, on the new pane: the phrase is text and no
      // attribute of the block holds a nickname or an account id.
      //
      // Every disclosure is opened FIRST, and that is a requirement of the
      // helper rather than tidiness: it compares the markup against
      // `innerText`, and a CLOSED `<details>` contributes its rows to the
      // markup but not to `innerText`. With four splits still shut the counts
      // cannot agree however correct the template is, so the assertion would be
      // reporting a hidden row as if it were an attribute leak.
      const allSplits = block.getByTestId('spend-per-account');
      const splitCount = await allSplits.count();
      expect(splitCount, 'a split on every card with a paid order').toBeGreaterThan(1);
      for (let index = 0; index < splitCount; index += 1) {
        const one = allSplits.nth(index);
        // Only the CLOSED ones: the USD card above is already open, and
        // clicking its summary again would close it and put the helper back
        // where it started.
        if ((await one.getAttribute('open')) !== null) continue;
        await one.locator('summary').click();
      }
      const openCount = await allSplits.evaluateAll(
        (nodes) => nodes.filter((node) => node.hasAttribute('open')).length,
      );
      expect(openCount, 'every split is open, so every phrase is rendered text').toBe(splitCount);
      await expectNicknameTextOnly(
        page,
        'Payments pane, per-account split',
        '[data-testid="spend-block"]',
      );
    });

    // =============================================================================
    // 10-05 Task 2 — D-14: the one line that says amounts are added per currency
    // =============================================================================
    await test.step('Finance and Payments say once that currencies are added, never converted (D-14)', async () => {
      for (const pane of ['finance', 'payments'] as const) {
        await openSection(page, pane);
        const note = page.getByTestId('finance-combined-note');
        await expect(note, `${pane}: exactly one note`).toHaveCount(1);
        await expect(note, `${pane}: the note text`).toHaveText(copy.FINANCE_COMBINED_NOTE);
        // The caption is the reworded one, and the note is not a live region.
        await expectCombinedCaption(page, pane);
        await expect(note).not.toHaveAttribute('role', /.*/);
        await expect(note).not.toHaveAttribute('aria-live', /.*/);
      }
    });

    await test.step('the tagged Vehicles pane never widens the page at 375px', async () => {
      // The measurable half of a backstop truth (Plan 10-03, must_have 10): a
      // phrase holding a 40-character nickname must not widen the DOCUMENT. The
      // visually-hidden span is clipped to 1px, so a leak here would show up as
      // `scrollWidth > innerWidth` rather than as a wide-looking chip.
      await page.setViewportSize({ width: 375, height: 812 });
      const viewport = await page.evaluate(() => ({
        innerWidth: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(
        viewport.scrollWidth,
        'the Vehicles pane at 375px never scrolls sideways',
      ).toBeLessThanOrEqual(viewport.innerWidth);
      // Restored, so every later step of this test lays out as it did before.
      await page.setViewportSize({ width: 1280, height: 720 });
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

      // D-01 / T-10-04: the filter is component state and nothing else, so the
      // reload that replays the cached dataset returns it to All games. This is
      // the browser half of "no route, no hash, no storage" — the shell guard
      // proves the absence, and this proves the consequence.
      await openSection(page, 'playtime');
      await expect(page.getByTestId('playtime')).toHaveAttribute('data-state', 'ready', {
        timeout: 30_000,
      });
      await expect(
        page.getByTestId('game-filter-chip-all').locator('input'),
        'a reload returns the filter to All games',
      ).toBeChecked();
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

      // 10-05: the finance note and the per-account split are multi-account
      // nodes too, so one account has neither (D-14, zero-one-many).
      for (const pane of ['finance', 'payments'] as const) {
        await openSection(page, pane);
        await expect(
          page.getByTestId('finance-combined-note'),
          `${pane}: no currency note for one account`,
        ).toHaveCount(0);
      }
      await expect(
        page.getByTestId('spend-per-account'),
        'no Payments card has a per-account disclosure for one account',
      ).toHaveCount(0);

      // And the Account row is the single-account wording again, which is the
      // stronger statement: it proves the multi branch is a branch and not a new
      // default.
      await openSection(page, 'overview');
      expect((await readAccountRow(page)).summary).toBe(copy.ACCOUNT_ROW_SUMMARY);
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

    // =============================================================================
    // 10-02 Task 2 — the empty game, and the About disclosure
    //
    // The two-account archive (EU + NA) has WOT, WoT Blitz and HEAT sessions
    // and NO Warships ones, so Warships is the game the worker can hold the
    // filter on and answer `no-game-sessions` for. Choosing it on Vehicles and
    // then opening Playtime is the whole round trip in one step: the filter
    // crosses panes, the empty-game body replaces the tiles, and the chips stay
    // so All games is one tap away.
    // =============================================================================
    await test.step('a game with no sessions shows the empty line and the chips recover', async () => {
      await openSection(page, 'vehicles');
      await playerStatsBlock(page).getByTestId('player-stats-title-selector').selectOption('wows');
      await expect(playerStatsBlock(page)).toHaveAttribute('data-state', 'ready', {
        timeout: 30_000,
      });

      await openSection(page, 'playtime');
      await expect(page.getByTestId('playtime')).toHaveAttribute('data-state', 'no-game-sessions', {
        timeout: 30_000,
      });

      // The five chips: All, the three games the two-account export has (WoT,
      // WoT Blitz, HEAT) and the carried-over Warships one — which is shown
      // precisely because it is the ACTIVE choice even though it has no sessions
      // (UI-SPEC amendment 6). WoT Console has no chip: its only session file is
      // in the RU root, which this replace removed (plan 11-11 corrected the
      // list 11-01 wrote, which named a chip this archive cannot have).
      for (const chip of ['all', 'wot', 'wotb', 'wows', 'heat']) {
        await expect(page.getByTestId(`game-filter-chip-${chip}`), `the ${chip} chip`).toHaveCount(
          1,
        );
      }
      await expect(
        page.getByTestId('game-filter-chip-wotc'),
        'no WoT Console chip: the two roots hold no WoT Console session',
      ).toHaveCount(0);
      await expect(
        page.getByTestId('game-filter-chip-wows').locator('input'),
        'the carried-over Warships chip is checked',
      ).toBeChecked();

      await expect(page.getByTestId('playtime-game-empty')).toHaveText(
        copy.formatNoGameSessions('WOWS'),
      );
      await expect(
        page.getByTestId('playtime-total-hours'),
        'no tiles while the game is empty',
      ).toHaveCount(0);
      await expect(page.getByTestId('calendar-heatmap'), 'and no charts').toHaveCount(0);

      // And back: the tiles return, which is the whole point of keeping the
      // chips enabled through the empty state.
      await page.getByTestId('game-filter-chip-all').click();
      await expect(page.getByTestId('playtime')).toHaveAttribute('data-state', 'ready');
      await expect(page.getByTestId('playtime-game-empty')).toHaveCount(0);
      await expect(page.getByTestId('playtime-total-hours')).toBeVisible();

      // D-06: two accounts means the merge explanation is warranted, and it is
      // present exactly once under the totals.
      await expect(page.getByTestId('about-playtime-totals')).toHaveCount(1);
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
      const row = await readAccountRow(page);
      expect(row.headline, 'the published account count, not the legacy region').toBe(
        copy.formatAccountCount(1),
      );
      expect(row.summary).toBe(copy.ACCOUNT_ROW_MULTI_SUMMARY);
      await expect(page.getByTestId('overview')).not.toContainText(MA_REGION_EU);

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
