import { expect, test } from '@playwright/test';
import { SAMPLE_NICKNAME, buildSampleExport } from '../../fixtures/export-fixtures.ts';
import { buildLoginsScaleExport, buildLoginsScaleSpec } from '../../fixtures/logins-fixtures.ts';
import { buildAccountTimelinePerksExport } from '../../fixtures/account-timeline-perks-export.ts';
import {
  buildNewGamesThreeAccountExport,
  buildRealShapeThreeAccountExport,
} from '../../fixtures/multi-account-fixtures.ts';
import {
  SYNTHETIC_ZIP_NAME,
  countryList,
  detailPane,
  importExport,
  loginHistoryBlock,
  loginMap,
  openSection,
  startOver,
  waitForImported,
} from '../_support/helpers.ts';
import { OPTIONAL_PANE_IDS, PANE_IDS } from '../../../src/lib/shell/selection-state.ts';
import { SCALE_5K_SPEC, buildSessionsExport } from '../../fixtures/sessions-fixtures.ts';

/**
 * PLATFORM-02 — zero network requests after initial page load, plus
 * the CSP meta tag is present in the served HTML.
 *
 * The "initial load" baseline includes the eager worker script fetch
 * (Pitfall 3 in RESEARCH: spawn at app init, not on first drop).
 *
 * Worker requests ARE visible here. Measured in plan 06-09: the context-level
 * `request` event recorded a module worker's own fetch (it returned 200 while a
 * `connect-src 'none'` meta CSP was in force), so counting requests through
 * `context.on('request')` covers the worker as well as the page. The earlier
 * belief that Playwright could not see a worker's requests was wrong, and this
 * file no longer relies on it.
 *
 * The converse is the reason the CSP is only defence in depth: a meta CSP does
 * NOT govern a worker, so `connect-src` could never have stopped one. The
 * enforcement is the ESLint network ban (src/lib/geo and src/lib/worker, one
 * exempt module) and the request counting below. Since plan 06-11 the policy is
 * `connect-src 'self'` for the one opt-in same-origin city download; every flow
 * in this file still asserts ZERO requests after the baseline, because none of
 * them opts in. The opt-in's own specs (which assert WHICH asset the one request
 * fetched) are plan 06-13's.
 */

