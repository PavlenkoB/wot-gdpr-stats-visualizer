// =============================================================================
// overview-components-guard.test.ts — the rules a Node test cannot render (13-09)
// =============================================================================
//
// Vitest runs here with no Svelte plugin and no DOM, so the tile, the two
// charts and the group cannot be mounted. What CAN be checked is their source,
// and the rules that matter most are exactly the ones a render would not
// reveal: no inline style (the page's CSP would refuse it at run time, long
// after a green build), a button that holds only phrasing content, a star that
// is a sibling and not a child, the four-size type scale, the two container
// breakpoints and the one place a colour function may appear.
//
// The guard reads the four component files with their comments stripped, so a
// component may explain a rule in prose without tripping it, in the style of
// the logins guard in `phase6-guards.test.ts`.
// =============================================================================

import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { OVERVIEW_SCALE_PX } from '../../helpers/components.ts';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const DIR = path.join(REPO_ROOT, 'src/lib/features/overview');

const NAMES = [
  'OverviewTile.svelte',
  'OverviewBars.svelte',
  'OverviewRows.svelte',
  'OverviewGroup.svelte',
] as const;

type Name = (typeof NAMES)[number];

function stripComments(source: string): string {
  return source
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*/gm, '');
}

const SOURCES: Record<Name, string> = Object.fromEntries(
  NAMES.map((name) => [name, stripComments(readFileSync(path.join(DIR, name), 'utf8'))]),
) as Record<Name, string>;

const TILE = SOURCES['OverviewTile.svelte'];
const BARS = SOURCES['OverviewBars.svelte'];
const ROWS = SOURCES['OverviewRows.svelte'];
const GROUP = SOURCES['OverviewGroup.svelte'];

/** The style block of a component, or '' when it has none. */
function styleOf(source: string): string {
  return /<style[^>]*>([\s\S]*?)<\/style>/.exec(source)?.[1] ?? '';
}

/** The body of the first CSS rule whose selector is exactly `selector`. */
function ruleBody(css: string, selector: string): string | null {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\:]/g, '\\$&');
  const match = new RegExp(`(?:^|[}\\s])${escaped}\\s*\\{([^}]*)\\}`, 'm').exec(css);
  return match === null ? null : (match[1] ?? '');
}

