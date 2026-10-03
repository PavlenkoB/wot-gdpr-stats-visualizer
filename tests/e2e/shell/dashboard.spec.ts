import '../_support/pin-locale';
import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  EXTRA_UNKNOWN_FOLDER,
  LONG_NICKNAME,
  LONG_UNKNOWN_FOLDER,
  MULTIROW_DECOY_NICKNAME,
  MULTIROW_DECOY_REGION,
  MULTIROW_MATCH_NICKNAME,
  MULTIROW_MATCH_REGION,
  PARTIAL_ROW_REGION,
  RENAMED_ACCOUNT_ROOT,
  SAMPLE_ACCOUNT_ROOT,
  SAMPLE_CREATED_DATE,
  SAMPLE_FILE_COUNTS,
  SAMPLE_NICKNAME,
  SAMPLE_ROW_COUNTS,
  buildCaseVariantFoldersExport,
  buildEmptyAccountInfoExport,
  buildLongTextExport,
  buildMalformedRowsExport,
  buildMissingPaymentHistoryExport,
  buildMissingUserInfoExport,
  buildMultiRowAccountInfoExport,
  buildOnlySupportedExport,
  buildPartialAccountInfoExport,
  buildRenamedRootExport,
  buildRootlessExport,
  buildSampleExport,
  buildTruncatedExport,
  buildZeroRowPaymentExport,
} from '../../fixtures/export-fixtures.ts';
import {
  CLEARED_ACK_MESSAGE,
  COMPACT_DROPZONE_PROMPT,
  CONFIRM_CLEAR_MESSAGE,
  CONFIRM_REPLACE_MESSAGE,
  DELETE_CACHED_DATA_LABEL,
  DROPZONE_ARIA_LABEL,
  DROPZONE_PROMPT,
  DUPLICATE_BANNER_MESSAGE,
  GENERIC_FAILURE_MESSAGE,
  IDENTITY_CAPTION,
  IDENTITY_CREATED_LABEL,
  IDENTITY_REGION_LABEL,
  IDENTITY_SKELETON_PROMPT,
  IDENTITY_SKELETON_TITLE,
  KEEP_CACHED_DATA_LABEL,
  KEEP_CURRENT_DATA_LABEL,
  REPLACE_DATASET_LABEL,
  SECTION_NOTE_PENDING,
  SECTION_NOTE_USER_INFO,
  STAGE_TEXT,
  UNKNOWN_VALUE,
  UNSUPPORTED_BANNER_SUFFIX,
  UNSUPPORTED_INTRO,
  UNSUPPORTED_NONE_DETECTED,
  formatAccountId,
  formatImportSummary,
  formatParsingProgress,
  formatSectionStatus,
  formatSkippedRowCount,
} from '../../../src/lib/ui-copy.ts';
import { dropFiles, importLine, importLines } from '../_support/helpers.ts';

// =============================================================================
// 03-04 — dashboard shell: identity header, section cards, retired markup
// =============================================================================
//
// Every expected string below is computed from the SAME fixtures and the
// SAME formatters the app uses, so a fixture or copy change fails the test
// that states the change rather than a hand-copied literal that silently
// goes stale (the lockstep pattern from import-flow.spec.ts).
//
// The section ids are asserted as literals, not derived from SECTIONS: the
// ids are the anchor contract Phase 03-05's scroll-spy and the nav depend
// on, so a change to them must break a test here rather than be absorbed.
// =============================================================================

/** The five supported section ids in D-02 order, block excluded (Task 3). */
const SUPPORTED_IDS = [
  'activity-history',
  'player-statistics',
  'financial-data',
  'payment-history',
  'user-info',
] as const;

/**
 * The heading text each section must show: the folder name exactly as the
 * export spells it (D-02). Kept as a literal here, not imported from
 * `SECTION_TITLES`, because the rendered heading is the contract — if the
 * copy changed, this file should fail rather than follow the change.
 */
const SECTIONS_BY_ID: Record<(typeof SUPPORTED_IDS)[number], string> = {
  'activity-history': 'Activity_history',
  'player-statistics': 'Player_statistics',
  'financial-data': 'Financial_data',
  'payment-history': 'Payment_history',
  'user-info': 'User_Info',
};

/** The import summary text a section's counts must render (D-09). */
function expectedSummary(folder: string): string {
  return formatImportSummary(SAMPLE_FILE_COUNTS[folder]!, SAMPLE_ROW_COUNTS[folder]!);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('main')).toHaveAttribute('data-worker-ready', 'true', {
    timeout: 10_000,
  });
});

/** Import in-memory zip bytes through the dropzone's real file input. */
async function importZip(page: Page, bytes: Uint8Array, name: string): Promise<void> {
  await page.getByTestId('file-input').setInputFiles({
    name,
    mimeType: 'application/zip',
    buffer: Buffer.from(bytes),
  });
}

/** The section card for one id. */
function section(page: Page, id: string) {
  return page.getByTestId(`dashboard-section-${id}`);
}

/**
 * The ids of every section card on the page, in DOCUMENT order.
 *
 * Read from the DOM rather than asserted per element, because the contract
 * is the order, not merely the presence: a nav that links `#user-info`
 * first while the card renders last is broken in a way no per-element
 * assertion would notice.
 */
async function sectionIdsInOrder(page: Page): Promise<string[]> {
  return page
    .locator('[data-testid^="dashboard-section-"]')
    .evaluateAll((nodes) =>
      nodes.map((node) =>
        (node.getAttribute('data-testid') ?? '').replace('dashboard-section-', ''),
      ),
    );
}

