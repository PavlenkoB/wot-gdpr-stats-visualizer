import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { scanRules } from '../../helpers/css.ts';
import { TOKENS_CSS, TYPE_CSS, readSrcFiles } from '../../helpers/styles.ts';
import {
  ROLE_NAMES,
  TOKENS_CSS_NAME,
  colourOffenders,
  cssOf,
  declarationLineOffenders,
  declaredOnceOffenders,
  fontOffenders,
  isSpacingProperty,
  nestingOffenders,
  networkOffenders,
  roleOffenders,
  sharedNameOffenders,
  spacingOffenders,
  styleAttributeOffenders,
  tokenScaleOffenders,
  type SourceEntry,
} from '../../helpers/token-guards.ts';

// =============================================================================
// The design-token guards (Phase 14, plan 14-03, D-02 to D-07 and D-14).
// =============================================================================
//
// WHAT THIS PINS
//   The rules the UI-SPEC names, read on the SOURCE:
//
//   G1  the type of a file: a size, a weight and a line height off
//       the shared scale, never a raw px;
//   G3  the spacing of a file: the scale, `auto`, `0` or a `calc()`;
//   G4  no colour literal outside the token file;
//   G5  the shared names are defined once, in `src/styles/`;
//   G6a one declaration per line;
//   G6b a rule that extends a sibling is nested under it with `&`.
//
//   And, in addition:
//   - no `url()` and no `@import` in any CSS (the zero-network promise);
//   - no inline `style=` attribute (the shipped CSP blocks it);
//   - every custom property is declared in `src/styles/tokens.css` and only
//     there;
//   - the type scale is exactly 12, 14, 18, 26, 32 and 56px, and no size is
//     below 12px;
//   - `src/styles/type.css` holds exactly the nine `.t-*` roles.
//
// WHY THE OFFENDER LOGIC LIVES IN A HELPER
//   `tests/helpers/token-guards.ts` holds the offender functions as PURE
//   functions over a source string. Three regular expressions cannot read
//   nested, token-based source: a `[^}]*` body stops at the first nested
//   brace, `var(--fs-*)` reads as an offender, and a sweep over an empty match
//   list passes vacuously. Keeping the logic in a helper lets this file feed
//   it SYNTHETIC input - every rule has a passing and a failing self-test -
//   and lets a one-off scratch script ask the same questions without running
//   a test.
//
// NO ALLOWLIST
//   The panes were migrated one plan at a time (D-14) behind a temporary list
//   of pending files. Plan 14-21 deleted that list, so every rule below is
//   permanent and applies to EVERY file under `src/` and to `src/app.css`.
//
// EVERY SWEEP IS NON-VACUOUS
//   A sweep that matched nothing would pass, so each one asserts that it
//   visited files and that it read declarations.
// =============================================================================

/** Every source file under `src/`. */
const SRC_FILES = readSrcFiles(['.svelte', '.css', '.ts']);

/** A synthetic CSS file. */
const cssFile = (name: string, css: string): SourceEntry => ({ name, source: css });

/** A synthetic Svelte file whose only content is a style block. */
const svelteFile = (name: string, css: string): SourceEntry => ({
  name,
  source: `<style>\n${css}\n</style>`,
});

/** The property of a `prop: value` declaration. */
function propertyOf(declaration: string): string {
  const colon = declaration.indexOf(':');
  if (colon < 0) return '';
  return declaration.slice(0, colon).trim().toLowerCase();
}

/** The number of declarations of one property in a stylesheet, or of any property. */
function countDeclarations(css: string, property?: string): number {
  let count = 0;
  for (const rule of scanRules(css)) {
    for (const declaration of rule.declarations) {
      if (property === undefined || propertyOf(declaration) === property) count += 1;
    }
  }
  return count;
}

/** The number of spacing declarations in a stylesheet. */
function countSpacingDeclarations(css: string): number {
  let count = 0;
  for (const rule of scanRules(css)) {
    for (const declaration of rule.declarations) {
      if (isSpacingProperty(propertyOf(declaration))) count += 1;
    }
  }
  return count;
}

