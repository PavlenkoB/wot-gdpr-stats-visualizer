import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { componentPath } from '../../helpers/components.ts';

// =============================================================================
// Quick 261012-bog Task 2 — the Device info component contracts, by source
// =============================================================================
//
// Vitest has no DOM here, so these assert what each component's SOURCE promises,
// the way `tests/unit/finance/spend-blocks.test.ts` does. Every test asserts the
// file EXISTS first, because an empty string contains no forbidden token and
// would pass vacuously.
// =============================================================================

const BLOCK_FILE = 'DeviceInfo.svelte';
const TABLE_FILE = 'DeviceTable.svelte';

function code(filename: string): string {
  return readFileSync(componentPath(filename), 'utf8');
}

/** Strip comments, so a comment that explains a rule cannot trip the rule. */
function stripComments(source: string): string {
  return source
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*/gm, '');
}

/** The markup between the script and the style, where text and attributes live. */
function markup(source: string): string {
  return source.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '');
}

describe('DeviceInfo.svelte contract', () => {
  it('exists and asks the device-info channel through the passed client', () => {
    expect(existsSync(componentPath(BLOCK_FILE))).toBe(true);
    const clean = stripComments(code(BLOCK_FILE));

    expect(clean).toContain("client.query({ channel: 'device-info' })");
    expect(clean).toContain('deriveFinanceState({ importedAt, shown })');
    expect(clean).toContain("acceptDataOutcome(outcome, 'device-info', wanted, importedAt)");
    expect(clean).toContain("from '../finance/finance-state.ts'");
    expect(clean).toContain('ShownBlock');
  });

  it('carries the block, summary and per-source summary hooks', () => {
    const clean = stripComments(code(BLOCK_FILE));
    expect(clean).toContain('data-testid="device-info-block"');
    expect(clean).toContain('data-testid="device-info-summary"');
    expect(clean).toContain('data-testid="device-info-summary-{source.id}"');
    expect(clean).toContain('data-state={blockState}');
    // It mounts one DeviceTable per source in the fixed order.
    expect(clean).toContain('DeviceTable');
    expect(clean).toContain('DEVICE_SOURCES');
  });

  it('is busy only while loading, errors as an alert and loads as a status', () => {
    const clean = stripComments(code(BLOCK_FILE));
    expect(clean).toContain("aria-busy={blockState === 'loading' ? 'true' : 'false'}");
    expect(clean).toContain('role="alert"');
    expect(clean).toContain('role="status"');
    expect(clean).not.toContain('aria-live');
    // The worker's detail is never read: the fixed sentence is the only text.
    expect(clean).toContain('DEVICE_INFO_ERROR');
    expect(clean).not.toContain('.detail');
  });

  it('takes every sentence from ui-copy', () => {
    const clean = stripComments(code(BLOCK_FILE));
    expect(clean).toMatch(/from '\.\.\/\.\.\/ui-copy\.ts'/);
    for (const name of [
      'DEVICE_INFO_LOADING',
      'DEVICE_INFO_ERROR',
      'DEVICE_INFO_INTRO',
      'DEVICE_SUMMARY_HEADING',
      'DEVICE_MEMORY_NOTE',
      'DEVICE_HEADINGS',
      'formatDeviceSourceCount',
    ]) {
      expect(clean).toContain(name);
    }
    // No sentence literal in the markup: every visible string is an
    // interpolation of a ui-copy export.
    expect(markup(clean)).not.toMatch(/>[^<>{]*[A-Za-z]{4,}[^<>{]*</);
  });
});

describe('DeviceTable.svelte contract', () => {
  it('exists and renders the per-source section with a status attribute', () => {
    expect(existsSync(componentPath(TABLE_FILE))).toBe(true);
    const clean = stripComments(code(TABLE_FILE));
    expect(clean).toContain('data-testid="device-info-source"');
    expect(clean).toContain('data-source={source}');
    expect(clean).toContain('data-status={table.status}');
    for (const hook of ['device-info-table', 'device-info-scroller', 'device-info-not-reported']) {
      expect(clean).toContain(`data-testid="${hook}"`);
    }
  });

  it('renders the not-reported word from ui-copy and the shared notice per source', () => {
    const clean = stripComments(code(TABLE_FILE));
    expect(clean).toContain('DEVICE_NOT_REPORTED');
    expect(clean).toContain('formatMemoryFromMb');
    expect(clean).toContain("import ExcludedNotice from '../../shell/ExcludedNotice.svelte'");
    expect(clean).toContain('testId="device-info-unreadable-{source}"');
    expect(clean).toContain('DEVICE_UNREADABLE_EXPLANATION');
    // The blob-specific explanation is shown for the Assistant source only
    // when no row could be read (PD-08).
    expect(clean).toContain("{#if source === 'assistant'}");
    expect(clean).toContain('DEVICE_TABLE_NOT_IN_EXPORT');
    expect(clean).toContain('formatDeviceNoRows');
    expect(clean).toContain('formatDeviceNoUsable');
    expect(clean).toContain('formatDeviceMoreRows');
  });

  it('draws the table in a named, focusable scroll region with a visually hidden caption', () => {
    const clean = stripComments(code(TABLE_FILE));
    expect(clean).toContain('role="region"');
    expect(clean).toContain('tabindex="0"');
    expect(clean).toContain('aria-label={tableLabel}');
    expect(clean).toContain('<caption class="visually-hidden">{tableLabel}</caption>');
    expect(clean).toContain('formatDeviceTableLabel');
    // Header cells scope their column.
    expect(clean).toContain('scope="col"');
    expect(markup(clean)).not.toMatch(/>[^<>{]*[A-Za-z]{4,}[^<>{]*</);
  });
});

describe('both components obey the project prohibitions', () => {
  for (const file of [BLOCK_FILE, TABLE_FILE]) {
    it(`${file} has no raw-HTML interpolation, no inline style and only scale font sizes`, () => {
      expect(existsSync(componentPath(file))).toBe(true);
      const source = code(file);
      const clean = stripComments(source);

      expect(clean).not.toContain('{@html');
      // No style attribute on an element (the <style> block is a different thing).
      expect(markup(clean)).not.toMatch(/\sstyle\s*=/);
      expect(markup(clean)).not.toMatch(/\sstyle:/);
      // Every font size is on the 14/18/26/30 scale.
      const sizes = [...clean.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)].map((m) => m[1]);
      for (const size of sizes) expect(['14', '18', '26', '30']).toContain(size);
      // No network API.
      for (const banned of ['fetch(', 'XMLHttpRequest', 'WebSocket', 'sendBeacon', 'EventSource']) {
        expect(clean).not.toContain(banned);
      }
    });

    it(`${file} uses no colour literal outside the three status literals`, () => {
      const clean = stripComments(code(file));
      const literals = [...clean.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => m[0].toLowerCase());
      for (const literal of literals) {
        expect(['#c5221f', '#fce8e6', '#8a1c17']).toContain(literal);
      }
      expect(clean).not.toMatch(/\brgba?\(/);
      expect(clean).not.toMatch(/\bhsla?\(/);
    });
  }

  it('the table file declares no colour literal at all', () => {
    expect(stripComments(code(TABLE_FILE))).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});

describe('Dashboard.svelte mounts the Device info pane', () => {
  it('imports DeviceInfo and renders it behind the device-info branch with the data client', () => {
    const dashboard = stripComments(readFileSync(componentPath('Dashboard.svelte'), 'utf8'));
    expect(dashboard).toContain(
      "import DeviceInfo from '../features/device-info/DeviceInfo.svelte'",
    );
    expect(dashboard).toContain("active === 'device-info'");
    expect(dashboard).toContain("sectionProps('device-info', 'device-info')");
    expect(dashboard).toContain('<DeviceInfo {result} client={ingestClient.data} />');
  });
});
