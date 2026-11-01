import { describe, expect, it } from 'vitest';
import {
  ancestry,
  effectiveFontSizes,
  flatSelectors,
  roleClassesIn,
  resolveTokens,
  ruleDeclarations,
  scanRules,
  splitValueTokens,
  stripCssComments,
  styleText,
  tokenMap,
} from '../../helpers/css.ts';
import { readFileSync } from 'node:fs';
import { readTokenSource, TYPE_CSS } from '../../helpers/styles.ts';

// =============================================================================
// The brace-aware CSS reader (Phase 14, plan 14-01, R1).
// =============================================================================
//
// WHY THIS EXISTS
// About twenty unit tests read component sources as text and assert what a
// declaration says. They used to do it with a regular expression that read
// the text between the first `{` and the first `}` - a rule body that stops
// at the first closing brace, whether that brace belongs to the rule or to
// something NESTED inside it.
//
// The failing case is a nested rule:
//
//   .controls { ... }          the old reader finds this
//   .card { & .controls { ... } }   the old reader finds NOTHING
//
// The old reader anchored the rule on a `}` or a `;` before the selector, so
// a nested selector - which follows an opening brace - was invisible to it.
// A guard written against an invisible rule is a guard that passes vacuously,
// so the reader has to see nesting.
//
// WHAT IS PINNED HERE
//   - the scanner walks the text and knows about quotes and parentheses, so a
//     `;` or a brace inside a string does not split a rule;
//   - a rule without a trailing semicolon before its closing brace is still
//     returned;
//   - an at-rule header is a rule, and the rules inside it are its children;
//   - the rule lookup finds a nested rule by its own selector, by its own
//     selector with a leading `& ` removed, and by its FLAT selector;
//   - the value splitter splits on whitespace at parenthesis depth zero;
//   - the token map reads `--name: value;` pairs and keeps the FIRST
//     declaration of a name;
//   - the token resolver replaces only the token families that resolve to a
//     plain number or a px length.
// =============================================================================

describe('scanRules: the rule walk', () => {
  it('returns parents before children, with depth and parent index', () => {
    const rules = scanRules(`
      .card {
        color: red;
        & .controls {
          flex-direction: row;
        }
      }
    `);

    expect(rules).toHaveLength(2);
    expect(rules[0]).toMatchObject({
      selector: '.card',
      declarations: ['color: red'],
      depth: 0,
      parent: null,
      atRule: false,
    });
    expect(rules[1]).toMatchObject({
      selector: '& .controls',
      declarations: ['flex-direction: row'],
      depth: 1,
      parent: 0,
      atRule: false,
    });
  });

  it('returns a declaration written without a trailing semicolon', () => {
    const rules = scanRules(`
      .a {
        color: red
      }
    `);
    expect(rules[0]?.declarations).toEqual(['color: red']);
  });

  it('does not split a rule at a semicolon or a brace inside a quoted string', () => {
    const rules = scanRules(`
      .a {
        content: "a; b { c }";
        color: red;
      }
    `);
    expect(rules).toHaveLength(1);
    expect(rules[0]?.declarations).toEqual(['content: "a; b { c }"', 'color: red']);
  });

  it('does not split a rule at a semicolon or a brace inside parentheses', () => {
    const rules = scanRules(`
      .a {
        background: url(x{y}z;w.png);
        color: red;
      }
    `);
    expect(rules).toHaveLength(1);
    expect(rules[0]?.declarations).toEqual(['background: url(x{y}z;w.png)', 'color: red']);
  });

  it('treats an at-rule header as a rule and the rules inside it as its children', () => {
    const rules = scanRules(`
      @media (min-width: 900px) {
        :root {
          --fs-title: var(--fs-stat);
        }
      }
    `);

    expect(rules).toHaveLength(2);
    expect(rules[0]).toMatchObject({
      selector: '@media (min-width: 900px)',
      depth: 0,
      parent: null,
      atRule: true,
    });
    expect(rules[1]).toMatchObject({
      selector: ':root',
      declarations: ['--fs-title: var(--fs-stat)'],
      depth: 1,
      parent: 0,
      atRule: false,
    });
  });

  it('gives a declaration written directly inside an at-rule to that at-rule', () => {
    const rules = scanRules(`
      @media (min-width: 900px) {
        color: red;
        .b {
          color: blue;
        }
      }
    `);

    expect(rules[0]?.declarations).toEqual(['color: red']);
    expect(rules[1]?.declarations).toEqual(['color: blue']);
  });

  it('normalises a declaration to `prop: value` and keeps `!important`', () => {
    const rules = scanRules(`
      .a {
        font-size:   14px   ;
        color: red !important;
      }
    `);
    expect(rules[0]?.declarations).toEqual(['font-size: 14px', 'color: red !important']);
  });
});