describe('the design-token guards (14-03)', () => {
  it('walks a real source tree, so the sweeps below are not vacuous', () => {
    expect(SRC_FILES.length, 'the walk visited the source tree').toBeGreaterThan(80);
    expect(SRC_FILES.length, 'the walk visited at least 50 files').toBeGreaterThanOrEqual(50);
    expect(
      SRC_FILES.some((file) => file.name === 'src/app.css'),
      'the walk visited src/app.css',
    ).toBe(true);
    const styled = SRC_FILES.filter(
      (file) => file.name.endsWith('.svelte') && /<style[\s>]/.test(file.source),
    );
    expect(
      styled.length,
      'the walk visited every .svelte file with a style block',
    ).toBeGreaterThanOrEqual(40);
  });
});

// =============================================================================
// G1: the type of a file reads the scale (D-01, D-06, D-07).
// =============================================================================
describe('G1: the type of a file reads the scale', () => {
  it('accepts a size, a weight and a line height off the scale', () => {
    const css = [
      '.x {',
      '  font-size: var(--fs-body);',
      '  font-weight: var(--fw-semibold);',
      '  line-height: var(--lh-tight);',
      '}',
    ].join('\n');
    expect(fontOffenders(svelteFile('src/lib/shell/Shell.svelte', css))).toEqual([]);
  });

  it('rejects a raw size, a raw weight and a raw line height', () => {
    const css = '.x { font-size: 14px; font-weight: 600; line-height: 1.4; }';
    expect(fontOffenders(svelteFile('src/lib/shell/Shell.svelte', css))).toHaveLength(3);
  });

  it('rejects a font shorthand that restates the scale', () => {
    expect(
      fontOffenders(
        svelteFile('src/lib/shell/Shell.svelte', '.x { font: 600 14px/1.4 sans-serif; }'),
      ),
    ).toHaveLength(1);
    expect(
      fontOffenders(svelteFile('src/lib/shell/Shell.svelte', '.x { font: inherit; }')),
    ).toEqual([]);
  });

  it('rejects a var() that names no size on the scale', () => {
    expect(
      fontOffenders(svelteFile('src/lib/shell/Shell.svelte', '.x { font-size: var(--fs-nope); }')),
    ).toHaveLength(1);
  });

  it('does not read the token file at all: a literal is the point there', () => {
    expect(fontOffenders(cssFile(TOKENS_CSS_NAME, ':root { --fs-body: 14px; }'))).toEqual([]);
  });
});

describe('G1: the sweep over every file', () => {
  it('reads the type of every file, and every file is clean', () => {
    // The sweep reads every file but the token file, the role file included.
    const swept = SRC_FILES.filter((file) => file.name !== TOKENS_CSS_NAME);
    expect(swept.length, 'the sweep visited files').toBeGreaterThan(0);

    const fontSizeDeclarations = swept.reduce(
      (total, file) => total + countDeclarations(cssOf(file), 'font-size'),
      0,
    );
    expect(fontSizeDeclarations, 'the sweep visited font-size declarations').toBeGreaterThan(0);

    const offenders = swept.flatMap((file) => fontOffenders(file));
    expect(offenders, 'read var(--fs-*), var(--fw-*) and var(--lh-*)').toEqual([]);
  });
});

