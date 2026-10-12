import '../_support/pin-locale';
import { expect, test } from '@playwright/test';
import {
  SYNTHETIC_ZIP_NAME,
  detailPane,
  gotoApp,
  importExport,
  listRow,
  openSection,
} from '../_support/helpers.ts';
import {
  SAMPLE_FILE_COUNTS,
  SAMPLE_ROW_COUNTS,
  buildCustomExport,
  buildSampleExport,
} from '../../fixtures/export-fixtures.ts';
import {
  DEVICE_ASSISTANT_EXPECTED_CELLS,
  DEVICE_FILE_NAMES,
  DEVICE_FLAGS_CANARY,
  DEVICE_INFO_COUNTS,
  DEVICE_PC_EXPECTED_CELLS,
  DEVICE_PC_ROWS,
  DEVICE_SPA_CANARY,
} from '../../fixtures/device-info-fixtures.ts';
import {
  DEVICE_HEADINGS,
  DEVICE_NOT_REPORTED,
  DEVICE_TABLE_NOT_IN_EXPORT,
  formatDeviceSourceCount,
  formatDeviceUnreadablePill,
  formatImportSummary,
  formatMemoryFromMb,
  formatProvenanceFrom,
  formatRowCount,
  formatRowSummary,
} from '../../../src/lib/ui-copy.ts';

// =============================================================================
// Quick 261012-bog - the Device info pane, in a real browser
// =============================================================================
//
// `tests/unit/import/device-info-worker.test.ts` proves the view the worker
// answers and `tests/unit/device-info/device-info-blocks.test.ts` proves what
// the components' source promises. Neither can prove that the block asks, that
// the answer reaches the screen, or that the page text holds neither canary.
// Vitest has no DOM, so the instrument is a browser.
//
// Every expected string is computed from the SAME fixtures and formatters the
// app uses. Two tests only (the listed budget is 258): the populated pane with
// its privacy sweep in one flow, and a pane with one file missing.
// =============================================================================