test.describe('dashboard shell (03-04 Task 2)', () => {
  test('(identity-loaded) a sample import shows the full identity card', async ({ page }) => {
    await importZip(page, buildSampleExport(), 'sample.zip');

    const header = page.getByTestId('identity-header');
    await expect(header).toHaveAttribute('data-variant', 'loaded', { timeout: 30_000 });

    // Title, then the caption that qualifies the values as the export's.
    await expect(page.getByTestId('identity-nickname')).toHaveText(SAMPLE_NICKNAME);
    await expect(header).toContainText(IDENTITY_CAPTION);

    // D-13: the raw region under a label that says where it comes from.
    await expect(header).toContainText(IDENTITY_REGION_LABEL);
    await expect(page.getByTestId('identity-region')).toHaveText('CA');

    // D-15: date only. The `identity-created` text is asserted with an
    // exact match, so any appended time or timezone fails here.
    await expect(header).toContainText(IDENTITY_CREATED_LABEL);
    await expect(page.getByTestId('identity-created')).toHaveText('2020-01-01');

    // D-14: the account ID as a separate secondary line.
    await expect(page.getByTestId('identity-account-id')).toHaveText(
      formatAccountId(SAMPLE_ACCOUNT_ROOT),
    );
  });

  test('(sections-pending) four sections ready and only User_Info pending, all five in D-02 order with counts', async ({
    page,
  }) => {
    await importZip(page, buildSampleExport(), 'sample.zip');
    await expect(page.getByTestId('identity-nickname')).toBeVisible({ timeout: 30_000 });

    // The document order of all six cards — with the unsupported block
    // last — is asserted once, by the `(order)` test in the block describe
    // below. This test is about what each card SAYS.

    for (const id of SUPPORTED_IDS) {
      const card = section(page, id);
      // Four sections have a dashboard and read `ready` — Activity_history
      // since 04-02, Player_statistics since 05-12, Financial_data since
      // 05-10 and Payment_history since 05-15 — and User_Info is the one that
      // still says it will never have one. Named rather than counted, so a
      // phase that adds its own id to BUILT_DASHBOARDS has to come back and
      // own this line.
      await expect(card).toHaveAttribute(
        'data-status',
        id === 'activity-history' ||
          id === 'player-statistics' ||
          id === 'financial-data' ||
          id === 'payment-history'
          ? 'ready'
          : 'pending',
      );
      // The heading carries the folder name exactly as written in the zip.
      await expect(card.locator('h2')).toHaveText(SECTIONS_BY_ID[id]);

      // D-09: the import counts are the pending card's body and the ready
      // card's caption, and the skip tag is absent either way because
      // nothing was skipped in this fixture. `importLine` reads whichever
      // one this card renders.
      await expect(importLine(card)).toHaveText(expectedSummary(SECTIONS_BY_ID[id]));
      await expect(card.getByTestId('skip-tag')).toHaveCount(0);

      // D-06: the SECTION is always expanded, and nothing inside any card is a
      // control that collapses the section.
      //
      // The `button` half holds for every card but Player_statistics, and
      // 05-12 is why. The Vehicle statistics table's sort buttons are controls
      // over the DATA — which column the drawn rows are ordered by — and the
      // column picker of 05-14 is a control over which columns are drawn. A
      // `ready` section may hold those; what it may not hold is a control
      // over ITS OWN visibility, and `DashboardSection` is what would have to
      // render one. So the section's expansion is asserted where it is
      // decided, by the `details` half below and by the `(no-collapse)` shape
      // Phase 3 added, and this line keeps its claim only where it is true.
      if (id !== 'player-statistics') {
        await expect(card.locator('button')).toHaveCount(0);
      } else {
        // Named rather than merely allowed: the buttons that exist are the
        // table's six sort buttons, and nothing else in the card is one.
        await expect(card.getByTestId('vehicle-table').locator('button')).toHaveCount(6);
      }
      // The `details` half is narrower, and deliberately so. A `pending` card is
      // a promise with no dashboard, so a disclosure inside it would be a
      // control over content that does not exist yet. A `ready` card may hold a
      // `details` that is part of its dashboard: Financial_data's Premium block
      // discloses the premium values it could not chart (05-10, D-20), and
      // Player_statistics' Vehicle block discloses the export's own per-battle-
      // type coverage (05-14, D-07). Both are disclosures about the DATA, not
      // collapse controls for the section, and the section around them is still
      // always expanded. Player_statistics holds two of them for the same
      // reason: the battle-type summary and the column picker are both
      // controls over the DATA it draws.
      if (
        id === 'activity-history' ||
        id === 'financial-data' ||
        id === 'player-statistics' ||
        id === 'payment-history'
      ) {
        // Not a hole: the disclosure each of those cards DOES hold is
        // named here, so a card that grew a disclosure over ITS OWN content —
        // which is what D-06 forbids — would fail rather than pass by omission.
        if (id === 'player-statistics') {
          // Both of them named, and the count pinned — so a third disclosure
          // is a test failure to own rather than a silent widening of what
          // this card is allowed to contain.
          await expect(card.getByTestId('battle-type-summary-disclosure')).toHaveCount(1);
          await expect(card.getByTestId('column-picker')).toHaveCount(1);
          await expect(card.locator('details')).toHaveCount(2);
        }
        continue;
      }
      await expect(card.locator('details')).toHaveCount(0);
    }

    // User_Info is the ONLY pending section this phase ends with, and it
    // promises no dashboard that will ever be built — so the
    // SECTION_NOTE_PENDING loop that stood here through 05-10, 05-12 and 05-13
    // is now EMPTY and is removed rather than left iterating over nothing.
    // Its assertion, that the four READY cards say no longer "a dashboard is
    // coming", is the part that carries the contract.
    await expect(section(page, 'user-info')).toContainText(SECTION_NOTE_USER_INFO);
    await expect(section(page, 'user-info')).not.toContainText(SECTION_NOTE_PENDING);

    // The four READY sections must NOT carry the promise any more, and this is
    // the assertion the 05-10, 05-12 and 05-15 flips have to keep: a `ready`
    // card that still says a dashboard is coming is a card that contradicts
    // itself. Activity_history is a ready section that still says so, and says
    // it from the Login history block inside it (04-08) — the promise is
    // deferred, not dropped. Financial_data, Player_statistics and
    // Payment_history say nothing of the kind, because their blocks ARE the
    // dashboards they would have promised.
    await expect(section(page, 'activity-history')).toContainText(SECTION_NOTE_PENDING);
    await expect(section(page, 'financial-data')).not.toContainText(SECTION_NOTE_PENDING);
    await expect(section(page, 'player-statistics')).not.toContainText(SECTION_NOTE_PENDING);
    await expect(section(page, 'payment-history')).not.toContainText(SECTION_NOTE_PENDING);
  });

  test('(retired) the badge list, summary line, account heading and results wrapper are gone', async ({
    page,
  }) => {
    await importZip(page, buildSampleExport(), 'sample.zip');
    await expect(page.getByTestId('identity-nickname')).toBeVisible({ timeout: 30_000 });

    for (const retired of ['category-badge', 'summary-line', 'account-heading', 'results']) {
      await expect(page.getByTestId(retired)).toHaveCount(0);
    }
  });

  test('(skeleton) a first visit shows the greyed skeleton everywhere', async ({ page }) => {
    const header = page.getByTestId('identity-header');
    await expect(header).toHaveAttribute('data-variant', 'skeleton');
    await expect(page.getByTestId('identity-title')).toHaveText(IDENTITY_SKELETON_TITLE);
    await expect(header).toContainText(IDENTITY_SKELETON_PROMPT);
    // The skeleton must NOT answer to the nickname test id, or a test asking
    // "is a nickname showing?" would pass with a placeholder.
    await expect(page.getByTestId('identity-nickname')).toHaveCount(0);

    for (const id of SUPPORTED_IDS) {
      const card = section(page, id);
      await expect(card).toHaveAttribute('data-status', 'not-loaded');
      await expect(card.getByTestId('section-status')).toHaveText(
        formatSectionStatus('not-loaded', SECTIONS_BY_ID[id]),
      );
    }
  });

  test('(absent) a supported category missing from the export reads "Not in this export" and the other four keep their statuses', async ({
    page,
  }) => {
    await importZip(page, buildMissingPaymentHistoryExport(), 'missing-payment.zip');
    await expect(page.getByTestId('identity-nickname')).toBeVisible({ timeout: 30_000 });

    const missing = section(page, 'payment-history');
    await expect(missing).toHaveAttribute('data-status', 'no-export');
    await expect(missing.getByTestId('section-status')).toHaveText('Not in this export');
    // DATA-04: absent is a different fact from empty, so it must not borrow
    // the empty wording either.
    await expect(missing).not.toContainText('This export contains no rows for Payment_history');

    // User_Info is the one supported category no phase builds a dashboard for,
    // so it is the only one left `pending` after this one.
    await expect(section(page, 'user-info')).toHaveAttribute('data-status', 'pending');
    // The three shipped sections are `ready` in this export too — the same
    // statuses they read in the sample, which is the point: removing one
    // folder must not change another section's status.
    await expect(section(page, 'activity-history')).toHaveAttribute('data-status', 'ready');
    // Financial_data left the pending set in 05-10, Player_statistics in
    // 05-12 and Payment_history in 05-15, each in the same commit that mounted
    // its block, so both are `ready` here as well.
    await expect(section(page, 'financial-data')).toHaveAttribute('data-status', 'ready');
    await expect(section(page, 'player-statistics')).toHaveAttribute('data-status', 'ready');
  });

  test('(empty) a category present with zero parsed rows says so, in words distinct from absent', async ({
    page,
  }) => {
    await importZip(page, buildZeroRowPaymentExport(), 'zero-row-payment.zip');
    await expect(page.getByTestId('identity-nickname')).toBeVisible({ timeout: 30_000 });

    const card = section(page, 'payment-history');
    await expect(card).toHaveAttribute('data-status', 'empty');
    await expect(card.getByTestId('section-status')).toHaveText(
      'This export contains no rows for Payment_history',
    );
    // The empty card states a count of nothing; it does not dress a zero up
    // as an import summary.
    await expect(card.getByTestId('section-summary')).toHaveCount(0);
  });

  test('(fallback) an export with no User_Info row falls back to the account ID as the title', async ({
    page,
  }) => {
    await importZip(page, buildMissingUserInfoExport(), 'missing-user-info.zip');
    const header = page.getByTestId('identity-header');
    await expect(header).toHaveAttribute('data-variant', 'fallback', { timeout: 30_000 });

    await expect(page.getByTestId('identity-title')).toHaveText(SAMPLE_ACCOUNT_ROOT);
    // No caption and no value list, because there are no values to qualify —
    // and no ID line, which would repeat the title.
    await expect(header).not.toContainText(IDENTITY_CAPTION);
    await expect(page.getByTestId('identity-region')).toHaveCount(0);
    await expect(page.getByTestId('identity-created')).toHaveCount(0);
    await expect(page.getByTestId('identity-account-id')).toHaveCount(0);

    await expect(section(page, 'user-info')).toHaveAttribute('data-status', 'no-export');
  });

  test('(empty-user-info) a User_Info folder with no rows is an empty section and a fallback header', async ({
    page,
  }) => {
    await importZip(page, buildEmptyAccountInfoExport(), 'empty-user-info.zip');
    const header = page.getByTestId('identity-header');
    await expect(header).toHaveAttribute('data-variant', 'fallback', { timeout: 30_000 });

    // A folder that IS in the archive but yielded no row is `empty`, not
    // `no-export` — the two absences must not collapse (DATA-04).
    await expect(section(page, 'user-info')).toHaveAttribute('data-status', 'empty');
    await expect(section(page, 'user-info').getByTestId('section-status')).toHaveText(
      formatSectionStatus('empty', 'User_Info'),
    );
  });

  test('(partial-row) a parsed User_Info row with blank cells renders "Unknown", never an empty line', async ({
    page,
  }) => {
    await importZip(page, buildPartialAccountInfoExport(), 'partial-row.zip');
    const header = page.getByTestId('identity-header');

    // `loaded`, not `fallback` and not `skeleton`: a row WAS parsed, which
    // is exactly the distinction the fallback variant erases. Both other
    // variants are asserted absent so this cannot pass on the wrong card.
    await expect(header).toHaveAttribute('data-variant', 'loaded', { timeout: 30_000 });
    await expect(header).not.toHaveAttribute('data-variant', 'fallback');
    await expect(header).not.toHaveAttribute('data-variant', 'skeleton');

    // D-16: each blank slot shows the placeholder word rather than nothing.
    // An empty <dd> or an empty <h2> is the regression this test exists for.
    await expect(page.getByTestId('identity-nickname')).toHaveText(UNKNOWN_VALUE);
    await expect(page.getByTestId('identity-region')).toHaveText(UNKNOWN_VALUE);

    // The populated third field still renders, so "Unknown" is a per-field
    // answer and not a whole-card fallback.
    await expect(page.getByTestId('identity-created')).toHaveText(SAMPLE_CREATED_DATE);
  });

  test('(partial-row-nickname) a missing nickname alone leaves the rest of the row intact', async ({
    page,
  }) => {
    await importZip(
      page,
      buildPartialAccountInfoExport({ blankNickname: true, blankRegion: false }),
      'partial-nickname.zip',
    );
    await expect(page.getByTestId('identity-nickname')).toHaveText(UNKNOWN_VALUE, {
      timeout: 30_000,
    });
    await expect(page.getByTestId('identity-region')).toHaveText(PARTIAL_ROW_REGION);
  });

  test('(multi-row) a multi-row Account_Info picks the row whose ID matches the account root', async ({
    page,
  }) => {
    await importZip(page, buildMultiRowAccountInfoExport({ matchingRow: true }), 'multi-match.zip');
    await expect(page.getByTestId('identity-nickname')).toHaveText(MULTIROW_MATCH_NICKNAME, {
      timeout: 30_000,
    });
    await expect(page.getByTestId('identity-region')).toHaveText(MULTIROW_MATCH_REGION);
  });

  test('(multi-row-no-match) with no matching ID the first row wins, not the last', async ({
    page,
  }) => {
    await importZip(
      page,
      buildMultiRowAccountInfoExport({ matchingRow: false }),
      'multi-no-match.zip',
    );
    await expect(page.getByTestId('identity-nickname')).toHaveText(MULTIROW_DECOY_NICKNAME, {
      timeout: 30_000,
    });
    await expect(page.getByTestId('identity-region')).toHaveText(MULTIROW_DECOY_REGION);
  });

  test('(rootless) a re-zipped export with no account folder keeps the loaded header but shows no ID line', async ({
    page,
  }) => {
    await importZip(page, buildRootlessExport(), 'rootless.zip');
    const header = page.getByTestId('identity-header');
    await expect(header).toHaveAttribute('data-variant', 'loaded', { timeout: 30_000 });

    await expect(page.getByTestId('identity-nickname')).toHaveText(SAMPLE_NICKNAME);
    // There is no account root to show, so the line is omitted rather than
    // rendered empty.
    await expect(page.getByTestId('identity-account-id')).toHaveCount(0);
  });

  test('(case-sum) a User_Info plus a user_info folder are ONE section with summed counts', async ({
    page,
  }) => {
    await importZip(page, buildCaseVariantFoldersExport(), 'case-variants.zip');
    const card = section(page, 'user-info');
    await expect(card).toHaveAttribute('data-status', 'pending', { timeout: 30_000 });

    // One section, not two, and its counts are the SUM across both folders
    // (1 + 1 file, 1 + 1 row) rather than either one alone.
    await expect(page.locator('[data-testid="dashboard-section-user-info"]')).toHaveCount(1);
    await expect(card.getByTestId('section-summary')).toHaveText(formatImportSummary(2, 2));
  });
});