// =============================================================================
// G3: the spacing of a file reads the scale (D-04).
// =============================================================================
describe('G3: the spacing of a file reads the scale', () => {
  it('accepts the scale, zero, auto and a calc', () => {
    const css = [
      '.x {',
      '  padding: var(--space-8) var(--space-12);',
      '  margin: 0;',
      '  gap: auto;',
      '  row-gap: calc(var(--space-4) * -1);',
      '}',
    ].join('\n');
    expect(spacingOffenders(svelteFile('src/lib/shell/Shell.svelte', css))).toEqual([]);
  });

  it('rejects a raw shorthand: every token is checked, not only the first', () => {
    expect(
      spacingOffenders(svelteFile('src/lib/shell/Shell.svelte', '.x { padding: 8px 12px; }')),
    ).toHaveLength(1);
    expect(
      spacingOffenders(
        svelteFile('src/lib/shell/Shell.svelte', '.x { padding: var(--space-8) 12px; }'),
      ),
    ).toHaveLength(1);
  });

  it('rejects a zero written as a length', () => {
    expect(
      spacingOffenders(svelteFile('src/lib/shell/Shell.svelte', '.x { margin: 0px; }')),
    ).toHaveLength(1);
  });

  it('allows -1px only in a rule that also declares clip', () => {
    expect(
      spacingOffenders(svelteFile('src/lib/shell/Shell.svelte', '.x { margin: -1px; }')),
    ).toHaveLength(1);
    expect(
      spacingOffenders(
        svelteFile('src/lib/shell/Shell.svelte', '.x { margin: -1px; clip: rect(0 0 0 0); }'),
      ),
    ).toEqual([]);
  });

  it('rejects a 6px radius but not another radius', () => {
    expect(
      spacingOffenders(svelteFile('src/lib/shell/Shell.svelte', '.x { border-radius: 6px; }')),
    ).toHaveLength(1);
    expect(
      spacingOffenders(svelteFile('src/lib/shell/Shell.svelte', '.x { border-radius: 50%; }')),
    ).toEqual([]);
    expect(
      spacingOffenders(
        svelteFile('src/lib/shell/Shell.svelte', '.x { border-radius: var(--radius-sm); }'),
      ),
    ).toEqual([]);
  });
});

describe('G3: the sweep over every file', () => {
  it('reads the spacing of every file, and every file is clean', () => {
    const swept = SRC_FILES.filter((file) => file.name !== TOKENS_CSS_NAME);
    expect(swept.length, 'the sweep visited files').toBeGreaterThan(0);

    const spacingDeclarations = swept.reduce(
      (total, file) => total + countSpacingDeclarations(cssOf(file)),
      0,
    );
    expect(spacingDeclarations, 'the sweep visited spacing declarations').toBeGreaterThan(0);

    const offenders = swept.flatMap((file) => spacingOffenders(file));
    expect(offenders, 'read var(--space-*), var(--layout-*) or 0').toEqual([]);
  });
});

// =============================================================================
// G4: no colour literal outside the token file (D-01, D-03).
// =============================================================================
describe('G4: no colour literal outside the token file', () => {
  it('rejects a hex and a colour function', () => {
    expect(
      colourOffenders(svelteFile('src/lib/shell/Shell.svelte', '.x { color: #ff0000; }')),
    ).toHaveLength(1);
    expect(
      colourOffenders(
        svelteFile('src/lib/shell/Shell.svelte', '.x { color: rgba(0, 0, 0, 0.5); }'),
      ),
    ).toHaveLength(1);
  });

  it('accepts a color-mix(): it is a token expression, not a literal', () => {
    expect(
      colourOffenders(
        svelteFile('src/lib/shell/Shell.svelte', '.x { color: color-mix(in srgb, red, blue); }'),
      ),
    ).toEqual([]);
  });

  it('does not read the token file at all: a literal is the point there', () => {
    expect(colourOffenders(cssFile(TOKENS_CSS_NAME, ':root { --danger: #c5221f; }'))).toEqual([]);
  });
});

describe('G4: the sweep over every file', () => {
  it('reads every file, and no file holds a literal', () => {
    const swept = SRC_FILES.filter((file) => file.name !== TOKENS_CSS_NAME);
    expect(swept.length, 'the sweep visited files').toBeGreaterThan(0);
    const offenders = swept.flatMap((file) => colourOffenders(file));
    expect(offenders, 'read a declared token from the token stylesheet').toEqual([]);
  });
});

