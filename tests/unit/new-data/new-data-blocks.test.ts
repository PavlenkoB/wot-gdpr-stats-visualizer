import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { componentPath } from '../../helpers/components.ts';
import { formatNewDataCell } from '../../../src/lib/features/new-data/new-data-cell.ts';
import { maskIp } from '../../../src/lib/geo/ip.ts';
import {
  DEVICE_NOT_REPORTED,
  formatBattleTypeLabel,
  formatNumber,
} from '../../../src/lib/ui-copy.ts';

// =============================================================================
// Plan 11-08 - the new-game UI kit: the cell rules and the two components
// =============================================================================
//
// Vitest has no DOM here, so the components are asserted by what their SOURCE
// promises, in the style of `tests/unit/device-info/device-info-blocks.test.ts`.
// Every test asserts the file EXISTS first, because an empty string contains no
// forbidden token and would pass vacuously. The rendered half (the DOM node
// budget, the 375px overflow, no address in any attribute) is plan 11-11's.
// =============================================================================

const TABLE_FILE = 'NewDataTable.svelte';
const CARD_FILE = 'NewDataCard.svelte';

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

/** The declarations of the first rule whose selector is exactly `selector`. */
function ruleBody(source: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{([^}]*)\\}`).exec(source);
  expect(match, `a rule for ${selector}`).not.toBeNull();
  return match![1]!.replace(/\s+/g, ' ');
}

/** The comment-free source of a component that must exist. */
function clean(filename: string): string {
  expect(existsSync(componentPath(filename)), `${filename} exists`).toBe(true);
  return stripComments(code(filename));
}

// -----------------------------------------------------------------------------
// The cell rules (shared by the table and the per-account blocks)
// -----------------------------------------------------------------------------

describe('formatNewDataCell', () => {
  const options = { revealed: false, battleTypeColumnId: 'GAME_MODE' } as const;

  it('renders null, undefined and an empty string as the muted words, never a blank or a dash', () => {
    for (const cell of [null, undefined, '']) {
      const out = formatNewDataCell(cell, { id: 'X', kind: 'text' }, options);
      expect(out).toEqual({ text: DEVICE_NOT_REPORTED, muted: true });
      expect(out.text).not.toBe('');
      expect(out.text).not.toMatch(/^[-–—]+$/);
    }
    // An address column that is null is also "not reported", not a masked mask.
    expect(formatNewDataCell(null, { id: 'IP', kind: 'address' }, options).muted).toBe(true);
  });

  it('groups a number through formatNumber and leaves a kept string as written', () => {
    expect(formatNewDataCell(1234567, { id: 'BATTLES', kind: 'number' }, options)).toEqual({
      text: formatNumber(1234567),
      muted: false,
    });
    expect(formatNewDataCell('1.5e3', { id: 'BATTLES', kind: 'number' }, options).text).toBe(
      '1.5e3',
    );
    expect(formatNewDataCell(0, { id: 'BATTLES', kind: 'number' }, options).muted).toBe(false);
  });

  it('shows text and dates exactly as the export wrote them', () => {
    expect(
      formatNewDataCell('2023-04-05 06:07:08', { id: 'REGISTRATION_DT', kind: 'date' }, options)
        .text,
    ).toBe('2023-04-05 06:07:08');
    expect(
      formatNewDataCell('PS5', { id: 'FIRST_LOGIN_PLATFORM', kind: 'text' }, options).text,
    ).toBe('PS5');
  });

  it('renders the battle-type column as Battle type {code}, and only that column', () => {
    expect(formatNewDataCell('7', { id: 'GAME_MODE', kind: 'text' }, options).text).toBe(
      formatBattleTypeLabel('7'),
    );
    expect(formatNewDataCell('7', { id: 'GAME_SOURCE', kind: 'text' }, options).text).toBe('7');
    // With no battle-type column named, nothing is relabelled.
    expect(
      formatNewDataCell(
        '7',
        { id: 'GAME_MODE', kind: 'text' },
        { ...options, battleTypeColumnId: null },
      ).text,
    ).toBe('7');
  });

  it('masks an address by default and reveals it only on the reveal flag (D-04, PRIV-01)', () => {
    const column = { id: 'IP', kind: 'address' } as const;
    const masked = formatNewDataCell('203.0.113.77', column, options);
    expect(masked.text).toBe(maskIp('203.0.113.77'));
    expect(masked.text).not.toContain('113.77');
    expect(formatNewDataCell('203.0.113.77', column, { ...options, revealed: true }).text).toBe(
      '203.0.113.77',
    );
  });

  it('masks an address-kind cell that is not a canonical address instead of echoing it', () => {
    const column = { id: 'IP', kind: 'address' } as const;
    const out = formatNewDataCell('someone@example.com', column, options);
    expect(out.text).not.toContain('someone');
    expect(out.text).not.toContain('@');
  });

  it('masks a code-kind cell by default and shows the stored text only on the reveal (D-13, T-12-17)', () => {
    const column = { id: 'COUPON_CODE', kind: 'code' } as const;
    const masked = formatNewDataCell('AB7K-QX42', column, options);
    expect(masked).toEqual({ text: 'ABxxx', muted: false });
    expect(masked.text).not.toContain('7K');
    expect(formatNewDataCell('AB7K-QX42', column, { ...options, revealed: true })).toEqual({
      text: 'AB7K-QX42',
      muted: false,
    });
    // A short code masks to the fixed text alone; a null code is "not reported".
    expect(formatNewDataCell('SHORT', column, options).text).toBe('xxx');
    expect(formatNewDataCell(null, column, options)).toEqual({
      text: DEVICE_NOT_REPORTED,
      muted: true,
    });
  });

  it('never reads a non-address column through the mask formatter', () => {
    // A text cell that looks like an address is data the allowlist kept as text;
    // it is not an address and is not masked or revealed as one.
    expect(formatNewDataCell('10.0.0.1', { id: 'ASSET_NAME', kind: 'text' }, options).text).toBe(
      '10.0.0.1',
    );
  });
});

// -----------------------------------------------------------------------------
// NewDataTable.svelte
// -----------------------------------------------------------------------------

describe('NewDataTable.svelte contract', () => {
  it('imports the windowing arithmetic, the single address formatter and the tag chip', () => {
    const source = clean(TABLE_FILE);
    expect(source).toContain("from '../../core/windowing.ts'");
    expect(source).toContain('windowRange');
    expect(source).toContain('SCROLLER_MAX_PX');
    expect(source).toContain("import AccountTag from '../../shell/AccountTag.svelte'");
    expect(source).toContain('tagLabel');
    expect(source).toContain('shouldWindow');
    expect(source).toContain('formatNewDataCell');
    expect(source).toContain('formatNewDataColumnLabel');
    // The address string is chosen by the cell function, which uses displayIp
    // and nothing else; the component never touches an address itself.
    expect(
      stripComments(readFileSync('src/lib/features/new-data/new-data-cell.ts', 'utf8')),
    ).toContain('displayIp({ ip: String(cell) }, options.revealed)');
  });

  it('is a named, focusable scroll region with a hidden caption and column-scoped headers', () => {
    const source = clean(TABLE_FILE);
    expect(source).toContain('data-testid="new-data-table"');
    expect(source).toContain('role="region"');
    expect(source).toContain('tabindex="0"');
    expect(source).toContain('aria-label={regionName}');
    expect(source).toContain('formatDeviceTableLabel(tableLabel)');
    expect(source).toContain('<caption class="visually-hidden">{regionName}</caption>');
    expect(source).toContain('scope="col"');
    expect(source).toMatch(/max-height:\s*480px/);
    expect(source).toMatch(/outline:\s*3px solid var\(--focus\)/);
    expect(source).toMatch(/outline-offset:\s*2px/);
  });

  it('sticks the header row and the first column', () => {
    const source = clean(TABLE_FILE);
    expect(source).toMatch(/th\s*\{[^}]*position:\s*sticky;[^}]*top:\s*0/);
    expect(source).toMatch(/td\.sticky-first\s*\{[^}]*position:\s*sticky;[^}]*left:\s*0/);
    expect(source).toMatch(/background:\s*var\(--page\)/);
  });

  it('draws every row at a fixed 40px, windowed above the threshold with two spacer rows', () => {
    const source = clean(TABLE_FILE);
    expect(source).toMatch(/tbody tr\s*\{[^}]*height:\s*40px/);
    expect(source).toContain('windowRange(scrollTop, SCROLLER_MAX_PX, rows.length)');
    expect(source).toContain('shouldWindow(rows.length)');
    // No measurement of the DOM: the viewport is the constant, never a read.
    for (const banned of [
      'clientHeight',
      'getBoundingClientRect',
      'offsetHeight',
      'ResizeObserver',
    ]) {
      expect(source).not.toContain(banned);
    }
    // Two spacers, only in windowed mode, written through bound refs.
    expect((source.match(/class="spacer"/g) ?? []).length).toBe(2);
    expect(source).toContain('bind:this={topSpacerEl}');
    expect(source).toContain('bind:this={bottomSpacerEl}');
    expect(source).toContain('bind:this={tableEl}');
  });

  it('writes the geometry through the CSSOM, reading the derived values into locals first', () => {
    const source = clean(TABLE_FILE);
    const effect = /\$effect\(\(\) => \{\s*const padTop = drawnRange\.padTopPx;[\s\S]*?\}\);/.exec(
      source,
    );
    expect(effect, 'the geometry effect exists').not.toBeNull();
    const body = effect![0];
    expect(body.indexOf('const padBottom')).toBeLessThan(body.indexOf('!== null'));
    expect(body.indexOf('const minWidth')).toBeLessThan(body.indexOf('!== null'));
    expect(body).toContain('topSpacerEl.style.height');
    expect(body).toContain('bottomSpacerEl.style.height');
    expect(body).toContain('tableEl.style.minWidth');
  });

  it('resets the scroll position when the rows change', () => {
    const source = clean(TABLE_FILE);
    expect(source).toMatch(/void rows;\s*scrollTop = 0;/);
    expect(source).toContain('scrollerEl.scrollTop = 0');
  });

  it('puts the tag first in the first cell with no whitespace node, and only when tags exist', () => {
    const source = clean(TABLE_FILE);
    // The conditional tag, the closing brace and the text sit flush.
    expect(source).toMatch(/\/>\s*\{\/if\}\{#if cell\.muted\}/);
    expect(source).toMatch(/\{#if tagOf\(row\) !== null\}<AccountTag/);
    expect(source).toContain('tags === null ? null : (tags.get(row.account) ?? null)');
    // One geometry record: the first column is wider only when tags exist.
    expect(source).toContain('const TAG_EXTRA_PX = 32');
    // A table whose rows may carry several tags grows it by 64px instead (12-06).
    expect(source).toContain('const SEVERAL_TAGS_EXTRA_PX = 64');
    expect(source).toMatch(
      /index === 0 && tagged\s*\? base \+ \(severalTags \? SEVERAL_TAGS_EXTRA_PX : TAG_EXTRA_PX\)\s*: base/,
    );
    expect(source).toMatch(
      /\.sticky-first :global\(\[data-testid='account-tag'\]\)\s*\{[^}]*margin-right:\s*4px/,
    );
  });

  it('interpolates every value as text and labels nothing from a cell', () => {
    const source = clean(TABLE_FILE);
    const html = markup(source);
    expect(html).toContain('{cell.text}');
    expect(html).not.toMatch(/\stitle\s*=/);
    // The only aria-label is the table's own name, built from the card title.
    expect([...html.matchAll(/aria-label=/g)]).toHaveLength(1);
    expect(html).not.toMatch(/data-testid=\{/);
    expect(html).not.toMatch(/data-testid="[^"]*\{/);
    expect(html).not.toMatch(/\sdata-(?!testid)[a-z-]+=/);
  });

  it('keys every each by position, because rows repeat across accounts', () => {
    const source = clean(TABLE_FILE);
    const keys = [...source.matchAll(/^\s*\{#each [^\n]*\(([^()]*)\)\s*\}\s*$/gm)].map((m) => m[1]);
    expect(keys.sort()).toEqual(['cellIndex', 'columnIndex', 'rowIndex']);
  });
});

// -----------------------------------------------------------------------------
// 12-06: the several-tags first cell and the code column
// -----------------------------------------------------------------------------

describe('NewDataTable.svelte: the several-tags first cell (12-06, D-10, D-13)', () => {
  it('draws the chips through accountChipsOf, behind the severalTags prop only', () => {
    const source = clean(TABLE_FILE);
    expect(source).toContain('accountChipsOf');
    expect(source).toContain('severalTags?: boolean');
    expect(source).toContain('severalTags = false');
    // The several-tags branch is guarded by the prop; the plain branch is the old one.
    expect(source).toMatch(/\{#if cellIndex === 0 && severalTags\}/);
    expect(source).toMatch(/\{:else if cellIndex === 0\}/);
    expect(source).toContain('row.accounts ?? [row.account]');
  });

  it('keys the chip blocks by position and shows hidden phrases and a plain-text +N', () => {
    const html = markup(clean(TABLE_FILE));
    expect(html).toMatch(/\{#each chips\.shown as tag, tagIndex \(tagIndex\)\}/);
    expect(html).toMatch(/\{#each chips\.hiddenTags as tag, tagIndex \(tagIndex\)\}/);
    expect(html).toContain('visual={false}');
    expect(html).toContain('formatAccountOverflow(chips.extra)');
    expect(html).toMatch(/<span class="more"/);
  });

  it('keeps the chips flush against the text: no whitespace between them', () => {
    const source = clean(TABLE_FILE);
    expect(source).toMatch(/\}\{\/if\}\{#if cell\.muted\}/);
    expect(source).toMatch(/\/>\{\/each\}\{#each chips\.hiddenTags/);
  });

  it('has the code geometry, the many-tags geometry and no attribute that carries a cell', () => {
    const source = clean(TABLE_FILE);
    const html = markup(source);
    expect(source).toContain("cls: 'w-code'");
    expect(source).toMatch(/\.w-code\s*[,{]/);
    expect(source).toMatch(/\.w-code-many\s*[,{]/);
    expect(html).not.toMatch(/\stitle\s*=/);
    expect(html).not.toMatch(/aria-label=\{[^}]*(cell|row)/);
  });

  it('is forwarded by the card', () => {
    const source = clean(CARD_FILE);
    expect(source).toContain('severalTags?: boolean');
    expect(source).toMatch(/\{severalTags\}/);
  });
});

// -----------------------------------------------------------------------------
// The prohibitions both components obey
// -----------------------------------------------------------------------------

describe('the new-game components obey the project prohibitions', () => {
  for (const file of [TABLE_FILE, CARD_FILE]) {
    it(`${file} has no raw HTML, inline style, svg, media query, animation, console or network`, () => {
      const source = clean(file);
      const html = markup(source);

      expect(source).not.toContain('{@html');
      expect(html).not.toMatch(/\sstyle\s*=/);
      expect(html).not.toMatch(/\sstyle:/);
      expect(html).not.toContain('<svg');
      expect(source).not.toContain('@media');
      expect(source).not.toMatch(/\b(transition|animation|@keyframes)\b/);
      expect(source).not.toMatch(/\bconsole\./);
      expect(source).not.toMatch(/\baria-live\b/);
      expect(source).not.toMatch(/role="(alert|status)"/);
      for (const banned of ['fetch(', 'XMLHttpRequest', 'WebSocket', 'sendBeacon', 'EventSource']) {
        expect(source).not.toContain(banned);
      }
    });

    it(`${file} uses only scale font sizes and no colour literal`, () => {
      const source = clean(file);
      const sizes = [...source.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)].map((m) => m[1]);
      for (const size of sizes) expect(['14', '18', '26', '30']).toContain(size);
      expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(source).not.toMatch(/\b(?:rgba?|hsla?)\(/);
    });

    it(`${file} attaches no per-row listener`, () => {
      const html = markup(clean(file));
      const listeners = [...html.matchAll(/\son[a-z]+=/g)].map((m) => m[0].trim());
      // The table's one scroll handler on the scroller; nothing on a row or a cell,
      // and the card, which draws no scroller of its own, has none at all.
      expect(listeners).toEqual(file === TABLE_FILE ? ['onscroll='] : []);
    });
  }
});

// -----------------------------------------------------------------------------
// NewDataCard.svelte
// -----------------------------------------------------------------------------

describe('NewDataCard.svelte contract', () => {
  it('is a section carrying the view status, a passed test id and an h3 title', () => {
    const source = clean(CARD_FILE);
    const html = markup(source);
    expect(html).toMatch(/<section[^>]*data-testid=\{testId\}[^>]*data-status=\{view\.status\}/);
    expect(html).toContain('<h3 id="{testId}-title">{title}</h3>');
    expect(html).toContain('aria-labelledby="{testId}-title"');
    // Label role in --ink with no bottom rule: the card border already separates.
    expect(source).toMatch(/h3\s*\{[^}]*font-weight:\s*600[^}]*color:\s*var\(--ink\)/);
    expect(source).not.toMatch(/h3\s*\{[^}]*border-bottom/);
  });

  it('shows a From {file} caption through formatDeviceFromFile for every state but not-in-export', () => {
    const source = clean(CARD_FILE);
    expect(source).toContain("{#if view.status !== 'not-in-export'}");
    expect(source).toContain('<p class="caption">{formatDeviceFromFile(file)}</p>');
    expect(source).toMatch(/\.caption\s*\{[^}]*color:\s*var\(--muted\)/);
  });

  it('renders exactly the four states with their sentences', () => {
    const source = clean(CARD_FILE);
    expect(source).toContain("{#if view.status === 'not-in-export'}");
    expect(source).toContain('{DEVICE_TABLE_NOT_IN_EXPORT}');
    expect(source).toContain("{:else if view.status === 'no-rows'}");
    expect(source).toContain('{formatDeviceNoRows(file)}');
    expect(source).toContain("{:else if view.status === 'skipped'}");
    expect(source).toContain('data-testid="new-data-skipped">{formatNewDataSkipped(file)}</p>');
    // The ready branch is the final else: the table or the blocks.
    expect(source).toContain("{:else if layout === 'blocks'}");
    expect(source).toContain('<NewDataTable');
    // The skipped sentence is not an error: no alert role, no failure wording.
    expect(source).not.toMatch(/role="(alert|status)"/);
    expect(source).not.toMatch(/\b(error|failed|failure)\b/i);
  });

  it('draws a skipped card with a dashed --faint border on a --list fill', () => {
    const source = clean(CARD_FILE);
    expect(source).toContain("class:skipped={view.status === 'skipped'}");
    const skipped = ruleBody(source, '.card.skipped');
    expect(skipped).toContain('border: 1px dashed var(--faint)');
    expect(skipped).toContain('background: var(--list)');
    const card = ruleBody(source, '.card');
    for (const declaration of [
      'border: 1px solid var(--border)',
      'border-radius: var(--radius-card)',
      'background: var(--page)',
      'padding: 16px',
      'display: flex',
      'flex-direction: column',
      'gap: 8px',
      'min-width: 0',
    ]) {
      expect(card, declaration).toContain(declaration);
    }
  });

  it('takes the file only as a display label and never a zip entry name', () => {
    const source = clean(CARD_FILE);
    // The prop is documented as the label; nothing in the card reads a path.
    expect(source).toContain('file: string;');
    expect(source).not.toMatch(/\b(fileName|entryName|path)\b/);
    expect(source).not.toContain('NEW_DATA_FILE_LABELS');
  });

  it('builds the blocks layout from the first row of each account, tag line only with tags', () => {
    const source = clean(CARD_FILE);
    const html = markup(source);
    expect(source).toContain('firstRowPerAccount(view.rows)');
    expect(html).toContain('{#each blocks as block, blockIndex (blockIndex)}');
    expect(html).toMatch(/\{#if tagOf\(block\) !== null\}/);
    expect(source).toContain('tags === null ? null : (tags.get(row.account) ?? null)');
    expect(source).toMatch(
      /dl\s*\{[^}]*grid-template-columns:\s*max-content 1fr[^}]*gap:\s*4px 16px/,
    );
    expect(source).toMatch(/dt\s*\{[^}]*font-weight:\s*600[^}]*color:\s*var\(--muted\)/);
    expect(source).toMatch(
      /dd\s*\{[^}]*text-align:\s*right[^}]*font-variant-numeric:\s*tabular-nums/,
    );
    expect(html).toContain('formatNewDataColumnLabel(fileKey, column.id)');
    expect(html).toContain('{cell.text}');
  });

  it('renders the table layout through NewDataTable with the card title as its name', () => {
    const html = markup(clean(CARD_FILE));
    expect(html).toMatch(/<NewDataTable[\s\S]*?columns=\{view\.columns\}/);
    expect(html).toContain('rows={view.rows}');
    expect(html).toContain('tableLabel={title}');
    expect(html).toContain('{battleTypeColumnId}');
    expect(html).toContain('{revealed}');
    expect(html).toContain('{tags}');
  });

  it('renders an optional header snippet under the caption', () => {
    const source = clean(CARD_FILE);
    expect(source).toContain('header?: Snippet');
    expect(source).toContain('{@render header?.()}');
    const html = markup(source);
    expect(html.indexOf('formatDeviceFromFile(file)')).toBeLessThan(
      html.indexOf('{@render header?.()}'),
    );
    expect(html.indexOf('{@render header?.()}')).toBeLessThan(
      html.indexOf("view.status === 'not-in-export'}\n"),
    );
  });

  it('has no live region, banner, icon or unreadable-rows notice', () => {
    const source = clean(CARD_FILE);
    expect(source).not.toMatch(/aria-live/);
    expect(source).not.toMatch(/role="(alert|status|banner)"/);
    expect(source).not.toContain('ExcludedNotice');
    expect(markup(source)).not.toMatch(/<(svg|img|i)\b/);
  });

  it('keys its eaches by position', () => {
    const source = clean(CARD_FILE);
    const keys = [...source.matchAll(/^\s*\{#each [^\n]*\(([^()]*)\)\s*\}\s*$/gm)].map((m) => m[1]);
    expect(keys.sort()).toEqual(['blockIndex', 'columnIndex']);
  });

  it('puts no cell, address, nickname or id in an attribute', () => {
    const html = markup(clean(CARD_FILE));
    expect(html).not.toMatch(/\stitle\s*=/);
    expect(html).not.toMatch(/aria-label=/);
    expect(html).not.toMatch(/data-testid="[^"]*\{(?!testId\})/);
    // The only dynamic data attribute is the status, which is one of four words.
    expect([...html.matchAll(/\sdata-(?!testid)([a-z-]+)=/g)].map((m) => m[1])).toEqual(['status']);
  });
});