/** The reasons a source is not allowed in an Overview component; empty when clean. */
function findings(source: string): string[] {
  const rules: { label: string; pattern: RegExp }[] = [
    { label: 'an opening b tag', pattern: /<b[\s>]/ },
    { label: 'a raw-html directive', pattern: /\{@html/ },
    { label: 'a style attribute', pattern: /\sstyle\s*=/ },
    { label: 'a style: directive', pattern: /\sstyle:[\w-]+/ },
    { label: 'innerHTML', pattern: /innerHTML/ },
    { label: 'browser storage', pattern: /localStorage|sessionStorage/ },
    { label: 'an aria-live attribute', pattern: /aria-live/ },
    { label: 'role="img"', pattern: /role\s*=\s*["']img["']/ },
  ];
  return rules.filter(({ pattern }) => pattern.test(source)).map(({ label }) => label);
}

describe('the four Overview components: what none of them may contain', () => {
  for (const name of NAMES) {
    it(`${name} has no b element, raw html, inline style, storage, live region or role=img`, () => {
      expect(findings(SOURCES[name]), name).toEqual([]);
    });
  }

  it('the finder flags each forbidden construct in temporary content', () => {
    const offenders: [string, string][] = [
      ['<b>x</b>', 'an opening b tag'],
      ['{@html value}', 'a raw-html directive'],
      ['<div style="width: 1px">x</div>', 'a style attribute'],
      ['<div style:width={w}>x</div>', 'a style: directive'],
      ['node.innerHTML = x', 'innerHTML'],
      ['localStorage.getItem("a")', 'browser storage'],
      ['<p aria-live="polite">x</p>', 'an aria-live attribute'],
      ['<svg role="img"></svg>', 'role="img"'],
    ];
    for (const [source, label] of offenders) expect(findings(source)).toContain(label);
    // A button, a break and a <style> block are not violations.
    expect(findings('<button>x</button><br><style>.a{}</style>')).toEqual([]);
  });

  it('none imports the worker, the state, the pins or a store', () => {
    for (const name of NAMES) {
      const imports = [...SOURCES[name].matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
      for (const specifier of imports) {
        expect(specifier, `${name} imports ${specifier}`).not.toMatch(
          /worker|state|storage|pins|query-client/,
        );
      }
    }
  });
});

describe('OverviewTile: the anatomy', () => {
  it('the face is one button with aria-expanded and aria-keyshortcuts="p"', () => {
    expect(TILE).toContain('aria-expanded');
    expect(TILE).toContain('aria-keyshortcuts="p"');
    expect(TILE).toContain('aria-pressed');
    expect(TILE).toContain('use:spans');
  });

  it('the star is a sibling button AFTER the face, never nested in it', () => {
    const faceOpen = TILE.indexOf('class="face"');
    const faceClose = TILE.indexOf('</button>', faceOpen);
    const starOpen = TILE.indexOf('class="star"');
    expect(faceOpen).toBeGreaterThan(-1);
    expect(faceClose).toBeGreaterThan(faceOpen);
    expect(starOpen).toBeGreaterThan(faceClose);
    // And the face holds no second button.
    const face = TILE.slice(faceOpen, faceClose);
    expect(face).not.toContain('<button');
  });

  it('the face button holds phrasing content only: no div between its tags', () => {
    const faceOpen = TILE.indexOf('class="face"');
    const faceClose = TILE.indexOf('</button>', faceOpen);
    expect(TILE.slice(faceOpen, faceClose)).not.toMatch(/<div/);
  });

  it('the star is tabindex -1, a fixed label, 44 by 44 with an 18px glyph', () => {
    const starOpen = TILE.indexOf('class="star"');
    const starClose = TILE.indexOf('</button>', starOpen);
    const star = TILE.slice(starOpen, starClose);
    expect(star).toContain('tabindex="-1"');
    expect(star).toContain('formatStarLabel(label)');
    expect(star).toContain('width="18"');
    expect(star).toContain('height="18"');
    const rule = ruleBody(styleOf(TILE), '.star') ?? '';
    expect(rule).toMatch(/width:\s*44px/);
    expect(rule).toMatch(/height:\s*44px/);
  });

  it('the chart is aria-hidden and the open link is at least 44px tall', () => {
    expect(BARS).toMatch(/class="chart"\s+aria-hidden="true"/);
    expect(ROWS).toMatch(/class="rows"\s+aria-hidden="true"/);
    expect(ruleBody(styleOf(TILE), '.link') ?? '').toMatch(/min-height:\s*44px/);
  });

  it('carries the test ids the page and the browser tests address', () => {
    for (const id of [
      'ov-tile-{tile.id}',
      'ov-tile-button-{tile.id}',
      'ov-star-{tile.id}',
      'ov-tile-detail-{tile.id}',
      'ov-tile-open-{tile.id}',
    ]) {
      expect(TILE, id).toContain(`data-testid="${id}"`);
    }
    expect(GROUP).toContain('data-testid="ov-group-{id}"');
    expect(GROUP).toContain('data-testid="ov-grid-{id}"');
  });

  it('pads 16px, rounds 8px and keeps the hairline border', () => {
    const css = styleOf(TILE);
    expect(ruleBody(css, '.face') ?? '').toMatch(/padding:\s*16px/);
    const tile = ruleBody(css, '.tile') ?? '';
    expect(tile).toMatch(/border-radius:\s*8px/);
    expect(tile).toMatch(/border:\s*1px solid var\(--border\)/);
  });

  it('opens with an ink border and an inset ink outline, and has forced-colors and reduced-motion', () => {
    const css = styleOf(TILE);
    const open = ruleBody(css, '.tile.open,\n  .tile.open:hover') ?? '';
    expect(open).toMatch(/border-color:\s*var\(--ink\)/);
    expect(open).toMatch(/outline:\s*1px solid var\(--ink\)/);
    expect(open).toMatch(/outline-offset:\s*-2px/);
    expect(css).toMatch(/@media \(forced-colors: active\)/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
  });

  it('lifts on hover only where hover exists', () => {
    const css = styleOf(TILE);
    const hover = /@media \(hover: hover\)\s*\{[\s\S]*?\.tile:hover[\s\S]*?\}/.exec(css);
    expect(hover).not.toBeNull();
    // No hover shadow outside the media query.
    const outside = css.replace(/@media \(hover: hover\)\s*\{[\s\S]*?\n {2}\}/g, '');
    expect(outside).not.toMatch(/\.tile:hover\s*\{/);
  });

  it('sets the span rules from the three custom properties', () => {
    expect(TILE).toContain('span calc(2 + var(--span4, 0))');
    expect(TILE).toContain('span calc(1 + var(--span4, 0))');
    expect(TILE).toContain('span calc(2 + var(--rows4, 0))');
    expect(TILE).toContain('span calc(1 + var(--span2, 0))');
    expect(TILE).toMatch(/@container \(max-width: 479\.98px\)[\s\S]*?grid-column:\s*auto/);
  });
});

describe('type, spacing and breakpoints', () => {
  it('every font-size in the four files is 12, 14, 32 or 56px', () => {
    for (const name of NAMES) {
      const sizes = [...SOURCES[name].matchAll(/font-size\s*:\s*([^;}\n]+)/g)].map((m) =>
        (m[1] ?? '').trim(),
      );
      for (const value of sizes) {
        const px = /^(\d+)px$/.exec(value);
        expect(px, `${name}: font-size: ${value}`).not.toBeNull();
        expect(OVERVIEW_SCALE_PX.has(Number(px?.[1])), `${name}: ${value}`).toBe(true);
      }
    }
  });

  it('declares no 12px gap, and the group grid declares a 16px gap', () => {
    for (const name of NAMES) expect(SOURCES[name], name).not.toMatch(/gap\s*:\s*12px/);
    expect(ruleBody(styleOf(GROUP), '.grid') ?? '').toMatch(/(?:^|\s)gap:\s*16px/);
  });

  it('the only container breakpoints are 880px and 480px', () => {
    const allowed = new Set([880, 879.98, 480, 479.98]);
    const seen = new Set<number>();
    for (const name of NAMES) {
      for (const query of SOURCES[name].matchAll(/@container\s*([^{]*)\{/g)) {
        for (const px of (query[1] ?? '').matchAll(/(\d+(?:\.\d+)?)px/g)) {
          const value = Number(px[1]);
          expect(allowed.has(value), `${name}: @container ${query[1]}`).toBe(true);
          seen.add(Math.round(value));
        }
      }
    }
    expect([...seen].sort()).toEqual([480, 880]);
  });

  it('declares no max-width media query (app.css owns the one phone block)', () => {
    for (const name of NAMES) expect(SOURCES[name], name).not.toMatch(/@media\s*\(max-width/);
  });

  it('sets no view-transition-name in CSS (it is written through the CSSOM)', () => {
    for (const name of NAMES) expect(SOURCES[name], name).not.toMatch(/view-transition-name/);
  });
});

describe('colour', () => {
  const HEX = /(?<![&\w])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b/;

  it('no component writes a hex colour', () => {
    for (const name of NAMES) expect(SOURCES[name], name).not.toMatch(HEX);
  });

  it('the chart components colour bars with heatColor and nothing else', () => {
    expect(BARS).toContain('heatColor');
    expect(ROWS).toContain('heatColor');
    expect(BARS).not.toMatch(/\b(?:rgba?|hsla?)\(/);
    expect(ROWS).not.toMatch(/\b(?:rgba?|hsla?)\(/);
  });

  it('the shadows in the tile are the only colour functions, and all are the ink at low alpha', () => {
    const functions = [...TILE.matchAll(/\b(?:rgba?|hsla?)\([^)]*\)/g)].map((m) => m[0]);
    expect(functions.length).toBeGreaterThan(0);
    for (const call of functions) expect(call).toMatch(/^rgba\(17, 17, 17, 0?\.\d+\)$/);
    expect(GROUP).not.toMatch(/\b(?:rgba?|hsla?)\(/);
  });

  it('group dots read the group tokens and the star reads the star tokens', () => {
    for (const token of ['--ov-time', '--ov-tanks', '--ov-records', '--ov-totals']) {
      expect(TILE, token).toContain(`var(${token})`);
      expect(GROUP, token).toContain(`var(${token})`);
    }
    expect(GROUP).toContain('var(--ov-pinned)');
    expect(TILE).toContain('var(--ov-star-fill)');
    expect(TILE).toContain('var(--ov-star-stroke)');
    expect(GROUP).toContain('var(--heat-low), var(--heat-mid), var(--heat-peak)');
  });
});

describe('overflow and long text', () => {
  it('the value wraps anywhere and is never below 32px', () => {
    const css = styleOf(TILE);
    const value = ruleBody(css, '.v') ?? '';
    expect(value).toMatch(/overflow-wrap:\s*anywhere/);
    expect(value).toMatch(/font-size:\s*32px/);
    expect(value).not.toMatch(/white-space:\s*nowrap|text-overflow/);
    expect(ruleBody(css, '.v.numeral') ?? '').toMatch(/font-size:\s*56px/);
  });

  it('the only text in the tile below 32px besides the unit is label, rule and panel copy', () => {
    // A value rule must not carry a smaller size than the Display role.
    const css = styleOf(TILE);
    for (const selector of ['.v', '.v.numeral']) {
      const size = /font-size:\s*(\d+)px/.exec(ruleBody(css, selector) ?? '');
      expect(Number(size?.[1]), selector).toBeGreaterThanOrEqual(32);
    }
    const unit = /font-size:\s*(\d+)px/.exec(ruleBody(css, '.unit') ?? '');
    expect(Number(unit?.[1])).toBe(14);
  });

  it('the rows grid is the approved three-column layout and wraps its names', () => {
    const css = styleOf(ROWS);
    // The three tracks are declared ONCE, on the block, and every row is a
    // subgrid of them. A track list on `.row` would size the figure column to
    // that row's own text, so a wider figure would push its bar left of a
    // narrower one's and the bars would stop sharing a left edge.
    expect(ruleBody(css, '.rows') ?? '').toContain(
      'grid-template-columns: minmax(72px, 1fr) clamp(60px, 30%, 152px) auto',
    );
    const row = ruleBody(css, '.row') ?? '';
    expect(row).toMatch(/grid-template-columns:\s*subgrid/);
    expect(row).toMatch(/grid-column:\s*1\s*\/\s*-1/);
    expect(row).not.toMatch(/minmax\(|clamp\(/);
    expect(ruleBody(css, '.name') ?? '').toMatch(/overflow-wrap:\s*anywhere/);
  });
});

describe('OverviewGroup: the grid', () => {
  it('Pinned never packs densely, so it keeps the catalogue reading order', () => {
    const css = styleOf(GROUP);
    // Dense is declared exactly once, on the .dense modifier, and the markup
    // applies that modifier to every group except pinned.
    expect(css.match(/grid-auto-flow:\s*dense/g)).toHaveLength(1);
    expect(ruleBody(css, '.grid.dense') ?? '').toMatch(/grid-auto-flow:\s*dense/);
    expect(ruleBody(css, '.grid') ?? '').toMatch(/grid-auto-flow:\s*row/);
    expect(GROUP).toContain("class:dense={id !== 'pinned'}");
  });

  it('keeps siblings at their natural height while a tile is open', () => {
    const css = styleOf(GROUP);
    expect(ruleBody(css, '.grid:has(:global(.tile.open))') ?? '').toMatch(/align-items:\s*start/);
  });

  it('has one, two and four columns at the container widths', () => {
    const css = styleOf(GROUP);
    expect(ruleBody(css, '.grid') ?? '').toMatch(/grid-template-columns:\s*minmax\(0, 1fr\)/);
    expect(css).toMatch(/@container \(min-width: 480px\)\s*\{\s*\.grid\s*\{[^}]*repeat\(2,/);
    expect(css).toMatch(/@container \(min-width: 880px\)\s*\{\s*\.grid\s*\{[^}]*repeat\(4,/);
  });

  it('the legend is a 48 by 8px aria-hidden swatch between the words, and not part of the h3', () => {
    expect(ruleBody(styleOf(GROUP), '.swatch') ?? '').toMatch(/width:\s*48px/);
    expect(ruleBody(styleOf(GROUP), '.swatch') ?? '').toMatch(/height:\s*8px/);
    expect(GROUP).toMatch(/class="swatch"\s+aria-hidden="true"/);
    const h3 = /<h3[\s\S]*?<\/h3>/.exec(GROUP)?.[0] ?? '';
    expect(h3).not.toContain('legend');
    expect(h3).toContain('aria-hidden="true"');
  });

  it('gives the heading dot and the swatch a system-colour outline under forced colours', () => {
    const forced = /@media \(forced-colors: active\)\s*\{([\s\S]*?)\n {2}\}/.exec(styleOf(GROUP));
    expect(forced?.[1] ?? '').toMatch(/\.dot/);
    expect(forced?.[1] ?? '').toMatch(/\.swatch/);
    expect(forced?.[1] ?? '').toMatch(/outline:\s*1px solid CanvasText/);
  });
});

// =============================================================================
// OverviewBento (13-12): the page body obeys the same rules, and owns the one
// place pins are written.
// =============================================================================

const BENTO = stripComments(readFileSync(path.join(DIR, 'OverviewBento.svelte'), 'utf8'));

/** Every file under a directory, recursively. */
function filesUnder(dir: string): string[] {
  const found: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) found.push(...filesUnder(full));
    else found.push(full);
  }
  return found;
}

describe('OverviewBento: what it may not contain', () => {
  it('has no b element, raw html, inline style, storage, live region or role=img', () => {
    expect(findings(BENTO)).toEqual([]);
  });

  it('every font-size is 12 or 14px (the scale)', () => {
    const sizes = [...BENTO.matchAll(/font-size\s*:\s*([^;}\n]+)/g)].map((m) =>
      (m[1] ?? '').trim(),
    );
    expect(sizes.length).toBeGreaterThan(0);
    for (const value of sizes) {
      const px = /^(\d+)px$/.exec(value);
      expect(px, `font-size: ${value}`).not.toBeNull();
      expect(OVERVIEW_SCALE_PX.has(Number(px?.[1])), value).toBe(true);
    }
  });

  it('the only container breakpoints are 880px and 480px, and there is no max-width media query', () => {
    const allowed = new Set([880, 879.98, 480, 479.98]);
    for (const query of BENTO.matchAll(/@container\s*([^{]*)\{/g)) {
      for (const px of (query[1] ?? '').matchAll(/(\d+(?:\.\d+)?)px/g)) {
        expect(allowed.has(Number(px[1])), `@container ${query[1]}`).toBe(true);
      }
    }
    expect(BENTO).not.toMatch(/@media\s*\(max-width/);
  });

  it('writes no hex colour and sets no view-transition-name in CSS', () => {
    expect(BENTO).not.toMatch(/(?<![&\w])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/);
    expect(BENTO).not.toMatch(/view-transition-name/);
  });

  it('builds no element from a string and uses no dynamic import or network global', () => {
    expect(BENTO).not.toMatch(/createElement|insertAdjacentHTML|outerHTML|document\.write/);
    expect(BENTO).not.toMatch(/\bimport\s*\(/);
    expect(BENTO).not.toMatch(/\b(?:fetch|XMLHttpRequest|WebSocket|sendBeacon|EventSource)\b/);
  });

  it('keeps the dashed absent row and the container query root', () => {
    expect(BENTO).toMatch(/border:\s*1px dashed var\(--faint\)/);
    expect(BENTO).toMatch(/container-type:\s*inline-size/);
    expect(BENTO).toMatch(/@media \(forced-colors: active\)[\s\S]*?1px dashed CanvasText/);
    expect(BENTO).toContain('data-testid="ov-provenance"');
    expect(BENTO).toContain('data-testid="ov-attribution"');
    expect(BENTO).toContain('data-testid="ov-absent-{group.id}"');
    expect(BENTO).toContain('data-testid="ov-skeleton-tile"');
  });

  it('draws the attribution link as an ordinary anchor with rel noreferrer noopener', () => {
    expect(BENTO).toContain('target="_blank"');
    expect(BENTO).toContain('rel="noreferrer noopener"');
  });
});

describe('OverviewBento: pins and the announcer', () => {
  it('imports writePins and calls it exactly once', () => {
    expect(BENTO).toMatch(/import\s*\{[^}]*\bwritePins\b[^}]*\}\s*from\s*'\.\/overview-pins\.ts'/);
    expect(BENTO.match(/\bwritePins\s*\(/g) ?? []).toHaveLength(1);
  });

  it('no other file under src calls writePins except overview-pins.ts and the bento', () => {
    const SRC = path.join(REPO_ROOT, 'src');
    const callers = filesUnder(SRC)
      .filter((file) => /\.(ts|svelte)$/.test(file))
      .filter((file) => /\bwritePins\s*\(/.test(stripComments(readFileSync(file, 'utf8'))))
      .map((file) => path.relative(SRC, file).split(path.sep).join('/'))
      .sort();
    expect(callers).toEqual([
      'lib/features/overview/OverviewBento.svelte',
      'lib/features/overview/overview-pins.ts',
    ]);
  });

  it('reads pins once at start and never inside an effect', () => {
    expect(BENTO.match(/\breadPins\s*\(/g) ?? []).toHaveLength(1);
    expect(BENTO).not.toMatch(/\$effect/);
  });

  it('announces through the page-level context and adds no live region', () => {
    expect(BENTO).toContain('getContext<ChartAnnounce | undefined>(CHART_ANNOUNCE_KEY)');
    expect(BENTO).not.toMatch(/aria-live|role\s*=\s*["'](?:status|alert|log)["']/);
  });

  it('Escape on an open tile calls preventDefault before closing; a closed tile returns early', () => {
    const escape = /event\.key === 'Escape'[\s\S]*?return;\s*\}/.exec(BENTO)?.[0] ?? '';
    expect(escape).toContain('if (!expander.wanted(hit.id)) return;');
    expect(escape.indexOf('event.preventDefault()')).toBeGreaterThan(
      escape.indexOf('if (!expander.wanted(hit.id)) return;'),
    );
    expect(escape).toContain('request(hit.id, false)');
  });
});