// =============================================================================
// G5: the shared names are defined once, in `src/styles/` (D-02).
// =============================================================================
describe('G5: the shared names are defined once', () => {
  it('rejects a local definition of a shared name', () => {
    expect(
      sharedNameOffenders(svelteFile('src/lib/shell/Shell.svelte', '.caption { margin: 0; }')),
    ).toHaveLength(1);
    expect(
      sharedNameOffenders(svelteFile('src/lib/shell/Shell.svelte', '.t-title { color: red; }')),
    ).toHaveLength(1);
    expect(
      sharedNameOffenders(
        svelteFile('src/lib/shell/Shell.svelte', ':global(.error) { color: red; }'),
      ),
    ).toHaveLength(1);
  });

  it('accepts a name that merely starts with the same letters', () => {
    expect(
      sharedNameOffenders(svelteFile('src/lib/shell/Shell.svelte', '.error-text { color: red; }')),
    ).toEqual([]);
    expect(
      sharedNameOffenders(svelteFile('src/lib/shell/Shell.svelte', '.body-text { color: red; }')),
    ).toEqual([]);
  });

  it('accepts the shared names in `src/styles/`: that is where they live', () => {
    expect(
      sharedNameOffenders(cssFile('src/styles/utilities.css', '.caption { margin: 0; }')),
    ).toEqual([]);
    expect(sharedNameOffenders(cssFile('src/styles/type.css', '.t-title { color: red; }'))).toEqual(
      [],
    );
  });
});

describe('G5: the sweep over every file', () => {
  it('reads every file, and no file defines a shared name', () => {
    const swept = SRC_FILES.filter((file) => file.name !== TOKENS_CSS_NAME);
    expect(swept.length, 'the sweep visited files').toBeGreaterThan(0);
    const offenders = swept.flatMap((file) => sharedNameOffenders(file));
    expect(offenders, 'delete the local copy; a scoped selector outranks the shared one').toEqual(
      [],
    );
  });
});

// =============================================================================
// G6a: one declaration per line (D-05).
// =============================================================================
describe('G6a: one declaration per line', () => {
  it('accepts a block with one declaration per line', () => {
    const css = ['.x {', '  color: var(--text);', '  margin: 0;', '}'].join('\n');
    expect(declarationLineOffenders(svelteFile('src/lib/shell/Shell.svelte', css))).toEqual([]);
  });

  it('rejects two declarations on one line', () => {
    expect(
      declarationLineOffenders(
        svelteFile('src/lib/shell/Shell.svelte', '.x { color: red; margin: 0; }'),
      ),
    ).toHaveLength(1);
  });

  it('rejects an opening brace and a declaration on one line', () => {
    expect(
      declarationLineOffenders(svelteFile('src/lib/shell/Shell.svelte', '.x { color: red;')),
    ).toHaveLength(1);
  });
});

describe('G6a: the sweep over every file', () => {
  it('reads every file, and every file keeps one declaration per line', () => {
    const swept = SRC_FILES;
    expect(swept.length, 'the sweep visited files').toBeGreaterThan(0);
    const declarations = swept.reduce((total, file) => total + countDeclarations(cssOf(file)), 0);
    expect(declarations, 'the sweep visited declarations').toBeGreaterThan(0);
    const offenders = swept.flatMap((file) => declarationLineOffenders(file));
    expect(offenders, 'one declaration per line').toEqual([]);
  });
});

