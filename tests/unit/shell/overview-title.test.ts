import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { componentPath } from '../../helpers/components.ts';
import {
  ruleDeclarations,
  scanRules,
  stripCssComments,
  styleText,
  tokenMap,
} from '../../helpers/css.ts';
import { readTokenSource } from '../../helpers/styles.ts';

// =============================================================================
// The pane title role and the Overview's line-box compensation (14-05, D-12,
// D-15 and D-16).
// =============================================================================
//
// WHAT THIS PINS
//   Two things that are easy to break and hard to see:
//
//     1. **The one title role.** Every pane title and the identity titles
//        carry `.t-title`, and no local rule competes with it. The phone bar's
//        title is the one exception and carries `.t-heading` (18px) instead,
//        because the one-line bar truncates the longest pane name at the
//        Title role's 26px (UAT gap G-14-2). A local `font-size` on a title
//        is a second answer to the same question, and the phone block's
//        overrides were exactly that: they
//        had to be DELETED, because a rule of specificity (0,3,0) beats a
//        role of (0,1,0) wherever both are present.
//
//     2. **The Overview's compensation (D-16).** The Overview title is 32px at
//        900px and up, like every other pane title, but the Overview's title
//        block keeps today's row height: the content below it does not move
//        and no Overview element changes size. The mechanism is a negative
//        bottom margin of EXACTLY the difference between the taller line box
//        and the old one, written from the tokens so it follows them.
//
// WHY THE ARITHMETIC IS PINNED HERE AND NOT ONLY IN A COMMENT
//   The compensation is a number that has to be right to a fraction of a
//   pixel: 41.6px of line box minus 7.8px of margin is 33.8px, which is
//   26px x 1.3 - today's row. A margin of "-7px" or "-8px" would leave the
//   first tile a pixel lower or higher, and nothing in the unit suite would
//   notice; the pixel compare would, but only at the end of the phase. So the
//   numbers are computed HERE, from the token file, and asserted.
//
// THE TOKENS ARE READ, NOT ASSUMED
//   The size of the title at 900px and up is `--fs-title`, and `--fs-title`
//   is a switch: `var(--fs-display)` by default, `var(--fs-stat)` inside the
//   `min-width: 900px` block. A test that hard-coded 26 and 32 would keep
//   passing if the switch moved or the sizes changed. So the test reads the
//   token file, resolves the switch, and computes the margin from it.
// =============================================================================

/** The source of a shell component. */
function sourceOf(filename: string): string {
  return readFileSync(componentPath(filename), 'utf8');
}

/** The style block of a shell component. */
function styleOf(filename: string): string {
  return styleText(sourceOf(filename));
}

/** The numeric value of a token, or NaN when it is not a plain number. */
function number(token: string | undefined): number {
  if (token === undefined) return Number.NaN;
  const match = /^(-?\d+(?:\.\d+)?)(?:px)?$/.exec(token.trim());
  return match === null ? Number.NaN : Number(match[1]);
}

/**
 * The value of a token inside a named media query.
 *
 * The token file declares `--fs-title` TWICE: the default and the 900px
 * switch. `tokenMap` keeps the first of each name - the default - so the
 * switch has to be read from the media block itself.
 */
function tokenInMedia(css: string, query: string, name: string): string | undefined {
  const rules = scanRules(stripCssComments(css));
  for (const rule of rules) {
    if (rule.parent === null) continue;
    const parent = rules[rule.parent];
    if (parent === undefined || !parent.atRule) continue;
    if (!parent.selector.includes(query)) continue;
    for (const declaration of rule.declarations) {
      const colon = declaration.indexOf(':');
      if (colon < 0) continue;
      if (declaration.slice(0, colon).trim() !== name) continue;
      return declaration.slice(colon + 1).trim();
    }
  }
  return undefined;
}

/** The declaration of one property in a rule body, or undefined. */
function declarationOf(body: string, property: string): string | undefined {
  for (const declaration of body.split(';')) {
    const colon = declaration.indexOf(':');
    if (colon < 0) continue;
    if (declaration.slice(0, colon).trim() !== property) continue;
    return declaration.slice(colon + 1).trim();
  }
  return undefined;
}

/** The compensation expression the Overview title must declare. */
const COMPENSATION = 'calc((var(--fs-display) - var(--fs-title)) * var(--lh-heading))';