test.describe('zero-network and CSP', () => {
  test('no network requests after initial load, including the worker script fetch', async ({
    page,
    context,
  }) => {
    const requests: string[] = [];
    const workerUrls: string[] = [];
    context.on('request', (req) => requests.push(req.url()));
    page.on('worker', (worker) => workerUrls.push(worker.url()));

    await page.goto('/');

    // Eager spawn: the worker must have reported ready before the baseline.
    await expect(page.locator('main')).toHaveAttribute('data-worker-ready', 'true', {
      timeout: 10_000,
    });

    await page.waitForLoadState('networkidle');

    const baselineCount = requests.length;
    expect(baselineCount).toBeGreaterThan(0);

    // The page-initiated worker fetch should be inside the baseline.
    expect(workerUrls).toHaveLength(1);
    const pageOrigin = new URL(page.url()).origin;
    for (const url of workerUrls) {
      expect(new URL(url).origin).toBe(pageOrigin);
    }
    for (const url of requests) {
      expect(new URL(url).origin).toBe(pageOrigin);
    }

    await page.getByTestId('file-input').setInputFiles({
      name: 'sample-export.zip',
      mimeType: 'application/zip',
      buffer: Buffer.from(buildSampleExport()),
    });

    // 03-04: the account heading is retired (D-23); the identity header's
    // nickname `<h2>` is the dashboard's title now. Asserted on a test id
    // rather than on a role+level heading, because the dashboard renders six
    // `<h2>` elements and a role query would be ambiguous.
    await expect(page.getByTestId('identity-nickname')).toHaveText(SAMPLE_NICKNAME);

    // Give any microtask-queued work a chance to settle before we assert
    // the count.
    await page.waitForTimeout(500);

    const postSubmitCount = requests.length;
    expect(
      postSubmitCount,
      `unexpected requests after submit: ${requests.slice(baselineCount).join(', ')}`,
    ).toBe(baselineCount);
  });

  test("served HTML carries the CSP meta tag with connect-src exactly 'self' and every other directive unchanged", async ({
    page,
  }) => {
    await page.goto('/');
    const csp = await page
      .locator('meta[http-equiv="Content-Security-Policy"]')
      .first()
      .getAttribute('content');
    expect(csp).not.toBeNull();

    const directives = new Map(
      csp!
        .split(';')
        .map((part) => part.trim())
        .filter((part) => part !== '')
        .map((part) => {
          const [name, ...value] = part.split(/\s+/);
          return [name!, value.join(' ')] as const;
        }),
    );

    // The one directive that changed on purpose (plan 06-11, D-16): the single
    // sanctioned opt-in city download is a same-origin GET.
    expect(directives.get('connect-src')).toBe("'self'");

    // Everything else is exactly what it was.
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'none'");
    expect(csp).toContain("form-action 'none'");
    expect(directives.get('default-src')).toBe("'self'");
    expect(directives.get('object-src')).toBe("'none'");
    expect(directives.get('base-uri')).toBe("'none'");
    expect(directives.get('form-action')).toBe("'none'");
    expect([...directives.keys()].sort()).toEqual(
      ['base-uri', 'connect-src', 'default-src', 'form-action', 'object-src'].sort(),
    );
  });

  test('no network requests, no second worker and no CSP violation through a 5,000-session import, every selector value and chart interaction', async ({
    page,
    context,
  }) => {
    // Explicit rather than inherited: this test imports a 5,000-session
    // archive, sweeps every selector value and then interacts with two
    // charts, which is more than the configured default allows for on a slow
    // CI runner. A timeout here would look like a network failure.
    test.setTimeout(180_000);

    // Before navigation, so it catches a violation raised by the first
    // application script as well as by anything the playtime flow does.
    await page.addInitScript(() => {
      const w = window as unknown as { __cspViolations: string[] };
      w.__cspViolations = [];
      document.addEventListener(
        'securitypolicyviolation',
        (event) => {
          w.__cspViolations.push((event as SecurityPolicyViolationEvent).violatedDirective);
        },
        true,
      );
    });

    const requests: string[] = [];
    const workerUrls: string[] = [];
    context.on('request', (req) => requests.push(req.url()));
    page.on('worker', (worker) => workerUrls.push(worker.url()));

    await page.goto('/');
    await expect(page.locator('main')).toHaveAttribute('data-worker-ready', 'true', {
      timeout: 10_000,
    });
    await page.waitForLoadState('networkidle');

    // The eager worker script fetch and the module graph are inside the
    // baseline, so anything after it is the app asking for something it was
    // not served.
    const baselineCount = requests.length;
    expect(baselineCount).toBeGreaterThan(0);
    expect(workerUrls).toHaveLength(1);

    const { bytes } = buildSessionsExport(SCALE_5K_SPEC);
    await page.getByTestId('file-input').setInputFiles({
      name: 'scale-export.zip',
      mimeType: 'application/zip',
      buffer: Buffer.from(bytes),
    });
    // An import lands on Overview, where the playtime block is not mounted
    // (D-01), so the pane that owns it is opened before its state is awaited.
    await waitForImported(page);
    await openSection(page, 'playtime');
    await expect(page.getByTestId('playtime')).toHaveAttribute('data-state', 'ready', {
      timeout: 30_000,
    });

    // Every split value, waiting for the charts to settle on each. The wait is
    // on the block's own state attribute, so a value that never answered would
    // fail here rather than be measured against the previous slice.
    const selector = page.getByTestId('playtime-selector');
    const optionCount = await selector.locator('option').count();
    expect(optionCount, 'All plus at least one server name').toBeGreaterThan(1);
    for (let index = 0; index < optionCount; index += 1) {
      await selector.selectOption({ index });
      await expect(page.getByTestId('playtime')).toHaveAttribute('data-state', 'ready', {
        timeout: 10_000,
      });
    }

    // Two different interaction paths over the charts: a pointer (which opens
    // the shared tooltip) and the keyboard (which moves the roving tab stop
    // through the calendar).
    await page.getByTestId('hour-cell').first().hover();
    await page.getByTestId('calendar-cell').first().focus();
    await page.keyboard.press('ArrowRight');

    // The same short settle the first test uses, so a request queued by the
    // interaction has reached the network stack before the count is read.
    await page.waitForTimeout(500);

    const postBaseline = requests.slice(baselineCount);
    expect(postBaseline, `requests after the playtime flow: ${postBaseline.join(', ')}`).toEqual(
      [],
    );

    // Still the single long-lived worker, on the same origin as the page.
    expect(workerUrls, 'no second worker for the playtime flow').toHaveLength(1);
    const pageOrigin = new URL(page.url()).origin;
    for (const url of [...requests, ...workerUrls]) {
      expect(new URL(url).origin).toBe(pageOrigin);
    }

    // The half that counting requests cannot see: nothing was even ATTEMPTED.
    const violations = await page.evaluate(
      () => (window as unknown as { __cspViolations: string[] }).__cspViolations,
    );
    expect(violations, `violated CSP directives: ${violations.join(', ')}`).toEqual([]);
  });

  test('no network request, no second worker and no CSP violation through every Phase 5 flow and the Phase 9 multi-account import', async ({
    page,
    context,
  }) => {
    // Explicit rather than inherited: this test sweeps two selectors value by
    // value, sorts, searches, toggles a column, interacts with two charts by
    // pointer AND by keyboard, opens three disclosures, replaces the whole
    // dataset, replaces it AGAIN with a three-account export and walks every
    // pane on that one (09-06), then replaces it a third time with the archive
    // that holds the Phase 11 pane files and opens HEAT, Warships crews and
    // storage and the Warplanes block on it (11-11). A timeout here would look
    // like a network failure.
    test.setTimeout(300_000);

    // The same observer as the playtime test, installed before navigation so a
    // violation raised by the first application script is caught too, not only
    // one raised by a Phase 5 interaction.
    await page.addInitScript(() => {
      const w = window as unknown as { __cspViolations: string[] };
      w.__cspViolations = [];
      document.addEventListener(
        'securitypolicyviolation',
        (event) => {
          w.__cspViolations.push((event as SecurityPolicyViolationEvent).violatedDirective);
        },
        true,
      );
    });

    const requests: string[] = [];
    const workerUrls: string[] = [];
    context.on('request', (req) => requests.push(req.url()));
    page.on('worker', (worker) => workerUrls.push(worker.url()));

    await page.goto('/');
    await expect(page.locator('main')).toHaveAttribute('data-worker-ready', 'true', {
      timeout: 10_000,
    });
    await page.waitForLoadState('networkidle');

    // Identical baseline to the playtime test: the eager worker fetch and the
    // module graph are inside it, so anything after it is the app asking for
    // something it was not served.
    const baselineCount = requests.length;
    expect(baselineCount).toBeGreaterThan(0);
    expect(workerUrls).toHaveLength(1);

    // ONE import of the sample export, which carries all four Phase 5 sections:
    // Vehicles, Orders, Virtual_currencies and Premium_account.
    const sample = buildSampleExport();
    await page.getByTestId('file-input').setInputFiles({
      name: 'sample-export.zip',
      mimeType: 'application/zip',
      buffer: Buffer.from(sample),
    });

    // The four Phase 5 blocks live in three different panes and only the open
    // pane is mounted (D-01), so each pane is opened in the order the flow uses
    // it and its blocks are `ready` before the first interaction there. A
    // remount re-asks the worker, so the wait is on the block's own state.
    const playerStats = page.getByTestId('player-stats');
    const premium = page.getByTestId('premium-block');
    const currency = page.getByTestId('currency-block');
    const spend = page.getByTestId('spend-block');
    await waitForImported(page);

    // --- 0. the Overview (13-14) ----------------------------------------------
    // The page lands on the Overview after the import. Every interaction below
    // is a state change - expand, close, pin, unpin, follow an Open link - and
    // the pin writes local storage, never a request. The end-of-test assertions
    // (no request after the baseline, one worker, no CSP violation) therefore
    // cover the Overview too.
    const overview = page.getByTestId('overview');
    await expect(overview).toBeVisible();
    const firstFace = page.locator('[data-testid^="ov-tile-button-"]').first();
    await expect(firstFace).toBeVisible({ timeout: 30_000 });
    await expect(overview).toHaveAttribute('aria-busy', 'false');
    const firstId = (await firstFace.getAttribute('data-tile-id')) ?? '';
    expect(firstId, 'the Overview drew at least one tile').not.toBe('');
    // Expand, then Escape closes it.
    await firstFace.click();
    await expect(firstFace).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Escape');
    await expect(firstFace).toHaveAttribute('aria-expanded', 'false');
    // The star unpins, the P key pins again.
    const firstStar = page.getByTestId('ov-star-' + firstId);
    const pinnedAtStart = (await firstStar.getAttribute('aria-pressed')) ?? 'false';
    await firstStar.click();
    await expect(page.getByTestId('ov-star-' + firstId)).not.toHaveAttribute(
      'aria-pressed',
      pinnedAtStart,
    );
    await page.getByTestId('ov-tile-button-' + firstId).focus();
    await page.keyboard.press('p');
    await expect(page.getByTestId('ov-star-' + firstId)).toHaveAttribute(
      'aria-pressed',
      pinnedAtStart,
    );
    await page.keyboard.press('Escape');
    // The Open link selects an existing pane; come back and wait for a tile.
    await page.getByTestId('ov-tile-button-' + firstId).click();
    await page.getByTestId('ov-tile-open-' + firstId).click();
    await expect(detailPane(page)).not.toHaveAttribute('data-pane', 'overview');
    await openSection(page, 'overview');
    await expect(page.locator('[data-testid^="ov-tile-button-"]').first()).toBeVisible();

    await openSection(page, 'vehicles');
    await expect(playerStats).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });

    // --- 1. the battle-type selector, every value -----------------------------
    // Swept before the title, because the two are linked: the battle types are
    // the current title's, so a title change would invalidate the list.
    const battleTypes = page.getByTestId('player-stats-battle-type-selector');
    const battleTypeCount = await battleTypes.locator('option').count();
    expect(battleTypeCount, 'All plus at least one real battle type').toBeGreaterThan(1);
    for (let index = 0; index < battleTypeCount; index += 1) {
      await battleTypes.selectOption({ index });
      await expect(playerStats).toHaveAttribute('data-state', 'ready', { timeout: 10_000 });
    }
    await battleTypes.selectOption({ index: 0 });

    // --- 2. the title selector, every value -----------------------------------
    const titles = page.getByTestId('player-stats-title-selector');
    const titleCount = await titles.locator('option').count();
    expect(titleCount, 'All plus at least one title').toBeGreaterThan(1);
    for (let index = 0; index < titleCount; index += 1) {
      await titles.selectOption({ index });
      await expect(playerStats).toHaveAttribute('data-state', 'ready', { timeout: 10_000 });
    }
    // Back to the first title, so the flows below run on the same table the
    // sample export's own assertions describe.
    await titles.selectOption({ index: 0 });
    await expect(playerStats).toHaveAttribute('data-state', 'ready', { timeout: 10_000 });

    // --- 3. a sort, both directions ------------------------------------------
    // A second click on the SAME header flips it, so this is two round trips
    // through the re-sort path rather than one.
    const battlesHeader = page.getByTestId('vehicle-sort-battles');
    await battlesHeader.click();
    await expect(page.locator('th:has([data-testid="vehicle-sort-battles"])')).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
    await battlesHeader.click();
    await expect(page.locator('th:has([data-testid="vehicle-sort-battles"])')).toHaveAttribute(
      'aria-sort',
      'descending',
    );

    // --- 4. the search box ---------------------------------------------------
    const search = page.getByTestId('vehicle-search');
    await search.fill('Tiger');
    await expect(playerStats).toHaveAttribute('data-state', 'ready', { timeout: 10_000 });
    await search.fill('zzzz-no-such-vehicle');
    await expect(playerStats).toHaveAttribute('data-state', 'ready', { timeout: 10_000 });
    // A search that matches nothing must not be a dead end: clearing it brings
    // the whole table back, which is the reset path this flow owns.
    await search.fill('');
    await expect(playerStats).toHaveAttribute('data-state', 'ready', { timeout: 10_000 });

    // --- 5. the column picker, one toggle on and off -------------------------
    // The extra columns offered are the current title's own, so the toggle is
    // read from the DOM rather than named: a hardcoded key would couple this
    // network guard to one title's column set.
    const picker = page.getByTestId('column-picker');
    await picker.locator('summary').click();
    const toggles = picker.locator('input[type="checkbox"]');
    // Counted, not `.first()`-asserted: `expect(locator.first()).toHaveCount(1)`
    // is true for any locator that resolves at all, so it would pass on an
    // empty picker and prove the flow never ran.
    expect(
      await toggles.count(),
      'the picker must offer at least one extra column',
    ).toBeGreaterThan(0);
    const firstToggle = toggles.first();
    const wasChecked = await firstToggle.isChecked();
    await firstToggle.setChecked(!wasChecked);
    await expect(firstToggle).toBeChecked({ checked: !wasChecked });
    await expect(playerStats).toHaveAttribute('data-state', 'ready', { timeout: 10_000 });
    await firstToggle.setChecked(wasChecked);
    await expect(playerStats).toHaveAttribute('data-state', 'ready', { timeout: 10_000 });

    // The Financial pane owns the Premium time and Virtual currency blocks.
    await openSection(page, 'finance');
    for (const block of [premium, currency]) {
      await expect(block).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });
    }

    // --- 6. the premium chart, by pointer and by keyboard --------------------
    const premiumCell = premium.getByTestId('premium-cell').first();
    await premiumCell.hover();
    await expect(premium.getByTestId('bar-hover-ring')).toHaveCount(1);
    await premiumCell.focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');

    // --- 7. the currency chart, by pointer and by keyboard --------------------
    const currencyCell = currency.getByTestId('currency-cell').first();
    await currencyCell.hover();
    await expect(currency.getByTestId('bar-hover-ring')).toHaveCount(1);
    await currencyCell.focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowLeft');

    // --- 8. every monthly table, opened ---------------------------------------
    // The test id is shared by both sub-blocks, and the currency card has one
    // per CHARTED currency, so every disclosure in each block is opened rather
    // than the first. That is also the stronger claim: this is a network and CSP
    // guard, and a control nobody opened is a control nobody proved.
    for (const block of [premium, currency]) {
      const disclosures = block.getByTestId('monthly-table-disclosure');
      const disclosureCount = await disclosures.count();
      expect(disclosureCount, 'the block must render at least one monthly table').toBeGreaterThan(
        0,
      );
      for (let index = 0; index < disclosureCount; index += 1) {
        await disclosures.nth(index).locator('summary').click();
        await expect(disclosures.nth(index)).toHaveAttribute('open', /.*/);
      }
    }

    // The Payments pane owns the Real-money spend block.
    await openSection(page, 'payments');
    await expect(spend).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });

    // --- 9. a spend card's breakdown, opened ---------------------------------
    const breakdown = spend.getByTestId('spend-breakdown').first();
    await expect(breakdown).toHaveCount(1);
    await breakdown.locator('summary').click();
    await expect(breakdown.locator('table').first()).toBeVisible();

    // --- 10. the replace flow, confirmed -------------------------------------
    // Phase 3's replace-on-drop rule: a second drop opens the confirm panel
    // before anything is processed, and committing it re-runs the whole
    // ingest — the single most expensive Phase 5 path there is.
    await page.getByTestId('file-input').setInputFiles({
      name: 'sample-export-again.zip',
      mimeType: 'application/zip',
      buffer: Buffer.from(buildSampleExport()),
    });
    const panel = page.getByTestId('confirm-panel');
    await expect(panel).toBeVisible();
    await panel.getByTestId('confirm-commit').click();
    await expect(panel).toHaveCount(0);
    // A replace lands on Overview (R1), so every pane is opened again and its
    // blocks awaited: the re-ingest must have answered all four.
    await waitForImported(page);
    await openSection(page, 'vehicles');
    await expect(playerStats).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });
    await openSection(page, 'finance');
    for (const block of [premium, currency]) {
      await expect(block).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });
    }
    await openSection(page, 'payments');
    await expect(spend).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });

    // --- 11. the Phase 9 three-account replace, then every pane ---------------
    // The multi-account import is the phase's biggest new code path: it resolves
    // N account roots, tags every row with its owner and merges the categories
    // across them. It runs entirely inside the worker and IndexedDB, so it must
    // be no more network-hungry than the single-account import — and saying so
    // is only worth anything if the panes are OPENED on that dataset, because a
    // pane nobody opened is a pane nobody proved. Reload is deliberately NOT in
    // this stage: a reload starts a new document and a new worker, which the
    // single-worker assertion below would read as a second one.
    await page.getByTestId('file-input').setInputFiles({
      name: 'three-account-export.zip',
      mimeType: 'application/zip',
      buffer: Buffer.from(buildRealShapeThreeAccountExport()),
    });
    await expect(panel).toBeVisible();
    await panel.getByTestId('confirm-commit').click();
    await expect(panel).toHaveCount(0);
    await waitForImported(page);
    await expect(page.getByTestId('identity-multi-title')).toBeVisible({ timeout: 30_000 });

    for (const pane of PANE_IDS) {
      await openSection(page, pane);
    }

    // --- 12. the Phase 11 new-game panes --------------------------------------
    // The HEAT pane, the Warships crews and storage pane and the Warplanes
    // account block are built from files no earlier flow imports, and each reads
    // its own worker channel. So the three-account archive that holds them
    // replaces the one above, every optional pane is opened on it, the shared
    // address reveal is pressed once (a state change, never a request) and
    // Vehicles is opened on the Warplanes title. The baseline arithmetic and the
    // three assertions below are untouched: they now cover this stage as well.
    await page.getByTestId('file-input').setInputFiles({
      name: 'new-games-export.zip',
      mimeType: 'application/zip',
      buffer: Buffer.from(buildNewGamesThreeAccountExport()),
    });
    await expect(panel).toBeVisible();
    await panel.getByTestId('confirm-commit').click();
    await expect(panel).toHaveCount(0);
    await waitForImported(page);
    await expect(page.getByTestId('identity-multi-title')).toBeVisible({ timeout: 30_000 });

    // An explicit list of the two panes THIS archive holds. The optional-pane
    // tuple also names Perks and Account timeline, which this archive has no file
    // for (so no row to open); stage 13 below opens those two on their own archive.
    const STAGE_12_PANES = ['heat', 'warships-storage'] as const;
    const STAGE_13_PANES = ['perks', 'account-timeline'] as const;
    // Stage 12 and stage 13 together must name every optional pane, so a pane added
    // to the tuple later fails here instead of silently going unopened.
    expect([...STAGE_12_PANES, ...STAGE_13_PANES].sort()).toEqual([...OPTIONAL_PANE_IDS].sort());
    for (const pane of STAGE_12_PANES) {
      await openSection(page, pane);
      await expect(page.getByTestId(`${pane}-block`)).toHaveAttribute('data-state', 'ready', {
        timeout: 30_000,
      });
    }
    await openSection(page, 'heat');
    await page.getByTestId('heat-mask-toggle').click();
    await openSection(page, 'vehicles');
    await expect(playerStats).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });
    await page.getByTestId('player-stats-title-selector').selectOption('wowp');
    await expect(page.getByTestId('wowp-account-stats')).toHaveCount(1, { timeout: 30_000 });

    // --- 13. the Phase 12 panes -----------------------------------------------
    // The Account timeline and Perks panes read two worker channels no earlier
    // flow asks, from files no earlier archive holds, and they own the second
    // and third uses of the shared address reveal. So the archive that holds them
    // replaces the one above, both panes are opened and awaited, the Perks mask
    // toggle is pressed (a state change, never a request) and one kind chip is
    // chosen (a local filter over an in-memory model). The baseline arithmetic
    // and the three assertions below are untouched: they now cover this stage too.
    await page.getByTestId('file-input').setInputFiles({
      name: 'account-timeline-perks-export.zip',
      mimeType: 'application/zip',
      buffer: Buffer.from(buildAccountTimelinePerksExport()),
    });
    await expect(panel).toBeVisible();
    await panel.getByTestId('confirm-commit').click();
    await expect(panel).toHaveCount(0);
    await waitForImported(page);
    await expect(page.getByTestId('identity-multi-title')).toBeVisible({ timeout: 30_000 });

    for (const pane of STAGE_13_PANES) {
      await openSection(page, pane);
      await expect(page.getByTestId(`${pane}-block`)).toHaveAttribute('data-state', 'ready', {
        timeout: 30_000,
      });
    }
    await openSection(page, 'perks');
    await page.getByTestId('perks-mask-toggle').click();
    await expect(page.getByTestId('perks-mask-toggle')).toHaveAttribute('data-masked', 'false');
    await openSection(page, 'account-timeline');
    await page.getByTestId('timeline-kind-filter').locator('label.chip').nth(1).click();
    await expect(page.getByTestId('timeline-kind-filter').locator('input:checked')).toHaveCount(1);

    // The same short settle the other two tests use, so a request queued by the
    // last interaction has reached the network stack before the count is read.
    await page.waitForTimeout(500);

    const postBaseline = requests.slice(baselineCount);
    expect(postBaseline, `requests after the Phase 5 flows: ${postBaseline.join(', ')}`).toEqual(
      [],
    );

    // Still the single long-lived worker across every flow, on the page's origin.
    expect(workerUrls, 'no second worker for the Phase 5 flows').toHaveLength(1);
    const pageOrigin = new URL(page.url()).origin;
    for (const url of [...requests, ...workerUrls]) {
      expect(new URL(url).origin).toBe(pageOrigin);
    }

    // The half that counting requests cannot see: nothing was even ATTEMPTED,
    // by any of the thirteen flows above.
    const violations = await page.evaluate(
      () => (window as unknown as { __cspViolations: string[] }).__cspViolations,
    );
    expect(
      violations,
      `violated CSP directives across the Phase 5 flows: ${violations.join(', ')}`,
    ).toEqual([]);
  });

  test('no network request, no second worker and no CSP violation through every Phase 6 flow at 10,000 rows, with the city opt-in never pressed', async ({
    page,
    context,
  }) => {
    // Explicit rather than inherited: this test imports a 12,000-row archive,
    // reveals and hides the addresses, sorts every column, interacts with the
    // map by pointer and by keyboard, opens the country list, and then clears
    // and imports again. A timeout here would look like a network failure.
    test.setTimeout(240_000);

    // The same observer as the other long flows, installed before navigation so
    // a violation raised by the first application script is caught too.
    await page.addInitScript(() => {
      const w = window as unknown as { __cspViolations: string[] };
      w.__cspViolations = [];
      document.addEventListener(
        'securitypolicyviolation',
        (event) => {
          w.__cspViolations.push((event as SecurityPolicyViolationEvent).violatedDirective);
        },
        true,
      );
    });

    const requests: string[] = [];
    const workerUrls: string[] = [];
    context.on('request', (req) => requests.push(req.url()));
    page.on('worker', (worker) => workerUrls.push(worker.url()));

    await page.goto('/');
    await expect(page.locator('main')).toHaveAttribute('data-worker-ready', 'true', {
      timeout: 10_000,
    });
    await page.waitForLoadState('networkidle');

    const baselineCount = requests.length;
    expect(baselineCount).toBeGreaterThan(0);
    expect(workerUrls).toHaveLength(1);

    const bytes = buildLoginsScaleExport(buildLoginsScaleSpec());
    await importExport(page, SYNTHETIC_ZIP_NAME, bytes);
    // The login block, the map, the country list and the city opt-in all live
    // in the Login history pane, which an import does not open (R1).
    await openSection(page, 'login-history');
    const block = loginHistoryBlock(page);
    await expect(block).toHaveAttribute('data-state', 'ready', { timeout: 60_000 });

    // The opt-in is on the page, offering a download it must NOT start: the
    // request it makes is the subject of plan 06-13's specs, not of this guard.
    await expect(page.getByTestId('city-optin')).toHaveAttribute('data-state', 'idle');

    // --- 1. reveal and hide ---------------------------------------------------
    const toggle = page.getByTestId('login-mask-toggle');
    await toggle.click();
    await toggle.click();

    // --- 2. every sort button, twice so both directions are asked for ---------
    for (const key of ['ip', 'country', 'logins', 'first', 'last', 'games']) {
      const sort = page.getByTestId(`login-sort-${key}`);
      await sort.click();
      await sort.click();
    }

    // --- 3. the map, by pointer and by keyboard -------------------------------
    const map = loginMap(page);
    const countries = map.getByTestId('login-country');
    const countryCount = await countries.count();
    expect(countryCount, 'the fixture shades several countries').toBeGreaterThan(5);
    for (const index of [0, 1, 2, countryCount - 1]) {
      await countries.nth(index).hover({ force: true });
    }
    await countries.first().focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowLeft');
    await page.mouse.move(5, 5);

    // --- 4. the country list, opened and closed --------------------------------
    const list = countryList(page);
    await list.locator('summary').click();
    await expect(list).toHaveAttribute('open', '');
    await list.locator('summary').click();
    await expect(list).not.toHaveAttribute('open', '');

    // --- 5. clear, then import again -------------------------------------------
    await startOver(page);
    await importExport(page, SYNTHETIC_ZIP_NAME, bytes);
    await openSection(page, 'login-history');
    await expect(block).toHaveAttribute('data-state', 'ready', { timeout: 60_000 });

    // The opt-in is still offered and was never pressed: it rests in `idle`
    // (the fixture build carries a city asset), not `downloading` or `ready`.
    await expect(page.getByTestId('city-optin')).toHaveAttribute('data-state', 'idle');
    await expect(page.getByTestId('city-progress')).toHaveCount(0);

    // The same short settle the other long flows use.
    await page.waitForTimeout(500);

    const postBaseline = requests.slice(baselineCount);
    expect(postBaseline, `requests after the Phase 6 flows: ${postBaseline.join(', ')}`).toEqual(
      [],
    );

    // Still the single long-lived worker across every flow, on the page's origin.
    expect(workerUrls, 'no second worker for the Phase 6 flows').toHaveLength(1);
    const pageOrigin = new URL(page.url()).origin;
    for (const url of [...requests, ...workerUrls]) {
      expect(new URL(url).origin).toBe(pageOrigin);
    }

    const violations = await page.evaluate(
      () => (window as unknown as { __cspViolations: string[] }).__cspViolations,
    );
    expect(
      violations,
      `violated CSP directives across the Phase 6 flows: ${violations.join(', ')}`,
    ).toEqual([]);
  });
});