// =============================================================================
// G6b: a rule that extends a sibling is nested under it (D-05).
// =============================================================================
describe('G6b: a rule that extends a sibling is nested under it', () => {
  it('rejects a flat prefix pair, in either order', () => {
    const css = [
      '.a {',
      '  color: var(--text);',
      '}',
      '.a .c {',
      '  color: var(--muted);',
      '}',
    ].join('\n');
    expect(nestingOffenders(svelteFile('src/lib/shell/Shell.svelte', css))).toHaveLength(1);
    const reversed = [
      '.a .c {',
      '  color: var(--muted);',
      '}',
      '.a {',
      '  color: var(--text);',
      '}',
    ].join('\n');
    expect(nestingOffenders(svelteFile('src/lib/shell/Shell.svelte', reversed))).toHaveLength(1);
  });

  it('rejects a compound, a child and a state pair', () => {
    expect(
      nestingOffenders(svelteFile('src/lib/shell/Shell.svelte', '.a {}\n.a.b {}')),
    ).toHaveLength(1);
    expect(
      nestingOffenders(svelteFile('src/lib/shell/Shell.svelte', '.a {}\n.a > .b {}')),
    ).toHaveLength(1);
    expect(
      nestingOffenders(svelteFile('src/lib/shell/Shell.svelte', '.a {}\n.a:hover {}')),
    ).toHaveLength(1);
  });

  it('accepts a name that merely starts with the same letters', () => {
    expect(nestingOffenders(svelteFile('src/lib/shell/Shell.svelte', '.a {}\n.a-b {}'))).toEqual(
      [],
    );
  });

  it('accepts a comma-list rule as a parent: it is not a single selector', () => {
    expect(
      nestingOffenders(svelteFile('src/lib/shell/Shell.svelte', '.a, .b {}\n.a .c {}')),
    ).toEqual([]);
  });

  it('accepts the same rules written nested with &', () => {
    const css = [
      '.a {',
      '  color: var(--text);',
      '',
      '  & .c {',
      '    color: var(--muted);',
      '  }',
      '}',
    ].join('\n');
    expect(nestingOffenders(svelteFile('src/lib/shell/Shell.svelte', css))).toEqual([]);
  });
});

describe('G6b: the sweep over every file', () => {
  it('reads every file, and every file nests what it extends', () => {
    const swept = SRC_FILES;
    expect(swept.length, 'the sweep visited files').toBeGreaterThan(0);
    const offenders = swept.flatMap((file) => nestingOffenders(file));
    expect(offenders, 'nest the rule under its sibling with &').toEqual([]);
  });
});

// =============================================================================
// The network rules: a stylesheet may not reach outside the page.
// =============================================================================
describe('the network rules: a stylesheet may not reach outside the page', () => {
  it('rejects a url() and an @import in a stylesheet', () => {
    expect(
      networkOffenders(
        cssFile('src/styles/extra.css', '.x { background: url(https://example.com/a.png); }'),
      ),
    ).toHaveLength(1);
    expect(
      networkOffenders(cssFile('src/styles/extra.css', "@import 'https://example.com/a.css';")),
    ).toHaveLength(1);
  });

  it('accepts a stylesheet that reaches nothing', () => {
    expect(networkOffenders(cssFile('src/styles/extra.css', '.x { color: var(--text); }'))).toEqual(
      [],
    );
  });
});

describe('the network sweep over EVERY file', () => {
  it('reads every file under src and no stylesheet reaches out', () => {
    expect(SRC_FILES.length, 'the sweep visited files').toBeGreaterThan(80);
    const offenders = SRC_FILES.flatMap((file) => networkOffenders(file));
    expect(offenders, 'a stylesheet may not load an outside resource').toEqual([]);
  });
});

// =============================================================================
// The inline style attribute: the shipped CSP blocks it.
// =============================================================================
describe('the inline style attribute', () => {
  it('rejects a style attribute and accepts a style directive', () => {
    expect(
      styleAttributeOffenders({
        name: 'src/lib/shell/Shell.svelte',
        source: '<div style="color: red">x</div>',
      }),
    ).toHaveLength(1);
    expect(
      styleAttributeOffenders({
        name: 'src/lib/shell/Shell.svelte',
        source: '<div style:width={w}px>x</div>',
      }),
    ).toEqual([]);
  });
});

describe('the inline style sweep over EVERY file', () => {
  it('reads every markup file under src and none carries one', () => {
    const markups = SRC_FILES.filter((file) => file.name.endsWith('.svelte'));
    expect(markups.length, 'the sweep visited files').toBeGreaterThan(0);
    const offenders = markups.flatMap((file) => styleAttributeOffenders(file));
    expect(offenders, 'keep every style in a stylesheet').toEqual([]);
  });
});