test.describe('Device info pane (quick 261012-bog)', () => {
  test('(populated) three ready tables, not-reported words, GB memory, the unreadable count and no canary', async ({
    page,
  }) => {
    await gotoApp(page);
    await importExport(page, SYNTHETIC_ZIP_NAME, buildSampleExport());

    // The list row and the Overview card say the same fact, from one derivation.
    const rows = formatRowCount(DEVICE_INFO_COUNTS.total);
    await expect(listRow(page, 'device-info')).toContainText(rows);
    await expect(listRow(page, 'device-info')).toContainText(
      formatRowSummary('Device_info', DEVICE_INFO_COUNTS.files),
    );
    await expect(page.getByTestId('ov-card-device-info')).toContainText(rows);

    await openSection(page, 'device-info');
    const section = page.getByTestId('dashboard-section-device-info');
    await expect(section).toHaveAttribute('data-status', 'ready');

    // The provenance counts are the derived sample counts.
    expect(SAMPLE_FILE_COUNTS.Device_info).toBe(DEVICE_INFO_COUNTS.files);
    expect(SAMPLE_ROW_COUNTS.Device_info).toBe(DEVICE_INFO_COUNTS.total);
    await expect(section.getByTestId('provenance')).toContainText(
      `${formatProvenanceFrom('Device_info')} ${formatImportSummary(
        SAMPLE_FILE_COUNTS.Device_info!,
        SAMPLE_ROW_COUNTS.Device_info!,
      )}`,
    );

    const block = page.getByTestId('device-info-block');
    await expect(block).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });

    // Three sources, in the fixed order, each ready.
    const sources = page.getByTestId('device-info-source');
    await expect(sources).toHaveCount(3);
    expect(
      await sources.evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-source'))),
    ).toEqual(['pc', 'blitz', 'assistant']);
    expect(
      await sources.evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-status'))),
    ).toEqual(['ready', 'ready', 'ready']);

    // The counts summary.
    await expect(page.getByTestId('device-info-summary-pc')).toHaveText(
      formatDeviceSourceCount('ready', DEVICE_INFO_COUNTS.pc, 0),
    );
    await expect(page.getByTestId('device-info-summary-assistant')).toHaveText(
      formatDeviceSourceCount('ready', DEVICE_INFO_COUNTS.assistant, DEVICE_INFO_COUNTS.unreadable),
    );

    // PC table: the fixture's rows, the muted N/D word, and memory as GB.
    const pc = sources.nth(0);
    await expect(pc.locator('tbody tr')).toHaveCount(DEVICE_PC_ROWS.length);
    const nulls = DEVICE_PC_EXPECTED_CELLS.flat().filter((cell) => cell === null).length;
    expect(nulls).toBeGreaterThan(0);
    await expect(pc.getByTestId('device-info-not-reported')).toHaveCount(nulls);
    await expect(pc.getByTestId('device-info-not-reported').first()).toHaveText(
      DEVICE_NOT_REPORTED,
    );
    // 4096 MB and 3000 MB in the first row, through the one formatter.
    await expect(pc.locator('tbody tr').first()).toContainText(formatMemoryFromMb(4096));
    await expect(pc.locator('tbody tr').first()).toContainText(formatMemoryFromMb(3000));
    expect(formatMemoryFromMb(4096)).toBe('4 GB');
    expect(formatMemoryFromMb(3000)).toBe('2.9 GB');

    // Assistant table: the four readable rows, the extracted fields, and the
    // unreadable notice carrying the fixture's count.
    const assistant = sources.nth(2);
    await expect(assistant.locator('tbody tr')).toHaveCount(DEVICE_ASSISTANT_EXPECTED_CELLS.length);
    for (const [index, cells] of DEVICE_ASSISTANT_EXPECTED_CELLS.entries()) {
      const row = assistant.locator('tbody tr').nth(index);
      for (const value of cells) {
        if (value !== null) await expect(row).toContainText(value);
      }
    }
    await expect(page.getByTestId('device-info-unreadable-assistant')).toContainText(
      formatDeviceUnreadablePill(DEVICE_INFO_COUNTS.unreadable),
    );

    // The privacy sweep over the whole detail text and every attribute: neither
    // canary, the key POST nor the text Spa id is anywhere on the page.
    const surface = async (): Promise<string> => {
      const content =
        (await detailPane(page).innerText()) + (await page.locator('body').innerText());
      const attributes = await page.evaluate(() =>
        Array.from(document.querySelectorAll('*'))
          .flatMap((el) => Array.from(el.attributes))
          .map((attr) => `${attr.name}=${attr.value}`)
          .join(' '),
      );
      return `${content} ${attributes}`;
    };
    const text = await surface();
    expect(text).not.toContain(DEVICE_SPA_CANARY);
    expect(text).not.toContain(DEVICE_FLAGS_CANARY);
    expect(text).not.toContain('POST');
    expect(text).not.toContain('Spa id');
    expect(text).not.toContain('PC configuration');
  });

  test('(one file missing) the absent source says Not in this export while the others stay ready', async ({
    page,
  }) => {
    await gotoApp(page);
    await importExport(
      page,
      SYNTHETIC_ZIP_NAME,
      buildCustomExport({ omitFiles: [`Device_info/${DEVICE_FILE_NAMES.blitz}`] }),
    );
    await openSection(page, 'device-info');
    await expect(page.getByTestId('device-info-block')).toHaveAttribute('data-state', 'ready', {
      timeout: 30_000,
    });

    const sources = page.getByTestId('device-info-source');
    await expect(sources).toHaveCount(3);
    const blitz = sources.nth(1);
    await expect(blitz).toHaveAttribute('data-source', 'blitz');
    await expect(blitz).toHaveAttribute('data-status', 'not-in-export');
    await expect(blitz).toContainText(DEVICE_HEADINGS.blitz);
    await expect(blitz).toContainText(DEVICE_TABLE_NOT_IN_EXPORT);
    await expect(blitz.getByTestId('device-info-table')).toHaveCount(0);

    await expect(sources.nth(0)).toHaveAttribute('data-status', 'ready');
    await expect(sources.nth(2)).toHaveAttribute('data-status', 'ready');

    // The summary row for the absent source.
    await expect(page.getByTestId('device-info-summary-blitz')).toHaveText(
      formatDeviceSourceCount('not-in-export', 0, 0),
    );
    expect(formatDeviceSourceCount('not-in-export', 0, 0)).toBe('not in this export');
  });
});