// =============================================================================
// 03-04 Task 3 — the "Not yet supported" block (D-22, DATA-03)
// =============================================================================
//
// The point of this block is an HONESTY property that no amount of visual
// polish can supply: a user must be able to tell that a folder in their
// export is being ignored, without having to know which folders the viewer
// considers "known" and which it has never heard of. So the tests below
// compare COMPUTED STYLES across banners rather than trusting a class name,
// and they compare across tiers: if `known-deferred` and `unknown` ever
// render differently, this is where it shows.
// =============================================================================

/** The four non-supported folders of the sample, in the worker's order. */
const SAMPLE_UNSUPPORTED_ORDER = ['Chat_history', 'Clans', 'Bans', 'Device_info'] as const;

/**
 * The computed style of one banner, as the browser resolves it.
 *
 * Read through `getComputedStyle` because that is what a user actually
 * sees: two rules that declare the same colour in different ways are
 * identical on screen, and a class-name assertion would call them
 * different when they are not. The folder-name weight and size are
 * included because the folder name is the part a user scans for.
 */
function readBannerStyle(banner: Locator): Promise<Record<string, string>> {
  return banner.evaluate((node) => {
    const style = getComputedStyle(node);
    const folder = node.querySelector('[data-testid="banner-folder"]');
    const folderStyle = folder === null ? null : getComputedStyle(folder);
    return {
      backgroundColor: style.backgroundColor,
      borderColor: style.borderTopColor,
      borderWidth: style.borderTopWidth,
      borderStyle: style.borderTopStyle,
      color: style.color,
      padding: style.padding,
      borderRadius: style.borderRadius,
      folderFontWeight: folderStyle?.fontWeight ?? '',
      folderFontSize: folderStyle?.fontSize ?? '',
    };
  });
}

