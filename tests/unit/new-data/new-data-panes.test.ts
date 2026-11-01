import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { componentPath, SCALE_PX } from '../../helpers/components.ts';
import { effectiveFontSizes, ruleDeclarations, styleText, tokenMap } from '../../helpers/css.ts';
import { readTokenSource, TYPE_CSS } from '../../helpers/styles.ts';

// =============================================================================
// Plan 11-09 - the two new-game panes and their shell wiring
// =============================================================================
//
// Vitest has no DOM here, so the shell and the panes are asserted by what their
// SOURCE promises, in the style of `new-data-blocks.test.ts` and
// `tests/unit/device-info/device-info-blocks.test.ts`. Every test asserts the
// file EXISTS first, because an empty string contains no forbidden token and
// would pass vacuously. The rendered half (masked addresses in the browser, the
// Logins totals, the 375px layout) is plan 11-11's.
//
// PHASE 14, PLAN 14-17: the panes' sizes are TOKENS now, so the font-size
// sweep resolves them before it reads them. Without the resolution the sweep
// would match nothing and would pass on nothing - the non-empty check below is
// what keeps it honest.
// =============================================================================

const HEAT_FILE = 'HeatPane.svelte';
const WOWS_FILE = 'WarshipsStoragePane.svelte';

/** The pane files the shared rules below apply to. */
const PANE_FILES: readonly string[] = [HEAT_FILE, WOWS_FILE];

/**
 * The token declarations, so a px assertion can be resolved back to pixels.
 *
 * The panes' sizes are TOKENS now (Phase 14, D-01). A reader that matched
 * `font-size: Npx` in the source finds NOTHING once the sizes are tokenised,
 * and a loop over an empty array asserts nothing - a vacuous pass.
 */
const TOKENS = tokenMap(readTokenSource());

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

/** The comment-free source of a component that must exist. */
function clean(filename: string): string {
  expect(existsSync(componentPath(filename)), `${filename} exists`).toBe(true);
  return stripComments(readFileSync(componentPath(filename), 'utf8'));
}

const SECTION_PATH = 'src/lib/shell/DashboardSection.svelte';
const DASHBOARD_PATH = 'src/lib/shell/Dashboard.svelte';

function shellSource(path: string): string {
  expect(existsSync(path), `${path} exists`).toBe(true);
  return stripComments(readFileSync(path, 'utf8'));
}

// -----------------------------------------------------------------------------
// The section shell: provenanceLabel
// -----------------------------------------------------------------------------

describe('DashboardSection.svelte provenanceLabel', () => {
  it('takes an optional provenanceLabel that wins over folder and title', () => {
    const source = shellSource(SECTION_PATH);
    expect(source).toContain('provenanceLabel?: string;');
    expect(source).toContain('const source = $derived(provenanceLabel ?? folder ?? title);');
  });

  it('keeps the whitespace-sensitive provenance block flush (the caption carries the note role)', () => {
    // The caption is the FIRST child, flush against the From span, so a
    // one-account pane has no leading whitespace text node.
    const raw = readFileSync(SECTION_PATH, 'utf8');
    expect(raw).toContain(
      '{#if combinedCaption !== null}<p\n' +
        '          class="combined t-note-strong"\n' +
        '          data-testid="combined-caption"\n' +
        '        >\n' +
        '          {combinedCaption}\n' +
        '        </p>{/if}<span class="from">{formatProvenanceFrom(source)}</span>',
    );
  });
});

// -----------------------------------------------------------------------------
// The shell: two branches, their props, no game filter
// -----------------------------------------------------------------------------