// =============================================================================
// Every custom property is declared in the token file and only there (D-01).
// =============================================================================
describe('every custom property is declared in the token file and only there', () => {
  it('rejects a custom property declared in another file', () => {
    const entries: SourceEntry[] = [
      cssFile(TOKENS_CSS_NAME, ':root { --fs-body: 14px; }'),
      cssFile('src/styles/extra.css', ':root { --fs-body: 14px; }'),
    ];
    const offenders = declaredOnceOffenders(entries);
    expect(offenders).toHaveLength(1);
    expect(offenders[0]).toContain('--fs-body');
  });

  it('accepts the derived steps of the heat scale, which are declared twice by design', () => {
    const entries: SourceEntry[] = [
      cssFile(
        TOKENS_CSS_NAME,
        ':root { --heat-2: var(--heat-low); }\n@supports (color: color-mix(in srgb, red, blue)) { :root { --heat-2: color-mix(in srgb, var(--heat-low) 50%, var(--heat-mid)); } }',
      ),
    ];
    expect(declaredOnceOffenders(entries)).toEqual([]);
  });

  it('rejects a token declared twice in the token file for any other reason', () => {
    const entries: SourceEntry[] = [
      cssFile(TOKENS_CSS_NAME, ':root { --fs-body: 14px; --fs-body: 15px; }'),
    ];
    expect(declaredOnceOffenders(entries)).toHaveLength(1);
  });
});

describe('the declared-once sweep over EVERY file', () => {
  it('reads every file under src and every token lives in one file', () => {
    expect(SRC_FILES.length, 'the sweep visited files').toBeGreaterThan(80);
    const offenders = declaredOnceOffenders(SRC_FILES);
    expect(offenders, 'every custom property is declared in src/styles/tokens.css').toEqual([]);
  });
});

// =============================================================================
// The token scale: the six sizes, the five spaces and the two weights (D-06).
// =============================================================================
describe('the token scale', () => {
  it('rejects a scale that is not 12, 14, 18, 26, 32 and 56', () => {
    const css = [
      ':root {',
      '  --fs-caption: 12px;',
      '  --fs-body: 14px;',
      '  --fs-heading: 18px;',
      '  --fs-display: 26px;',
      '  --fs-stat: 30px;',
      '  --fs-hero: 56px;',
      '  --fs-title: var(--fs-display);',
      '}',
    ].join('\n');
    const offenders = tokenScaleOffenders(css);
    expect(offenders.length).toBeGreaterThan(0);
    expect(offenders.join(' ')).toContain('--fs-stat');
  });

  it('rejects a size below the 12px floor', () => {
    const css = [
      ':root {',
      '  --fs-caption: 10px;',
      '  --fs-body: 14px;',
      '  --fs-heading: 18px;',
      '  --fs-display: 26px;',
      '  --fs-stat: 32px;',
      '  --fs-hero: 56px;',
      '  --fs-title: var(--fs-display);',
      '}',
    ].join('\n');
    const offenders = tokenScaleOffenders(css);
    expect(offenders.length).toBeGreaterThan(0);
    expect(offenders.join(' ')).toContain('12');
  });
});

describe('the token scale, read from the token file', () => {
  it('holds the six sizes, the five spaces and the two weights', () => {
    const css = readFileSync(TOKENS_CSS, 'utf8');
    const offenders = tokenScaleOffenders(css);
    expect(offenders, 'the token file holds the scale').toEqual([]);
  });
});

// =============================================================================
// The nine roles, and the properties a role may set (D-06, D-07).
// =============================================================================
describe('the nine roles', () => {
  it('rejects a role that sets something a role may not set', () => {
    const css = '.t-body { color: var(--text); }';
    const offenders = roleOffenders(css);
    expect(offenders.join(' ')).toContain('color');
  });

  it('rejects a role file that does not hold exactly the nine roles', () => {
    const css = '.t-body { font-size: var(--fs-body); }';
    const offenders = roleOffenders(css);
    expect(offenders.length).toBe(ROLE_NAMES.length - 1);
  });
});

describe('the nine roles, read from the role file', () => {
  it('holds exactly the nine roles, and each sets only what a role may set', () => {
    const css = readFileSync(TYPE_CSS, 'utf8');
    const offenders = roleOffenders(css);
    expect(offenders, 'the role file holds the nine roles').toEqual([]);
  });
});
