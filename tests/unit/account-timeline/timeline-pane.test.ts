import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { componentPath } from '../../helpers/components.ts';

// =============================================================================
// Plan 12-12 Task 3 - the Account timeline pane, asserted by what its SOURCE promises
// =============================================================================
//
// Vitest has no DOM here, so the pane, its two children and the Dashboard wiring
// are read as text, in the style of `perks-pane.test.ts`. Every read asserts the
// file EXISTS first, because an empty string contains no forbidden token and
// would pass vacuously. The rendered half (the chip row, the windowed table, the
// mask, the 375px overflow, no value in any attribute) is proved in the browser by
// plan 12-13.
// =============================================================================

const PANE = 'AccountTimelinePane.svelte';
const FILTER = 'TimelineKindFilter.svelte';
const TABLE = 'TimelineTable.svelte';
const DASHBOARD = 'Dashboard.svelte';

/** Strip comments, so a comment that explains a rule cannot trip the rule. */
function stripComments(source: string): string {
  return source
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*/gm, '');
}

/** The comment-free source of a component that must exist. */
function clean(filename: string): string {
  expect(existsSync(componentPath(filename)), `${filename} exists`).toBe(true);
  return stripComments(readFileSync(componentPath(filename), 'utf8'));
}

/** The markup between the script and the style, where text and attributes live. */
function markup(source: string): string {
  return source.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '');
}

describe('AccountTimelinePane: the query and the stamped answer', () => {
  const pane = clean(PANE);

  it("asks the 'account-timeline' channel and accepts with the same channel", () => {
    expect(pane).toContain("channel: 'account-timeline'");
    expect(pane).toMatch(/acceptDataOutcome\(outcome, 'account-timeline', wanted, importedAt\)/);
  });

  it('keeps the applied answer in one stamped raw cell', () => {
    expect(pane).toMatch(/\$state\.raw<ShownBlock<TimelineView> \| null>\(null\)/);
    expect(pane).toMatch(/deriveFinanceState\(\{ importedAt, shown \}\)/);
    expect(pane).toMatch(/shown\.importedAt === importedAt/);
  });

  it('adds no reveal state of its own: the shell owns it', () => {
    expect(pane).toMatch(/\{ result, client, revealed, onRevealChange \}: Props/);
    expect(pane).not.toMatch(/\$state\(\s*(false|true)\s*\)/);
  });

  it('carries every test id of the pane', () => {
    for (const id of [
      'account-timeline-block',
      'timeline-showing',
      'timeline-file-state',
      'timeline-merge-note',
      'timeline-mask-toggle',
      'timeline-mask-caption',
      'about-account-timeline',
    ]) {
      expect(pane, id).toContain(id);
    }
  });
});

describe('the pane and its children: one live region and the fixed sentences', () => {
  const pane = clean(PANE);
  const sources = [pane, clean(FILTER), clean(TABLE)];

  it('has exactly one explicit aria-live across the three components, on the showing line', () => {
    const total = sources.reduce((n, s) => n + (s.match(/aria-live/g) ?? []).length, 0);
    expect(total).toBe(1);
    expect(pane.match(/role="status"/g) ?? []).toHaveLength(1);
    const status = /<p[^>]*data-testid="timeline-showing"[^>]*>/s.exec(pane);
    expect(status, 'the showing paragraph').not.toBeNull();
    expect(status![0]).toContain('aria-live="polite"');
  });

  it('shows the loading sentence and the showing sentence in that one element', () => {
    expect(pane).toContain('TIMELINE_LOADING');
    expect(pane).toMatch(/formatTimelineShowing\(filtered\.length, entries\.length\)/);
    expect(pane).toContain('<span class="visually-hidden">{announcement}</span>');
  });

  it('renders the error as a role=alert holding only the fixed TIMELINE_ERROR', () => {
    const alert = /<p[^>]*role="alert"[^>]*>([^<]*)<\/p>/.exec(markup(pane));
    expect(alert, 'an alert paragraph').not.toBeNull();
    expect(alert![1]!.trim()).toBe('{TIMELINE_ERROR}');
  });
});