describe('Dashboard.svelte mounts the two optional panes', () => {
  const source = shellSource(DASHBOARD_PATH);

  it('imports both panes and the provenance labels', () => {
    expect(source).toContain("import HeatPane from '../features/new-data/HeatPane.svelte';");
    expect(source).toContain(
      "import WarshipsStoragePane from '../features/new-data/WarshipsStoragePane.svelte';",
    );
    expect(source).toContain('NEW_DATA_PROVENANCE_LABELS');
  });

  it('has a branch for each pane id, between device-info and account', () => {
    const device = source.indexOf("{:else if active === 'device-info'}");
    const heat = source.indexOf("{:else if active === 'heat'}");
    const wows = source.indexOf("{:else if active === 'warships-storage'}");
    const account = source.indexOf("{:else if active === 'account'}");
    expect(device).toBeGreaterThan(-1);
    expect(heat).toBeGreaterThan(device);
    expect(wows).toBeGreaterThan(heat);
    expect(account).toBeGreaterThan(wows);
  });

  it('builds the section props from result.newDataPanes, with the pane label and no folder', () => {
    expect(source).toContain('function newDataSectionProps(pane: NewDataPaneId)');
    expect(source).toContain('result?.newDataPanes?.[pane]');
    expect(source).toContain('id: pane,');
    expect(source).toContain('title: PANE_TITLES[pane],');
    expect(source).toContain('provenanceLabel: NEW_DATA_PROVENANCE_LABELS[pane],');
    expect(source).toContain("facts === undefined ? ('no-export' as const) : ('ready' as const)");
    expect(source).toContain(
      '{ fileCount: facts.fileCount, rowCount: facts.rowCount, skippedRowCount: 0 }',
    );
    expect(source).toContain('accountCount: accountCountOf(result),');
  });

  it('spreads the props into DashboardSection for each pane', () => {
    expect(source).toContain("<DashboardSection {...newDataSectionProps('heat')}>");
    expect(source).toContain("<DashboardSection {...newDataSectionProps('warships-storage')}>");
  });

  it('passes the HEAT pane the client and the shell reveal, and the Warships pane the client only', () => {
    expect(source).toContain(
      '<HeatPane {result} client={ingestClient.data} {revealed} onRevealChange={setRevealed} />',
    );
    expect(source).toContain('<WarshipsStoragePane {result} client={ingestClient.data} />');
  });

  it('passes neither pane the game filter (D-07)', () => {
    for (const tag of ['HeatPane', 'WarshipsStoragePane']) {
      const match = new RegExp(`<${tag}\\b[^>]*>`, 's').exec(source);
      expect(match, `<${tag}> is mounted`).not.toBeNull();
      expect(match![0]).not.toContain('gameFilter');
      expect(match![0]).not.toContain('onGameFilterChange');
    }
  });
});

// -----------------------------------------------------------------------------
// The prohibitions both panes obey
// -----------------------------------------------------------------------------