test.describe('not yet supported block (03-04 Task 3)', () => {
  test('(banners-sample) every non-supported folder gets an identical banner, in worker order', async ({
    page,
  }) => {
    await importZip(page, buildSampleExport(), 'sample.zip');
    const banners = page.getByTestId('unsupported-banner');
    await expect(banners).toHaveCount(4, { timeout: 30_000 });

    // Worker order: known-deferred first, then unknown, name-ascending
    // within each group — NOT the zip's order and NOT the D-02 order.
    await expect(banners.locator('[data-testid="banner-folder"]')).toHaveText([
      ...SAMPLE_UNSUPPORTED_ORDER,
    ]);

    for (const folder of SAMPLE_UNSUPPORTED_ORDER) {
      const banner = banners.nth(SAMPLE_UNSUPPORTED_ORDER.indexOf(folder));
      // The folder name plus the one sentence that is identical for every
      // tier. A tier-specific wording here would tell the user which
      // folders are "planned", which is a promise this project must not
      // make (DATA-03).
      await expect(banner).toContainText(UNSUPPORTED_BANNER_SUFFIX);
      await expect(banner.getByTestId('banner-counts')).toHaveText(expectedSummary(folder));
    }

    // Two of the four are known-deferred and two are unknown. The
    // `data-status` hook exists so this test can say so, and the identical
    // computed styles are what prove the hook never reached the CSS.
    expect(
      await banners.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-status'))),
    ).toEqual(['known-deferred', 'known-deferred', 'unknown', 'unknown']);

    const reference = await readBannerStyle(banners.first());
    for (let i = 1; i < 4; i++) {
      expect(
        await readBannerStyle(banners.nth(i)),
        `banner ${i} is styled differently from the first banner`,
      ).toEqual(reference);
    }
  });

  test('(banners-renamed) a fifth unknown folder appears with the same banner styling', async ({
    page,
  }) => {
    await importZip(page, buildRenamedRootExport(), 'renamed.zip');
    const banners = page.getByTestId('unsupported-banner');
    await expect(banners).toHaveCount(5, { timeout: 30_000 });

    await expect(banners.getByTestId('banner-folder').last()).toHaveText(EXTRA_UNKNOWN_FOLDER);
    await expect(banners.last()).toHaveAttribute('data-status', 'unknown');

    expect(
      await readBannerStyle(banners.last()),
      'the unknown-folder banner is styled differently from the first one',
    ).toEqual(await readBannerStyle(banners.first()));
  });

  test('(none) an export with no unsupported folder greys the block and lists nothing', async ({
    page,
  }) => {
    await importZip(page, buildOnlySupportedExport(), 'only-supported.zip');
    const block = section(page, 'not-yet-supported');
    await expect(block).toHaveAttribute('data-status', 'empty', { timeout: 30_000 });

    await expect(block.getByTestId('section-status')).toHaveText(UNSUPPORTED_NONE_DETECTED);
    await expect(page.getByTestId('unsupported-banner')).toHaveCount(0);
    // With no banners the intro ("These folders are in your export...")
    // would be a lie, so it is not rendered at all.
    await expect(block).not.toContainText(UNSUPPORTED_INTRO);
  });

  test('(skip) a folder with a parse error shows one skip tag, and it survives a reload', async ({
    page,
  }) => {
    await importZip(page, buildMalformedRowsExport(), 'malformed.zip');
    const banners = page.getByTestId('unsupported-banner');
    await expect(banners).toHaveCount(4, { timeout: 30_000 });

    // Exactly one tag on the whole page, on the Bans banner, reading the
    // one skipped row. The tag counts parse diagnostics, not files, so a
    // page-wide count of 1 also proves no other folder is claiming a skip.
    const bansBanner = banners.filter({ hasText: 'Bans' }).first();
    await expect(bansBanner.getByTestId('skip-tag')).toHaveText(formatSkippedRowCount(1));
    await expect(page.getByTestId('skip-tag')).toHaveCount(1);

    await page.reload();
    await expect(page.getByTestId('unsupported-banner')).toHaveCount(4, { timeout: 30_000 });
    await expect(page.getByTestId('skip-tag')).toHaveCount(1);
  });

  test('(case-variants) a lower-case bans folder is its own banner, and User_Info stays one section', async ({
    page,
  }) => {
    await importZip(page, buildCaseVariantFoldersExport(), 'case-variants.zip');
    const banners = page.getByTestId('unsupported-banner');
    await expect(banners).toHaveCount(5, { timeout: 30_000 });

    // Two separate banners: the classifier matches folders
    // case-insensitively, but an UNKNOWN folder is still reported under
    // the name it actually has, so the user sees what is in their zip.
    await expect(banners.getByTestId('banner-folder')).toHaveText([
      'Chat_history',
      'Clans',
      'Bans',
      'bans',
      'Device_info',
    ]);
    // The matching side of the same fixture — two folders, one section,
    // summed counts — is asserted in the `(case-sum)` test above.
    await expect(page.locator('[data-testid="dashboard-section-user-info"]')).toHaveCount(1);
  });

  test('(order) the six section cards render in D-02 order with the block last', async ({
    page,
  }) => {
    await importZip(page, buildSampleExport(), 'sample.zip');
    await expect(page.getByTestId('identity-nickname')).toBeVisible({ timeout: 30_000 });

    // Document order, because the sticky nav links by fragment and a card
    // that renders before the link that points at it is a broken nav.
    expect(await sectionIdsInOrder(page)).toEqual([
      'activity-history',
      'player-statistics',
      'financial-data',
      'payment-history',
      'user-info',
      'not-yet-supported',
    ]);
  });

  test('(markup) an untrusted folder name renders as text and creates no element', async ({
    page,
  }) => {
    await importZip(page, buildLongTextExport(), 'long-text.zip');
    const block = section(page, 'not-yet-supported');
    await expect(block).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });

    // LONG_UNKNOWN_FOLDER carries an unterminated <b> tag. Interpolated as
    // text it shows literally; interpolated as markup it would open a bold
    // run that swallows the rest of the block.
    await expect(block).toContainText(LONG_UNKNOWN_FOLDER);
    await expect(block.locator('b')).toHaveCount(0);
    // Same rule on the identity side: a 70-character unbroken nickname
    // wraps rather than widening the page.
    await expect(page.getByTestId('identity-nickname')).toHaveText(LONG_NICKNAME);
  });
});

// =============================================================================
// 03-06 Task 1 — the import region: one element, two variants, one notice slot
// =============================================================================
//
// The contract under test is a SHAPE, not a look: there is exactly one import
// element in the DOM at any moment, it is the same element before and after an
// import, and every transient message goes through the same live region. A
// regression that renders a second dropzone, re-creates the bar on the state
// change, or parks the spinner back inside the dropzone all show up here
// without a single pixel of visual assertion.
// =============================================================================

/** Every phrase the processing notice is allowed to show (D-08, D-11). */
const PROCESSING_PHRASES: ReadonlySet<string> = new Set([
  ...Object.values(STAGE_TEXT),
  // The per-category form carries a category name and a (i/n) pair that depend
  // on where the worker happened to be when the read landed, so each supported
  // folder is enumerated at (1/1) and the bare shape is accepted as well.
  ...SUPPORTED_IDS.map((id) =>
    formatParsingProgress({ category: SECTIONS_BY_ID[id], categoryIndex: 1, categoryTotal: 1 }),
  ),
]);

/** The literal shape of a per-category progress line, whatever the numbers. */
const PROCESSING_SHAPE = /^Parsing .+ \(\d+\/\d+\)\.\.\.$/;

/** One snapshot of the whole import region, read in a single DOM pass. */
interface BusySnapshot {
  variant: string | null;
  dropzoneCount: number;
  ariaDisabled: string | null;
  ariaBusy: string | null;
  prompt: string | null;
  inputDisabled: boolean;
  spinnerInSlot: number;
  spinnerInDropzone: number;
  processingInSlot: number;
  processingText: string | null;
  processingHasStatusRole: boolean;
  noticeSlotHeight: number;
  sections: number;
  identityVariant: string | null;
  liveRegionCount: number;
  statusRoleInSlot: number;
  sawBusy: boolean;
}

/**
 * Read the whole import region at once, waiting (inside the page) for the
 * dropzone to report itself busy first.
 *
 * ONE evaluate on purpose: the sample import settles inside the client's
 * 400 ms floor, so separate Playwright round trips for "is it busy" and
 * "what does it say" would race that transition and flake. The wait is a
 * frame loop in the page rather than a second round trip, and the snapshot is
 * taken on the first frame where the busy state is visible.
 */