describe('the rule lookup: the case the old regex loses', () => {
  const NESTED = `
    .card {
      color: red;
      & .controls {
        flex-direction: row;
      }
    }
  `;

  it('finds a nested rule the old-style extraction cannot see', () => {
    // The old reader: a rule body between the first `{` and the first `}`,
    // anchored on a `}` or a `;` before the selector.
    const old = /(?:^|[};])\s*\.controls\s*\{([^}]*)\}/m.exec(NESTED)?.[1] ?? '';
    expect(old, 'the old-style extraction finds nothing').toBe('');

    const found = ruleDeclarations(NESTED, '.controls');
    expect(found).toContain('flex-direction: row;');
  });

  it('still finds a top-level rule', () => {
    const top = `
      .controls {
        flex-direction: row;
      }
    `;
    expect(ruleDeclarations(top, '.controls')).toContain('flex-direction: row;');
  });

  it('returns the empty string when no rule matches', () => {
    expect(ruleDeclarations(NESTED, '.not-here')).toBe('');
  });

  it('matches the flat selector of a compound nest', () => {
    const css = `
      .row {
        &.footer {
          color: red;
        }
      }
    `;
    expect(ruleDeclarations(css, '.row.footer')).toContain('color: red;');
  });

  it('returns the declarations each followed by a semicolon and joined by one space', () => {
    const css = `
      .controls {
        display: flex;
        flex-direction: row;
      }
    `;
    expect(ruleDeclarations(css, '.controls')).toBe('display: flex; flex-direction: row;');
  });

  it('sees through a header comment that holds an apostrophe (14-04)', () => {
    // The scanner is not comment-aware. An apostrophe in a comment - here
    // `note's` - opens a quote the scanner never closes, so the rest of
    // the file is read as one quoted string and NO rule is found. The
    // lookup strips the comments first, exactly as `tokenMap` does, so a
    // missing rule and a mis-parsed file cannot look the same.
    const css = `/* The muted note: the note's own line. */
      .muted-note {
        color: red;
      }
    `;
    expect(ruleDeclarations(css, '.muted-note')).toBe('color: red;');
  });
});

describe('ancestry and flatSelectors', () => {
  it('walks the chain from the outermost rule to the given one', () => {
    const rules = scanRules(`
      .card {
        & .controls {
          color: red;
        }
      }
    `);
    expect(ancestry(rules, 1).map((rule) => rule.selector)).toEqual(['.card', '& .controls']);
  });

  it('replaces every `&` with the parent flat selector', () => {
    const rules = scanRules(`
      .row {
        &.footer {
          color: red;
        }
      }
    `);
    expect(flatSelectors(rules, 1)).toEqual(['.row.footer']);
  });

  it('yields one selector per comma of a selector list', () => {
    const rules = scanRules(`
      .row {
        &.footer, &.header {
          color: red;
        }
      }
    `);
    expect(flatSelectors(rules, 1)).toEqual(['.row.footer', '.row.header']);
  });
});

describe('splitValueTokens', () => {
  it('splits on whitespace at parenthesis depth zero', () => {
    expect(splitValueTokens('var(--space-8) calc(1px + 2px) 0')).toEqual([
      'var(--space-8)',
      'calc(1px + 2px)',
      '0',
    ]);
  });

  it('returns an empty list for an empty value', () => {
    expect(splitValueTokens('')).toEqual([]);
  });
});

describe('tokenMap and resolveTokens', () => {
  const SOURCE = `
    /* A contract comment may quote a declaration: --space-99: 99px; */
    .a {
      --space-16: 16px;
    }
    :root {
      --space-16: 20px;
      --fs-body: 14px;
      --space-calc: calc(1px + 2px);
    }
  `;

  it('strips comments before it reads the declarations', () => {
    expect(stripCssComments('/* --space-99: 99px; */ .a { color: red; }')).not.toContain(
      '--space-99',
    );
  });

  it('keeps the FIRST declaration of a name', () => {
    const map = tokenMap(SOURCE);
    expect(map.get('--space-16')).toBe('16px');
    expect(map.get('--fs-body')).toBe('14px');
  });

  it('does not read a declaration out of a comment', () => {
    expect(tokenMap(SOURCE).has('--space-99')).toBe(false);
  });

  it('resolves a var() whose token is a plain px length', () => {
    const map = tokenMap(SOURCE);
    expect(resolveTokens('var(--space-16)', map)).toBe('16px');
  });

  it('resolves a var() whose token is a plain number', () => {
    const map = tokenMap(SOURCE);
    expect(resolveTokens('var(--fs-body)', map)).toBe('14px');
  });

  it('leaves a var() whose token is not a plain number or px length untouched', () => {
    const map = tokenMap(SOURCE);
    expect(resolveTokens('var(--space-calc)', map)).toBe('var(--space-calc)');
  });

  it('leaves an unknown token name untouched', () => {
    const map = tokenMap(SOURCE);
    expect(resolveTokens('var(--nope)', map)).toBe('var(--nope)');
  });
});