describe('the new-game panes obey the project prohibitions', () => {
  for (const file of PANE_FILES) {
    it(`${file} has no raw HTML, inline style, svg, media query, animation, console, storage or network`, () => {
      const source = clean(file);
      const html = markup(source);

      expect(source).not.toContain('{@html');
      expect(html).not.toMatch(/\sstyle\s*=/);
      expect(html).not.toMatch(/\sstyle:/);
      expect(html).not.toContain('<svg');
      expect(source).not.toContain('@media');
      expect(source).not.toMatch(/\b(transition|animation|@keyframes)\b/);
      expect(source).not.toMatch(/\bconsole\./);
      for (const banned of [
        'fetch(',
        'XMLHttpRequest',
        'WebSocket',
        'sendBeacon',
        'EventSource',
        'localStorage',
        'sessionStorage',
        'indexedDB',
        'document.cookie',
      ]) {
        expect(source).not.toContain(banned);
      }
    });

    it(`${file} uses only scale font sizes`, () => {
      // The sizes are TOKENS and note ROLES now, so the tokens are resolved and
      // the role classes in the markup are counted too: the match would otherwise
      // be empty and the sweep would assert nothing.
      const sizes = effectiveFontSizes(clean(file), TOKENS, readFileSync(TYPE_CSS, 'utf8'));
      expect(sizes.length, `${file} declares at least one font-size`).toBeGreaterThan(0);
      for (const size of sizes) expect(SCALE_PX.has(size)).toBe(true);
    });

    it(`${file} never takes the game filter and never reaches the login aggregates (D-04, D-07)`, () => {
      const source = clean(file);
      expect(source).not.toContain('gameFilter');
      expect(source).not.toContain('onGameFilterChange');
      expect(source).not.toMatch(/logins/i);
      expect(source).not.toMatch(/from '[^']*\/(logins|geo)\//);
    });

    it(`${file} labels nothing from a cell and builds no attribute from data`, () => {
      const html = markup(clean(file));
      // A title attribute on a plain element would carry text to a tooltip; the
      // card's `title` PROP is a component prop and starts with an uppercase tag.
      expect(html).not.toMatch(/<[a-z][^>]*\stitle\s*=/);
      expect(html).not.toMatch(/data-testid=\{/);
      expect(html).not.toMatch(/data-testid="[^"]*\{/);
    });

    it(`${file} owns exactly one explicit aria-live attribute, on its role=status line`, () => {
      const html = markup(clean(file));
      expect([...html.matchAll(/\baria-live=/g)]).toHaveLength(1);
      expect([...html.matchAll(/role="status"/g)]).toHaveLength(1);
      expect(html).toMatch(/<p[^>]*role="status"[^>]*aria-live="polite"/s);
    });

    it(`${file} shows a fixed error sentence in a role=alert element with no live attribute (T-11-31)`, () => {
      const html = markup(clean(file));
      const alerts = [...html.matchAll(/<p[^>]*role="alert"[^>]*>([^<]*)<\/p>/g)];
      expect(alerts).toHaveLength(1);
      expect(alerts[0]![0]).not.toContain('aria-live');
      // The text is one constant and nothing else.
      expect(alerts[0]![1]!.trim()).toMatch(/^\{[A-Z_]+_ERROR\}$/);
    });
  }
});

// -----------------------------------------------------------------------------
// The shared load, accept and state rules (both panes)
// -----------------------------------------------------------------------------

describe('both panes follow the Device info load rules (T-11-32)', () => {
  const cases = [
    { file: HEAT_FILE, channel: 'heat', view: 'HeatView' },
    { file: WOWS_FILE, channel: 'warships-storage', view: 'WarshipsStorageView' },
  ];
  for (const { file, channel, view } of cases) {
    it(`${file} asks only its own ${channel} channel and stamps the answer with importedAt`, () => {
      const source = clean(file);
      expect(source).toContain(`client.query({ channel: '${channel}' })`);
      expect([...source.matchAll(/client\.query\(/g)]).toHaveLength(1);
      expect(source).toContain(`acceptDataOutcome(outcome, '${channel}', wanted, importedAt)`);
      expect(source).toContain('deriveFinanceState({ importedAt, shown })');
      expect(source).toContain(`$state.raw<ShownBlock<${view}> | null>(null)`);
      expect(source).toContain('shown.importedAt === importedAt');
    });

    it(`${file} clears its alive flag on teardown and queries inside untrack`, () => {
      const source = clean(file);
      expect(source).toMatch(/onMount\(\(\) => \{\s*return \(\) => \{\s*alive = false;/);
      expect(source).toContain('if (!alive) return;');
      expect(source).toMatch(/untrack\(\(\) => \{[\s\S]*void load\(wanted\);/);
      // The effect depends on the dataset stamp and nothing else.
      expect(source).toContain('const wanted = importedAt;');
    });

    it(`${file} has the root test id, data-state and aria-busy`, () => {
      const html = markup(clean(file));
      expect(html).toContain('data-state={blockState}');
      expect(html).toContain("aria-busy={blockState === 'loading' ? 'true' : 'false'}");
    });

    it(`${file} orders rows by account and takes the tags from accountTagsFor`, () => {
      const source = clean(file);
      expect(source).toContain('const tags = $derived(accountTagsFor(result));');
      expect(source).toContain('orderRowsByAccount(card.rows, tags)');
      expect(source).toContain('{tags}');
    });
  }
});

// -----------------------------------------------------------------------------
// HeatPane.svelte
// -----------------------------------------------------------------------------

describe('HeatPane.svelte contract', () => {
  it('puts the strong note role on the mask toggle and leaves the type to the role', () => {
    const html = markup(clean(HEAT_FILE));
    expect(html).toMatch(
      /<button\s+type="button"\s+class="t-note-strong"\s+data-testid="heat-mask-toggle"/,
    );
    const rule = ruleDeclarations(styleText(clean(HEAT_FILE)), 'button');
    expect(rule, 'a rule for button').not.toBe('');
    expect(rule).not.toMatch(/font-(size|weight)|line-height/);
  });

  it('shows the loading sentence in the status line and a fixed error sentence', () => {
    const source = clean(HEAT_FILE);
    expect(source).toContain("blockState === 'loading' ? HEAT_LOADING : announcement");
    expect(markup(source)).toContain('role="alert">{HEAT_ERROR}</p>');
  });

  it('renders the intro, then four cards in the specified order with their test ids', () => {
    const source = clean(HEAT_FILE);
    const html = markup(source);
    expect(html.indexOf('{HEAT_INTRO}')).toBeGreaterThan(-1);
    expect(html.indexOf('{HEAT_INTRO}')).toBeLessThan(html.indexOf('<NewDataCard'));
    expect(html).toContain('{#each HEAT_CARD_IDS as id (id)}');
    expect(source).toMatch(
      /accountStats: 'heat-card-account-stats',\s*battleTypes: 'heat-card-battle-types',\s*storage: 'heat-card-storage',\s*geolocation: 'heat-card-geolocation',/,
    );
    expect(html).toContain('title={HEAT_CARD_TITLES[id]}');
    expect(html).toContain('NEW_DATA_FILE_LABELS[HEAT_CARD_FILES[id]]');
    expect(html).toContain("layout={id === 'accountStats' ? 'blocks' : 'table'}");
    expect(html).toContain('fileKey={HEAT_CARD_FILES[id]}');
    expect(html).toContain(
      "battleTypeColumnId={id === 'battleTypes' ? HEAT_BATTLE_TYPE_COLUMN_ID : null}",
    );
  });

  it('passes the geolocation card a header snippet and no other card', () => {
    const html = markup(clean(HEAT_FILE));
    expect(html).toContain("header={id === 'geolocation' ? geoHeader : undefined}");
    expect(html).toContain('{#snippet geoHeader()}');
    expect(html).toContain('{HEAT_GEO_NOTE}');
  });

  it('shows the toggle only for a ready geolocation card with an address column and rows', () => {
    const source = clean(HEAT_FILE);
    expect(source).toContain("card.status === 'ready'");
    expect(source).toContain('card.rows.length > 0');
    expect(source).toContain("card.columns.some((column) => column.kind === 'address')");
    expect(markup(source)).toContain('{#if canReveal}');
  });

  it('has a heat-mask-toggle button that swaps its label, carries data-masked and no aria-pressed', () => {
    const html = markup(clean(HEAT_FILE));
    expect(html).toContain('data-testid="heat-mask-toggle"');
    expect(html).toContain("data-masked={revealed ? 'false' : 'true'}");
    expect(html).toContain('{revealed ? MASK_TOGGLE_HIDE : MASK_TOGGLE_SHOW}');
    expect(html).toContain('{revealed ? MASK_CAPTION_REVEALED : MASK_CAPTION_MASKED}');
    expect(html).not.toContain('aria-pressed');
    expect(html).toContain('type="button"');
  });

  it('drives the shell reveal and announces state words from the NEXT value', () => {
    const source = clean(HEAT_FILE);
    expect(source).toContain('const next = !revealed;');
    expect(source).toContain('onRevealChange(next);');
    expect(source).toContain('announcement = next ? MASK_ANNOUNCE_SHOWN : MASK_ANNOUNCE_MASKED;');
    // The pane owns no reveal state of its own.
    expect(source).not.toMatch(/let revealed\b/);
    expect([...markup(source).matchAll(/\son[a-z]+=/g)].map((m) => m[0].trim())).toEqual([
      'onclick=',
    ]);
  });

  it('clears the announcement with the dataset and never puts an address in the live region', () => {
    const source = clean(HEAT_FILE);
    expect(source).toMatch(/untrack\(\(\) => \{[^]*?announcement = '';[^]*?void load\(wanted\);/);
    // The only values written to the live region are the two state words.
    const writes = [...source.matchAll(/^\s*announcement = ([^;]+);/gm)].map((m) => m[1]);
    expect(writes).toEqual(["''", 'next ? MASK_ANNOUNCE_SHOWN : MASK_ANNOUNCE_MASKED']);
  });
});

// -----------------------------------------------------------------------------
// WarshipsStoragePane.svelte
// -----------------------------------------------------------------------------

describe('WarshipsStoragePane.svelte contract', () => {
  it('the two panes have distinct root test ids', () => {
    const heat = clean(HEAT_FILE);
    const wows = clean(WOWS_FILE);
    expect(heat).toContain('data-testid="heat-block"');
    expect(wows).toContain('data-testid="warships-storage-block"');
    expect(heat).not.toContain('warships-storage-block');
    expect(wows).not.toContain('heat-block');
  });

  it('shows the loading sentence in its only status line and a fixed error sentence', () => {
    const source = clean(WOWS_FILE);
    expect(source).toContain("blockState === 'loading' ? WOWS_STORAGE_LOADING : ''");
    expect(markup(source)).toContain('role="alert">{WOWS_STORAGE_ERROR}</p>');
  });

  it('renders the intro, then two cards crews and storage with their test ids', () => {
    const source = clean(WOWS_FILE);
    const html = markup(source);
    expect(html.indexOf('{WOWS_STORAGE_INTRO}')).toBeGreaterThan(-1);
    expect(html.indexOf('{WOWS_STORAGE_INTRO}')).toBeLessThan(html.indexOf('<NewDataCard'));
    expect(html).toContain('{#each WOWS_CARD_IDS as id (id)}');
    expect(source).toMatch(/crews: 'wows-card-crews',\s*storage: 'wows-card-storage',/);
    expect(html).toContain('title={WOWS_STORAGE_CARD_TITLES[id]}');
    expect(html).toContain('NEW_DATA_FILE_LABELS[WOWS_CARD_FILES[id]]');
    expect(html).toContain('layout="table"');
    expect(html).toContain('fileKey={WOWS_CARD_FILES[id]}');
  });

  it('takes no reveal, renders no mask control and passes every card a masked reveal', () => {
    const source = clean(WOWS_FILE);
    const html = markup(source);
    expect(source).not.toContain('onRevealChange');
    expect(source).not.toMatch(/\brevealed\b(?!=\{false\})/);
    expect(html).toContain('revealed={false}');
    expect(html).not.toContain('<button');
    expect(html).not.toContain('mask-toggle');
    expect([...html.matchAll(/\son[a-z]+=/g)]).toHaveLength(0);
  });

  it('keeps a comment where a later address column would notice the safe failure', () => {
    const raw = readFileSync(componentPath(WOWS_FILE), 'utf8');
    expect(raw).toContain('safe failure');
  });
});