describe('AccountTimelinePane: the mask', () => {
  const pane = clean(PANE);

  it('gates the toggle on hasMaskableEntries', () => {
    expect(pane).toMatch(/hasMaskableEntries\(entries\)/);
    expect(pane).toMatch(/\{#if canReveal\}/);
  });

  it('uses the IP-only MASK copy and not the PERKS_MASK set', () => {
    for (const name of [
      'MASK_TOGGLE_SHOW',
      'MASK_TOGGLE_HIDE',
      'MASK_CAPTION_MASKED',
      'MASK_CAPTION_REVEALED',
      'MASK_ANNOUNCE_SHOWN',
      'MASK_ANNOUNCE_MASKED',
    ]) {
      expect(pane, name).toContain(name);
    }
    expect(pane).not.toContain('PERKS_MASK');
  });

  it('drives the shell reveal from the next value', () => {
    expect(pane).toMatch(/const next = !revealed;\s*onRevealChange\(next\);/);
  });
});

describe('AccountTimelinePane: the kind filter (T-12-40)', () => {
  const pane = clean(PANE);

  it('gates the chip row on showKindFilter and resolves the choice with the dataset stamp', () => {
    expect(pane).toMatch(/\{#if showKindFilter\(present\)\}/);
    expect(pane).toMatch(/resolveKindFilter\(choice, importedAt, present\)/);
    expect(pane).toMatch(/choice = \{ kind: next, stamp: importedAt \}/);
  });

  it('issues no query on a chip change and writes to no route, storage or URL', () => {
    expect(pane.match(/client\.query\(/g) ?? []).toHaveLength(1);
    for (const source of [pane, clean(FILTER), clean(TABLE)]) {
      expect(source).not.toMatch(/localStorage|sessionStorage|indexedDB|history\.|location\./);
      expect(source).not.toMatch(/router|navigate\(|goto\(/i);
    }
  });
});

describe('the timeline components: the table and the chip row', () => {
  const table = clean(TABLE);
  const filter = clean(FILTER);

  it('carries the test ids', () => {
    expect(filter).toContain('timeline-kind-filter');
    expect(filter).toContain('timeline-kind-chip-all');
    expect(filter).toContain('timeline-kind-chip-');
    expect(table).toContain('timeline-table');
    expect(table).toContain('timeline-kind-badge');
    expect(table).toContain('data-kind={entry.kind}');
  });

  it('windows through the shared decisions and draws every part through the one formatter', () => {
    expect(table).toContain('shouldWindow(entries.length)');
    expect(table).toContain('windowRange(scrollTop, SCROLLER_MAX_PX, entries.length)');
    expect(table).toContain('formatNewDataCell');
    expect(table).toContain('accountChipsOf');
  });

  it('keys every each by position', () => {
    for (const source of [clean(PANE), table, filter]) {
      const keys = [...source.matchAll(/\{#each [^}]*\(([^)]*)\)\}/g)].map((m) => m[1]);
      for (const key of keys) {
        expect(key, 'a position key').toMatch(/^(rowIndex|tagIndex|partIndex|index|lineIndex)$/);
      }
    }
  });

  it('has a windowed table with no more-rows line and no per-row SVG', () => {
    expect(table).not.toMatch(/<svg|formatDeviceMoreRows/);
  });
});

describe('the timeline components: nothing untrusted reaches an attribute', () => {
  const all = [PANE, FILTER, TABLE].map((name) => ({ name, source: clean(name) }));

  it('has no title attribute, no value-bearing aria-label and no raw HTML', () => {
    for (const { name, source } of all) {
      const body = markup(source);
      expect(body, name).not.toMatch(/<[a-z][^>]*\stitle=/);
      expect(body, name).not.toMatch(/\{@html/);
      // The one aria-label is the table region's: the constant formatter, never a value.
      const labels = [...body.matchAll(/\saria-label=(\{[^}]*\}|"[^"]*")/g)].map((m) => m[1]);
      for (const label of labels) expect(label, name).toBe('{regionName}');
    }
  });

  it('puts only fixed words in data attributes', () => {
    for (const { name, source } of all) {
      const attrs = [...markup(source).matchAll(/\sdata-([a-z-]+)=/g)].map((m) => m[1]);
      for (const attr of attrs) {
        expect(['testid', 'state', 'masked', 'status', 'kind'], `${name} data-${attr}`).toContain(
          attr,
        );
      }
    }
  });

  it('declares no media query, transition, animation or custom property', () => {
    for (const { name, source } of all) {
      expect(source, name).not.toMatch(/@media/);
      expect(source, name).not.toMatch(/transition|animation/);
      expect(source, name).not.toMatch(/--[a-z-]+\s*:/);
    }
  });

  it('imports nothing from the login aggregates beyond the shared chip helper', () => {
    for (const { name, source } of all) {
      const imports = [...source.matchAll(/from '([^']*)'/g)].map((m) => m[1]!);
      for (const spec of imports.filter((s) => /logins?\//.test(s))) {
        expect(spec, name).toBe('../logins/login-model.ts');
      }
      expect(source, name).not.toMatch(/geo\//);
    }
  });
});

describe('Dashboard: the account-timeline branch', () => {
  const dashboard = clean(DASHBOARD);

  it('mounts AccountTimelinePane with the shell reveal and the channel-scoped client', () => {
    expect(dashboard).toContain(
      "import AccountTimelinePane from '../features/account-timeline/AccountTimelinePane.svelte'",
    );
    expect(dashboard).toContain("{:else if active === 'account-timeline'}");
    expect(dashboard).toContain("newDataSectionProps('account-timeline')");
    expect(dashboard).toMatch(
      /<AccountTimelinePane\s+\{result\}\s+client=\{ingestClient\.data\}\s+\{revealed\}\s+onRevealChange=\{setRevealed\}\s*\/>/,
    );
  });

  it('passes no gameFilter to AccountTimelinePane', () => {
    const mount = /<AccountTimelinePane\b[^>]*>/s.exec(dashboard);
    expect(mount, 'an AccountTimelinePane mount').not.toBeNull();
    expect(mount![0]).not.toContain('gameFilter');
  });
});