describe('styleText', () => {
  it('returns the concatenated, comment-stripped body of every style element', () => {
    const svelte = `
      <script>const x = 1;</script>
      <style>
        /* a comment */
        .a { color: red; }
      </style>
      <style>.b { color: blue; }</style>
    `;
    const text = styleText(svelte);
    expect(text).toContain('.a { color: red; }');
    expect(text).toContain('.b { color: blue; }');
    expect(text).not.toContain('a comment');
    expect(text).not.toContain('const x');
  });

  it('returns the empty string when there is no style element', () => {
    expect(styleText('<div>hello</div>')).toBe('');
  });
});

describe('the real token file', () => {
  const map = tokenMap(readTokenSource());

  it('reads the spacing scale', () => {
    expect(map.get('--space-16')).toBe('16px');
  });

  it('keeps the FIRST --fs-title, the default rather than the 900px override', () => {
    expect(map.get('--fs-title')).toBe('var(--fs-display)');
  });
});

describe('roleClassesIn', () => {
  it('finds a role in a static class attribute', () => {
    expect(roleClassesIn('<p class="row t-note">x</p>')).toEqual(['t-note']);
  });

  it('finds a role in a class: directive', () => {
    expect(roleClassesIn('<p class:t-note-strong={on}>x</p>')).toEqual(['t-note-strong']);
  });

  it('finds the roles in the string literals of a class expression', () => {
    const source = `<p class={on ? 't-note-strong' : 't-note'}>x</p>`;
    expect(roleClassesIn(source).sort()).toEqual(['t-note', 't-note-strong']);
  });

  it('finds a role inside an interpolation of a quoted class attribute', () => {
    const source = `<h3 class="multi-name {idOnly ? 't-note-strong id-only' : 't-heading'}">x</h3>`;
    expect(roleClassesIn(source).sort()).toEqual(['t-heading', 't-note-strong']);
  });

  it('returns each role once', () => {
    expect(roleClassesIn('<p class="t-note"></p><p class="t-note"></p>')).toEqual(['t-note']);
  });

  it('does not find a role named only in a comment', () => {
    expect(roleClassesIn('<!-- <p class="t-note"> -->\n<p class="row">x</p>')).toEqual([]);
  });

  it('does not find a role named in the style block as a selector', () => {
    const source = '<p class="row">x</p>\n<style>\n  .t-note { color: red; }\n</style>';
    expect(roleClassesIn(source)).toEqual([]);
  });

  it('does not find a role that is only part of a longer class name', () => {
    expect(roleClassesIn('<p class="row-t-note foo_t-note">x</p>')).toEqual([]);
  });

  it('does not find a name outside the t- family', () => {
    expect(roleClassesIn('<p class="note body">x</p>')).toEqual([]);
  });
});

describe('effectiveFontSizes', () => {
  const tokens = new Map([['--fs-body', '14px']]);
  const typeCss = '.t-note { font-size: var(--fs-body); font-weight: 400; }';

  it('yields the declared size and then the role size', () => {
    const source = '<p class="t-note">x</p>\n<style>\n  p { font-size: 16px; }\n</style>';
    expect(effectiveFontSizes(source, tokens, typeCss)).toEqual([16, 14]);
  });

  it('resolves a token in a declaration', () => {
    const source = '<p>x</p><style>p { font-size: var(--fs-body); }</style>';
    expect(effectiveFontSizes(source, tokens, typeCss)).toEqual([14]);
  });

  it('counts a role alone once its declaration has moved out of the style block', () => {
    const source = '<p class="t-note">x</p><style>p { color: red; }</style>';
    expect(effectiveFontSizes(source, tokens, typeCss)).toEqual([14]);
  });

  it('yields an empty list for a source with neither', () => {
    expect(effectiveFontSizes('<p class="row">x</p>', tokens, typeCss)).toEqual([]);
  });

  it('yields no size for a role the role file does not define', () => {
    expect(effectiveFontSizes('<p class="t-nope">x</p>', tokens, typeCss)).toEqual([]);
  });

  it('reads the real role file', () => {
    const real = readFileSync(TYPE_CSS, 'utf8');
    const realTokens = tokenMap(readTokenSource());
    expect(effectiveFontSizes('<p class="t-note"></p>', realTokens, real)).toEqual([14]);
    expect(effectiveFontSizes('<p class="t-note-strong"></p>', realTokens, real)).toEqual([14]);
  });
});