describe('the pane title role (14-05, D-12)', () => {
  it('the Overview heading carries the title role and keeps its id', () => {
    const source = sourceOf('Overview.svelte');
    expect(source).toContain('id="overview-heading"');
    expect(source).toMatch(/<h2[^>]*class="[^"]*\bt-title\b[^"]*"/);
    expect(source).toMatch(/<h2[^>]*class="[^"]*\bsection-title\b[^"]*"/);
  });

  it('the DashboardSection heading carries the title role', () => {
    const source = sourceOf('DashboardSection.svelte');
    expect(source).toMatch(/<h2[^>]*class="[^"]*\bt-title\b[^"]*"/);
    expect(source).toMatch(/<h2[^>]*class="[^"]*\bsection-title\b[^"]*"/);
  });

  it('the phone bar title carries the heading role, not the title role', () => {
    const source = sourceOf('DetailPane.svelte');
    const classes = source.match(/class="([^"]*\bphone-title\b[^"]*)"/)?.[1] ?? '';
    expect(classes, 'the phone bar title element is present').not.toBe('');
    // 18px so the longest pane name fits the one-line bar at 375px and 320px.
    expect(classes).toMatch(/\bt-heading\b/);
    expect(classes).not.toMatch(/\bt-title\b/);
  });

  it('no title rule competes with the role: no local size, weight or line height', () => {
    for (const filename of ['DashboardSection.svelte', 'Overview.svelte']) {
      const body = ruleDeclarations(styleOf(filename), '.section-title');
      expect(body, `${filename} declares a .section-title rule`).not.toBe('');
      expect(
        declarationOf(body, 'font-size'),
        `${filename} leaves the size to the role`,
      ).toBeUndefined();
      expect(
        declarationOf(body, 'font-weight'),
        `${filename} leaves the weight to the role`,
      ).toBeUndefined();
      expect(
        declarationOf(body, 'line-height'),
        `${filename} leaves the line height to the role`,
      ).toBeUndefined();
    }
  });

  it('the role itself reads the title token, and the token switches at 900px', () => {
    const tokens = tokenMap(readTokenSource());
    expect(tokens.get('--fs-title'), 'the default title size is the display size').toBe(
      'var(--fs-display)',
    );
    expect(
      tokenInMedia(readTokenSource(), 'min-width: 900px', '--fs-title'),
      'the title size is the stat size at 900px and up',
    ).toBe('var(--fs-stat)');
  });
});

describe('the Overview title compensates its line box (14-05, D-16)', () => {
  it('the margin is the calc of the tokens, written out', () => {
    const body = ruleDeclarations(styleOf('Overview.svelte'), '.section-title');
    expect(body, 'the Overview declares a .section-title rule').not.toBe('');
    expect(declarationOf(body, 'margin')).toBe(`0 0 ${COMPENSATION}`);
  });

  it('the compensation is a margin only: no line height, no height, no overflow', () => {
    const body = ruleDeclarations(styleOf('Overview.svelte'), '.section-title');
    expect(declarationOf(body, 'line-height')).toBeUndefined();
    expect(declarationOf(body, 'height')).toBeUndefined();
    expect(declarationOf(body, 'overflow')).toBeUndefined();
  });

  it('the compensation is -7.8px at 900px and up, and the title row stays 33.8px', () => {
    const tokens = tokenMap(readTokenSource());
    const display = number(tokens.get('--fs-display'));
    const stat = number(tokens.get('--fs-stat'));
    const lineHeight = number(tokens.get('--lh-heading'));

    // The switch: `--fs-title` is `--fs-stat` from 900px up.
    expect(tokenInMedia(readTokenSource(), 'min-width: 900px', '--fs-title')).toBe(
      'var(--fs-stat)',
    );

    const margin = (display - stat) * lineHeight;
    expect(margin).toBeCloseTo(-7.8, 5);

    const lineBox = stat * lineHeight;
    expect(lineBox).toBeCloseTo(41.6, 5);

    // The title block's outer height: the taller line box minus the margin.
    expect(lineBox + margin).toBeCloseTo(33.8, 5);
    // Today's row: 26px x 1.3.
    expect(display * lineHeight).toBeCloseTo(33.8, 5);
  });

  it('the compensation is 0 below 900px, where the title size is the display size', () => {
    const tokens = tokenMap(readTokenSource());
    const display = number(tokens.get('--fs-display'));
    const lineHeight = number(tokens.get('--lh-heading'));

    // Below 900px `--fs-title` IS `--fs-display`, so the difference is zero.
    const margin = (display - display) * lineHeight;
    expect(margin).toBeCloseTo(0, 5);
  });

  it('the other panes do not compensate: their title rows grow by design', () => {
    const body = ruleDeclarations(styleOf('DashboardSection.svelte'), '.section-title');
    expect(body, 'the DashboardSection declares a .section-title rule').not.toBe('');
    const margin = declarationOf(body, 'margin');
    expect(margin, 'no negative margin on the pane titles').not.toContain('-');
    expect(margin).not.toContain('calc(');
  });
});