async function readBusySnapshot(page: Page): Promise<BusySnapshot> {
  return page.evaluate(async () => {
    const q = (testid: string) => document.querySelector(`[data-testid="${testid}"]`);
    const read = (): Omit<BusySnapshot, 'sawBusy'> => {
      const bar = q('import-bar');
      const dropzone = q('dropzone');
      const slot = q('notice-slot');
      const processing = slot?.querySelector('[data-testid="processing-status"]') ?? null;
      return {
        variant: bar?.getAttribute('data-variant') ?? null,
        dropzoneCount: document.querySelectorAll('[data-testid="dropzone"]').length,
        ariaDisabled: dropzone?.getAttribute('aria-disabled') ?? null,
        ariaBusy: dropzone?.getAttribute('aria-busy') ?? null,
        prompt: dropzone?.querySelector('.prompt')?.textContent?.trim() ?? null,
        inputDisabled:
          (dropzone?.querySelector('[data-testid="file-input"]') as HTMLInputElement | null)
            ?.disabled ?? false,
        spinnerInSlot: slot?.querySelectorAll('[data-testid="spinner"]').length ?? -1,
        spinnerInDropzone: dropzone?.querySelectorAll('[data-testid="spinner"]').length ?? -1,
        processingInSlot:
          slot === null
            ? -1
            : Number(slot.querySelectorAll('[data-testid="processing-status"]').length),
        processingText: processing?.textContent?.trim() ?? null,
        processingHasStatusRole: processing?.getAttribute('role') === 'status',
        noticeSlotHeight: slot?.getBoundingClientRect().height ?? -1,
        sections: document.querySelectorAll('[data-testid^="dashboard-section-"]').length,
        identityVariant: q('identity-header')?.getAttribute('data-variant') ?? null,
        liveRegionCount: document.querySelectorAll('[aria-live]').length,
        statusRoleInSlot: slot?.querySelectorAll('[role="status"]').length ?? -1,
      };
    };

    for (let frame = 0; frame < 240; frame++) {
      const snapshot = read();
      if (snapshot.ariaBusy === 'true') return { ...snapshot, sawBusy: true };
      if (frame > 0) await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    return { ...read(), sawBusy: false };
  });
}

test.describe('import region (03-06 Task 1)', () => {
  test('(full-variant) a first visit is one full import element with an empty, zero-height notice slot', async ({
    page,
  }) => {
    const bar = page.getByTestId('import-bar');
    await expect(bar).toHaveAttribute('data-variant', 'full');

    // No meta row on a first visit: the persistent bar is the SLIM variant's
    // row, not a separate block below the dashboard.
    await expect(page.getByTestId('persistent-bar')).toHaveCount(0);
    await expect(page.getByTestId('imported-at')).toHaveCount(0);
    await expect(page.getByTestId('start-over')).toHaveCount(0);
    await expect(page.getByTestId('clear-data-control')).toHaveCount(0);

    // Exactly one dropzone, ever. Two of them would mean two import paths.
    const dropzone = page.getByTestId('dropzone');
    await expect(dropzone).toHaveCount(1);
    await expect(dropzone).toContainText(DROPZONE_PROMPT);

    // The live region exists before it has anything to say, and an empty one
    // takes up no room: a slot that pushed the dropzone down by a gap would
    // move the page around the moment the first notice arrives.
    const slot = page.getByTestId('notice-slot');
    await expect(slot).toHaveCount(1);
    const height = await slot.evaluate((node) => node.getBoundingClientRect().height);
    expect(height).toBe(0);
  });

  test('(busy) processing runs in the notice slot while the dropzone keeps its prompt', async ({
    page,
  }) => {
    await importZip(page, buildSampleExport(), 'sample.zip');
    const snapshot = await readBusySnapshot(page);

    expect(snapshot.sawBusy, 'the dropzone never reported aria-busy during the import').toBe(true);
    expect(snapshot.ariaDisabled).toBe('true');
    // D-26: busy is the DISABLED state, not a separate "processing" flag —
    // the prompt no longer disappears, so the flag has to follow `disabled`
    // or it would never be true again.
    expect(snapshot.ariaBusy).toBe('true');
    expect(snapshot.inputDisabled).toBe(true);
    // The prompt is still there, exactly as before the import started.
    expect(snapshot.prompt).toBe(DROPZONE_PROMPT);

    // One live region, and it is the notice slot.
    expect(snapshot.liveRegionCount).toBe(1);

    // The progress line and its spinner live in the slot; the dropzone has
    // no spinner at all any more.
    expect(snapshot.processingInSlot).toBe(1);
    expect(snapshot.spinnerInSlot).toBe(1);
    expect(snapshot.spinnerInDropzone).toBe(0);
    expect(
      snapshot.processingText !== null &&
        (PROCESSING_PHRASES.has(snapshot.processingText) ||
          PROCESSING_SHAPE.test(snapshot.processingText)),
      `unexpected processing text: ${JSON.stringify(snapshot.processingText)}`,
    ).toBe(true);

    // RESEARCH Pitfall 10: a status role inside a status region is announced
    // twice. The slot owns the role; its children must not repeat it.
    expect(snapshot.processingHasStatusRole).toBe(false);
    expect(snapshot.statusRoleInSlot).toBe(0);

    // The first import has no cached dataset, so the skeleton stays put
    // underneath the full-size dropzone.
    expect(snapshot.variant).toBe('full');
    expect(snapshot.identityVariant).toBe('skeleton');
    expect(snapshot.sections).toBe(SUPPORTED_IDS.length + 1);
  });

  test('(slim-variant) after the import the same element is the slim bar', async ({ page }) => {
    await importZip(page, buildSampleExport(), 'sample.zip');
    await expect(page.getByTestId('identity-nickname')).toBeVisible({ timeout: 30_000 });

    const bar = page.getByTestId('import-bar');
    await expect(bar).toHaveAttribute('data-variant', 'slim');

    // The meta row is INSIDE the bar and carries all three of its parts.
    const meta = page.getByTestId('persistent-bar');
    await expect(meta).toHaveCount(1);
    await expect(page.getByTestId('imported-at')).toHaveText(/^Imported on /);
    await expect(page.getByTestId('start-over')).toHaveCount(1);
    await expect(page.getByTestId('clear-data-control')).toHaveCount(1);

    // Still one dropzone, now the compact replace affordance.
    const dropzone = page.getByTestId('dropzone');
    await expect(dropzone).toHaveCount(1);
    await expect(dropzone).toContainText(COMPACT_DROPZONE_PROMPT);
    await expect(dropzone).not.toContainText(DROPZONE_PROMPT);

    // The progress notice is gone now that there is nothing in flight, so
    // the import bar's notice slot is the only live region it owns.
    await expect(page.getByTestId('processing-status')).toHaveCount(0);
    await expect(bar.locator('[aria-live]')).toHaveCount(1);
    // The page carries exactly two live regions besides that slot: the
    // playtime status line 04-02 added and the player-stats status line
    // 05-12 added, both of which their UI-SPEC state matrices require to
    // exist in every state (an empty live region announces nothing). The
    // count is asserted rather than the selector avoided, so a second block
    // that forgot to be polite-and-quiet fails here. The error paragraphs use
    // `role="alert"` and NO `aria-live` attribute, so they are implicit live
    // regions and are deliberately not in this count.
    await expect(page.locator('[aria-live]')).toHaveCount(3);
    await expect(page.getByTestId('playtime-status')).toHaveCount(1);
    await expect(page.getByTestId('player-stats-status')).toHaveCount(1);
  });

  test('(accessible-name) the full dropzone is named by its label, the compact one by its own prompt', async ({
    page,
  }) => {
    const dropzone = page.getByTestId('dropzone');

    // A first visit: the full-size dropzone names itself, so the landmark
    // reads as what it is rather than as whatever sentence is inside it.
    await expect(dropzone).toHaveAccessibleName(DROPZONE_ARIA_LABEL);

    await importZip(page, buildSampleExport(), 'sample.zip');
    await expect(page.getByTestId('identity-nickname')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('import-bar')).toHaveAttribute('data-variant', 'slim');

    // W-02: an `aria-label` REPLACES the element's content as its accessible
    // name, so a label on the compact variant would silence the very sentence
    // that says dropping here REPLACES the loaded export. The attribute must
    // be absent, leaving the visible prompt to be the name.
    await expect(dropzone).not.toHaveAttribute('aria-label', /./);
    await expect(dropzone).toHaveAccessibleName(COMPACT_DROPZONE_PROMPT);
  });

  test('(single-live-region) the notice slot is the page’s only aria-live region and nests no status role', async ({
    page,
  }) => {
    const slot = page.getByTestId('notice-slot');
    await expect(slot).toHaveAttribute('role', 'status');
    await expect(slot).toHaveAttribute('aria-live', 'polite');
    await expect(slot).toHaveAttribute('aria-atomic', 'true');

    // The cache-check block is a `role="status"` of its own, but it is never
    // on screen at the same time as the bar — and it carries no `aria-live`
    // attribute, so the attribute count below is 1, not 2.
    const live = page.locator('[aria-live]');
    await expect(live).toHaveCount(1);
    await expect(live).toHaveAttribute('data-testid', 'notice-slot');
  });
});

// =============================================================================
// 03-06 Task 2 — the confirm panel inside the bar, and where focus goes
// =============================================================================
//
// Opening a destructive confirm moves the user's attention to a dialog and
// closing it must put it back where it was. That is not a nicety here: the
// bar REBUILDS around the panel (the meta row disappears after a confirmed
// clear), so a focus manager that only ever remembered "the dropzone" would
// strand keyboard users on <body> the moment they said no. Each test below
// names the trigger it opened the panel from and the element focus must
// return to.
// =============================================================================

/**
 * Import the sample and wait for the bar to become the slim variant.
 *
 * `bytes` defaults to a fresh build, but a caller that needs the SAME export
 * twice must pass one array to both uses rather than calling the builder
 * twice: fflate stamps each archive with a second-resolution mtime, so two
 * builds a second apart are different files with different hashes. That is
 * invisible everywhere else and fatal for the duplicate row, which is exactly
 * what makes it worth saying out loud here.
 */
async function importSampleAndWait(
  page: Page,
  bytes: Uint8Array = buildSampleExport(),
): Promise<void> {
  await importZip(page, bytes, 'sample.zip');
  await expect(page.getByTestId('import-bar')).toHaveAttribute('data-variant', 'slim', {
    timeout: 30_000,
  });
}

test.describe('confirm panel and focus (03-06 Task 2)', () => {
  test('(start-over) the panel opens inside the bar with the safe default focused, and dismiss returns to the trigger', async ({
    page,
  }) => {
    await importSampleAndWait(page);

    await page.getByTestId('start-over').click();

    const panel = page.getByTestId('confirm-panel');
    await expect(panel).toBeVisible();

    // Inside the bar, not floating above or below the whole page: the
    // destructive question belongs next to the controls it is about.
    await expect(
      page.getByTestId('import-bar').locator('[data-testid="confirm-panel"]'),
    ).toHaveCount(1);
    const meta = await page.getByTestId('persistent-bar').boundingBox();
    const box = await panel.boundingBox();
    expect(meta).not.toBeNull();
    expect(box).not.toBeNull();
    expect(box!.y).toBeGreaterThanOrEqual(meta!.y + meta!.height);

    // The dismiss button is the safe default: it is the answer that changes
    // nothing, so it is where focus starts.
    await expect(page.getByTestId('confirm-cancel')).toBeFocused();
    await expect(panel).toContainText(CONFIRM_CLEAR_MESSAGE);

    // Saying no returns the user exactly where they were.
    await page.getByTestId('confirm-cancel').click();
    await expect(panel).toHaveCount(0);
    await expect(page.getByTestId('start-over')).toBeFocused();
    // And nothing was destroyed on the way.
    await expect(page.getByTestId('import-bar')).toHaveAttribute('data-variant', 'slim');
  });

  test('(clear-data) the persistent control opens the same panel and gives focus back to itself', async ({
    page,
  }) => {
    await importSampleAndWait(page);

    await page.getByTestId('clear-data-control').click();

    await expect(page.getByTestId('confirm-panel')).toBeVisible();
    await expect(page.getByTestId('confirm-cancel')).toBeFocused();

    await page.getByTestId('confirm-cancel').click();
    await expect(page.getByTestId('confirm-panel')).toHaveCount(0);
    await expect(page.getByTestId('clear-data-control')).toBeFocused();
  });

  test('(replace-on-drop) a different zip confirms first, the old data stays visible, and dismiss focuses the dropzone', async ({
    page,
  }) => {
    await importSampleAndWait(page);
    await expect(page.getByTestId('identity-nickname')).toHaveText(SAMPLE_NICKNAME);

    await dropFiles(page, page.getByTestId('dropzone'), [
      {
        name: 'renamed.zip',
        mimeType: 'application/zip',
        bytes: [...buildRenamedRootExport()],
      },
    ]);

    await expect(page.getByTestId('confirm-panel')).toBeVisible();
    // Replace copy, not clear copy: the two destructive flows must not
    // read the same to the user.
    await expect(page.getByTestId('confirm-panel')).toContainText(CONFIRM_REPLACE_MESSAGE);
    await expect(page.getByTestId('confirm-commit')).toHaveText(REPLACE_DATASET_LABEL);
    await expect(page.getByTestId('confirm-cancel')).toHaveText(KEEP_CURRENT_DATA_LABEL);
    await expect(page.getByTestId('confirm-cancel')).toBeFocused();

    // Nothing has been touched yet: the confirm precedes any processing, so
    // the dataset on screen is still exactly the one the user imported.
    await expect(page.getByTestId('processing-status')).toHaveCount(0);
    await expect(page.getByTestId('identity-nickname')).toHaveText(SAMPLE_NICKNAME);
    await expect(page.getByTestId('identity-account-id')).toHaveText(
      formatAccountId(SAMPLE_ACCOUNT_ROOT),
    );

    await page.getByTestId('confirm-cancel').click();
    await expect(page.getByTestId('confirm-panel')).toHaveCount(0);
    await expect(page.getByTestId('dropzone')).toBeFocused();
    await expect(page.getByTestId('identity-nickname')).toHaveText(SAMPLE_NICKNAME);
  });

  test('(confirmed-clear) a confirmed clear returns the bar to full and puts focus on the dropzone', async ({
    page,
  }) => {
    await importSampleAndWait(page);
    await page.getByTestId('start-over').click();
    await expect(page.getByTestId('confirm-panel')).toBeVisible();

    await page.getByTestId('confirm-commit').click();

    // The trigger is gone with the dataset, so focus cannot go back to it.
    await expect(page.getByTestId('import-bar')).toHaveAttribute('data-variant', 'full');
    await expect(page.getByTestId('start-over')).toHaveCount(0);
    await expect(page.getByTestId('persistent-bar')).toHaveCount(0);
    await expect(page.getByTestId('identity-nickname')).toHaveCount(0);
    await expect(page.getByTestId('dropzone')).toBeFocused();
  });

  test('(shared-copy) Start over and Clear my cached data open the identical panel', async ({
    page,
  }) => {
    await importSampleAndWait(page);

    const read = async (testid: string) => {
      await page.getByTestId(testid).click();
      const panel = page.getByTestId('confirm-panel');
      await expect(panel).toBeVisible();
      const snapshot = {
        text: (await panel.innerText()).trim(),
        commit: (await page.getByTestId('confirm-commit').innerText()).trim(),
        cancel: (await page.getByTestId('confirm-cancel').innerText()).trim(),
      };
      await page.getByTestId('confirm-cancel').click();
      await expect(panel).toHaveCount(0);
      return snapshot;
    };

    const fromStartOver = await read('start-over');
    const fromClearData = await read('clear-data-control');

    // Phase 2 D-22: one panel, one copy pair. If the two triggers ever drift
    // the user is being asked to confirm the same destruction twice in two
    // different voices.
    expect(fromStartOver).toEqual(fromClearData);
    expect(fromStartOver.text).toContain(CONFIRM_CLEAR_MESSAGE);
    expect(fromStartOver.commit).toBe(DELETE_CACHED_DATA_LABEL);
    expect(fromStartOver.cancel).toBe(KEEP_CACHED_DATA_LABEL);
  });
});

// =============================================================================
// 03-06 Task 3 — the app-state matrix, row by row
// =============================================================================
//
// One test per row of the UI-SPEC App-state matrix, plus the two guarantees
// the matrix only implies: the cached dashboard survives a failed replace all
// the way through a reload, and the cache check renders alone so a returning
// user never sees the skeleton flash past. Expected text is computed from
// `ui-copy.ts` and the fixtures, never hand-copied.
// =============================================================================

/** A `DropFileSpec` for a built export. */
function zipSpec(name: string, bytes: Uint8Array) {
  return { name, mimeType: 'application/zip', bytes: [...bytes] };
}

/** The import summary of every section that has one, keyed by section testid. */
async function sectionSummaries(page: Page): Promise<Record<string, string>> {
  return importLines(page).evaluateAll((nodes) =>
    Object.fromEntries(
      nodes.map((node) => [
        node.closest('[data-testid^="dashboard-section-"]')?.getAttribute('data-testid') ?? '',
        (node.textContent ?? '').trim(),
      ]),
    ),
  );
}

/** The identity header's account-ID line, or null when the header has none. */
async function accountIdText(page: Page): Promise<string | null> {
  const line = page.getByTestId('identity-account-id');
  return (await line.count()) === 0 ? null : (await line.innerText()).trim();
}

interface InFlightSnapshot {
  sawProcessing: boolean;
  variant: string | null;
  dropzoneDisabled: string | null;
  accountId: string | null;
}

/**
 * Read the import region and the identity header on the FIRST frame the
 * progress notice is on screen, in one pass.
 *
 * The replacement settles inside the client's 400 ms floor, so a poll from
 * the test side would usually come back after the account ID had already
 * been swapped. Polling in the page and reading in the same task cannot
 * miss that frame.
 */
async function readInFlight(page: Page): Promise<InFlightSnapshot> {
  return page.evaluate(async () => {
    const read = () => ({
      variant:
        document.querySelector('[data-testid="import-bar"]')?.getAttribute('data-variant') ?? null,
      dropzoneDisabled:
        document.querySelector('[data-testid="dropzone"]')?.getAttribute('aria-disabled') ?? null,
      accountId:
        document.querySelector('[data-testid="identity-account-id"]')?.textContent?.trim() ?? null,
    });
    for (let frame = 0; frame < 240; frame++) {
      if (document.querySelector('[data-testid="processing-status"]') !== null) {
        return { sawProcessing: true, ...read() };
      }
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    return { sawProcessing: false, ...read() };
  });
}

/** Drop bytes onto the dropzone and wait for the confirm panel the guard opens. */
async function dropAndConfirm(page: Page, name: string, bytes: Uint8Array): Promise<void> {
  await dropFiles(page, page.getByTestId('dropzone'), [zipSpec(name, bytes)]);
  await expect(page.getByTestId('confirm-panel')).toBeVisible();
  await page.getByTestId('confirm-commit').click();
}

test.describe('app-state matrix (03-06 Task 3)', () => {
  test('(duplicate) the identical zip confirms first, then the notice appears and nothing changes', async ({
    page,
  }) => {
    // The replace confirmation PRECEDES the worker's hash check, so even
    // identical bytes are offered back to the user rather than silently
    // swallowed. The same byte array as the first import, deliberately.
    const sample = buildSampleExport();
    await importSampleAndWait(page, sample);
    const importedOnBefore = await page.getByTestId('imported-at').innerText();
    const summariesBefore = await sectionSummaries(page);

    await dropAndConfirm(page, 'sample.zip', sample);

    const notice = page.getByTestId('duplicate-notice');
    await expect(notice).toBeVisible({ timeout: 30_000 });
    await expect(notice).toHaveText(DUPLICATE_BANNER_MESSAGE);
    await expect(
      page.getByTestId('notice-slot').locator('[data-testid="duplicate-notice"]'),
    ).toHaveCount(1);

    // The notice replaces the progress line rather than joining it.
    await expect(page.getByTestId('processing-status')).toHaveCount(0);
    // Nothing about the dataset moved.
    await expect(page.getByTestId('imported-at')).toHaveText(importedOnBefore);
    await expect(page.getByTestId('identity-nickname')).toHaveText(SAMPLE_NICKNAME);
    expect(await sectionSummaries(page)).toEqual(summariesBefore);
    // The drop area is live again, so the user can act on the notice.
    await expect(page.getByTestId('dropzone')).not.toHaveAttribute('aria-disabled');
  });

  test('(replace-in-flight) the old dashboard is on screen the whole time the replacement runs', async ({
    page,
  }) => {
    await importSampleAndWait(page);

    const snapshotPromise = readInFlight(page);
    await dropAndConfirm(page, 'renamed.zip', buildRenamedRootExport());
    const snapshot = await snapshotPromise;

    expect(snapshot.sawProcessing, 'the replacement never showed a progress notice').toBe(true);
    expect(snapshot.variant).toBe('slim');
    expect(snapshot.dropzoneDisabled).toBe('true');
    // D-27: the header is still the OLD dataset while the NEW one is being
    // written, because the worker only commits inside one transaction.
    expect(snapshot.accountId).toBe(formatAccountId(SAMPLE_ACCOUNT_ROOT));

    await expect(page.getByTestId('identity-account-id')).toHaveText(
      formatAccountId(RENAMED_ACCOUNT_ROOT),
      { timeout: 30_000 },
    );
    await expect(page.getByTestId('processing-status')).toHaveCount(0);
  });

  test('(failed-replace) the error shows in the slot and the old dataset survives, including a reload', async ({
    page,
  }) => {
    await importSampleAndWait(page);
    const summariesBefore = await sectionSummaries(page);
    const importedOnBefore = await page.getByTestId('imported-at').innerText();

    await dropAndConfirm(page, 'truncated.zip', buildTruncatedExport());

    const banner = page.getByTestId('failure-banner');
    await expect(banner).toBeVisible({ timeout: 30_000 });
    await expect(banner).toHaveText(GENERIC_FAILURE_MESSAGE);
    await expect(
      page.getByTestId('notice-slot').locator('[data-testid="failure-banner"]'),
    ).toHaveCount(1);
    // D-04: no reporting affordance, no leaking of the worker's own words.
    await expect(banner.locator('a, button')).toHaveCount(0);
    await expect(banner).not.toContainText('truncated');

    // The bar is still the slim one and the dashboard is still the old one.
    await expect(page.getByTestId('import-bar')).toHaveAttribute('data-variant', 'slim');
    await expect(page.getByTestId('identity-nickname')).toHaveText(SAMPLE_NICKNAME);
    expect(await accountIdText(page)).toBe(formatAccountId(SAMPLE_ACCOUNT_ROOT));
    expect(await sectionSummaries(page)).toEqual(summariesBefore);
    await expect(page.getByTestId('imported-at')).toHaveText(importedOnBefore);

    // Storage agrees with the screen: the half-written replacement left the
    // previous dataset exactly where it was.
    await page.reload();
    await expect(page.getByTestId('import-bar')).toHaveAttribute('data-variant', 'slim', {
      timeout: 30_000,
    });
    await expect(page.getByTestId('identity-nickname')).toHaveText(SAMPLE_NICKNAME);
    expect(await accountIdText(page)).toBe(formatAccountId(SAMPLE_ACCOUNT_ROOT));
    expect(await sectionSummaries(page)).toEqual(summariesBefore);
    await expect(page.getByTestId('imported-at')).toHaveText(importedOnBefore);
  });

  test('(first-error) a rejected first import shows the banner above an untouched skeleton and recovers', async ({
    page,
  }) => {
    const summariesBefore = await sectionSummaries(page);

    // A .txt is rejected by the pre-check before anything is posted, so this
    // is the "no cached result" row of the matrix, not the replace row.
    await importZip(page, new TextEncoder().encode('these are not export bytes'), 'notes.txt');

    const banner = page.getByTestId('failure-banner');
    await expect(banner).toBeVisible();
    await expect(banner).toHaveText(GENERIC_FAILURE_MESSAGE);
    await expect(
      page.getByTestId('notice-slot').locator('[data-testid="failure-banner"]'),
    ).toHaveCount(1);

    // The full-size dropzone is still there, still live, with the skeleton
    // untouched underneath it.
    await expect(page.getByTestId('import-bar')).toHaveAttribute('data-variant', 'full');
    await expect(page.getByTestId('dropzone')).not.toHaveAttribute('aria-disabled');
    await expect(page.getByTestId('dropzone')).toContainText(DROPZONE_PROMPT);
    await expect(page.getByTestId('identity-header')).toHaveAttribute('data-variant', 'skeleton');
    expect(await sectionSummaries(page)).toEqual(summariesBefore);

    // A valid drop immediately afterwards recovers with no ceremony: the
    // banner is replaced by the progress notice, then by the dashboard.
    await importZip(page, buildSampleExport(), 'sample.zip');
    await expect(page.getByTestId('identity-nickname')).toBeVisible({ timeout: 30_000 });
    await expect(banner).toHaveCount(0);
    await expect(page.getByTestId('import-bar')).toHaveAttribute('data-variant', 'slim');
  });

  test('(cleared) a confirmed clear shows the acknowledgment, restores the first-visit bar, and a later drop drops the notice', async ({
    page,
  }) => {
    await importSampleAndWait(page);
    await page.getByTestId('start-over').click();
    await expect(page.getByTestId('confirm-panel')).toBeVisible();
    await page.getByTestId('confirm-commit').click();

    const ack = page.getByTestId('cleared-ack');
    await expect(ack).toBeVisible({ timeout: 30_000 });
    await expect(ack).toHaveText(CLEARED_ACK_MESSAGE);
    await expect(
      page.getByTestId('notice-slot').locator('[data-testid="cleared-ack"]'),
    ).toHaveCount(1);

    await expect(page.getByTestId('import-bar')).toHaveAttribute('data-variant', 'full');
    await expect(page.getByTestId('persistent-bar')).toHaveCount(0);
    await expect(page.getByTestId('identity-header')).toHaveAttribute('data-variant', 'skeleton');
    await expect(page.getByTestId('identity-title')).toHaveText(IDENTITY_SKELETON_TITLE);

    // The next action takes the acknowledgment with it — nothing here
    // auto-dismisses on a timer.
    await importZip(page, buildSampleExport(), 'sample.zip');
    await expect(page.getByTestId('identity-nickname')).toBeVisible({ timeout: 30_000 });
    await expect(ack).toHaveCount(0);
  });

  test('(return-visit) a reload comes straight back to the loaded dashboard, with no file and no cache-check block', async ({
    page,
  }) => {
    await importSampleAndWait(page);
    const summariesBefore = await sectionSummaries(page);

    await page.reload();

    await expect(page.getByTestId('import-bar')).toHaveAttribute('data-variant', 'slim', {
      timeout: 30_000,
    });
    await expect(page.getByTestId('identity-nickname')).toHaveText(SAMPLE_NICKNAME);
    expect(await sectionSummaries(page)).toEqual(summariesBefore);
    // The cache-check block is gone once the check has resolved, and the
    // file input carries nothing across the reload.
    await expect(page.getByTestId('cache-check-status')).toHaveCount(0);
    const carried = await page
      .getByTestId('file-input')
      .evaluate((node) => (node as HTMLInputElement).files?.length ?? 0);
    expect(carried).toBe(0);
  });

  test('(drop-during-confirm) a second drop while the panel is open changes nothing', async ({
    page,
  }) => {
    await importSampleAndWait(page);
    await dropFiles(page, page.getByTestId('dropzone'), [
      zipSpec('renamed.zip', buildRenamedRootExport()),
    ]);
    await expect(page.getByTestId('confirm-panel')).toBeVisible();

    // A second drop has nowhere to go: exactly one confirm can be pending,
    // and overwriting the stashed file would silently replace what the user
    // is being asked about.
    await dropFiles(page, page.getByTestId('dropzone'), [
      zipSpec('sample.zip', buildSampleExport()),
    ]);
    await expect(page.getByTestId('confirm-panel')).toHaveCount(1);
    await expect(page.getByTestId('processing-status')).toHaveCount(0);
    // And the panel is still asking about the FIRST file.
    await expect(page.getByTestId('confirm-panel')).toContainText(CONFIRM_REPLACE_MESSAGE);

    await page.getByTestId('confirm-cancel').click();
    await expect(page.getByTestId('identity-nickname')).toHaveText(SAMPLE_NICKNAME);
    expect(await accountIdText(page)).toBe(formatAccountId(SAMPLE_ACCOUNT_ROOT));
  });

  test('(stray-drop) a drop outside the dropzone is prevented at the window and changes nothing', async ({
    page,
  }) => {
    const before = await page.getByTestId('import-bar').getAttribute('data-variant');

    // The guard is a window listener, so what matters is what an event
    // arriving at the window bubble phase looks like AFTER the page had its
    // chance to handle it.
    const observed = await page.evaluate(() => {
      const seen: boolean[] = [];
      const record = (event: Event) => seen.push(event.defaultPrevented);
      window.addEventListener('dragover', record);
      window.addEventListener('drop', record);
      const transfer = new DataTransfer();
      transfer.items.add(new File([new Uint8Array([1, 2, 3])], 'stray.zip'));
      for (const type of ['dragover', 'drop']) {
        document.body.dispatchEvent(
          new DragEvent(type, { dataTransfer: transfer, bubbles: true, cancelable: true }),
        );
      }
      window.removeEventListener('dragover', record);
      window.removeEventListener('drop', record);
      return seen;
    });

    // Without this, the browser navigates to the dropped file and the export
    // leaves the page entirely.
    expect(observed).toEqual([true, true]);
    await expect(page.getByTestId('failure-banner')).toHaveCount(0);
    expect(await page.getByTestId('import-bar').getAttribute('data-variant')).toBe(before);
  });

  test('(phone-375) at 375px the slim bar wraps without widening the page', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await importSampleAndWait(page);

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(375);

    // The meta row wraps, so the buttons may not sit on the imported-on
    // line -- but neither of them may run off the right edge.
    for (const testid of ['start-over', 'clear-data-control']) {
      const box = await page.getByTestId(testid).boundingBox();
      expect(box, `${testid} has no box`).not.toBeNull();
      expect(box!.x + box!.width).toBeLessThanOrEqual(375);
    }
  });
});

test.describe('cache check window (03-06 Task 3)', () => {
  test('(cache-check-window) the spinner block is the whole page while the check is in flight', async ({
    page,
  }) => {
    // The file-level beforeEach has already loaded the app once, so the
    // route is registered and the page reloaded here: the worker script is
    // fetched again by the fresh document, and this time it is held back.
    //
    // Only the RESPONSE is delayed. No request is added, which is what the
    // zero-network guarantee is about.
    let held = 0;
    await page.route('**/assets/ingest.worker-*.js', async (route) => {
      held += 1;
      await new Promise((resolve) => setTimeout(resolve, 800));
      await route.continue();
    });

    const navigation = page.goto('/');
    // Read the page while the worker script is still being held: the whole
    // point of D-28 is what is NOT on screen here.
    await expect(page.getByTestId('cache-check-status')).toBeVisible();
    expect(
      held,
      'the worker script was not held back, so the check window never happened',
    ).toBeGreaterThan(0);

    await expect(page.getByTestId('import-bar')).toHaveCount(0);
    await expect(page.getByTestId('identity-header')).toHaveCount(0);
    await expect(page.getByTestId('dashboard-nav')).toHaveCount(0);
    await expect(page.locator('[data-testid^="dashboard-section-"]')).toHaveCount(0);
    await expect(page.getByTestId('dropzone')).toHaveCount(0);

    // Once the worker answers, the page resolves to the first-visit state.
    await navigation;
    await expect(page.locator('main')).toHaveAttribute('data-worker-ready', 'true', {
      timeout: 10_000,
    });
    await expect(page.getByTestId('import-bar')).toHaveAttribute('data-variant', 'full');
    await expect(page.getByTestId('identity-header')).toBeVisible();
    await expect(page.getByTestId('dashboard-nav')).toBeVisible();
    // Five supported sections plus the block (05-03 D-01). Derived from the
    // id list so a future sixth section cannot leave this stale.
    await expect(page.locator('[data-testid^="dashboard-section-"]')).toHaveCount(
      SUPPORTED_IDS.length + 1,
    );
  });
});
