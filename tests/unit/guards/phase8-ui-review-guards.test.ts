import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ancestry, flatSelectors, scanRules } from '../../helpers/css.ts';
import { contrastRatio } from '../../helpers/contrast.ts';
import { readShellSource, readTokenSource, shellHomeName } from '../../helpers/styles.ts';

// =============================================================================
// Phase 8 UI-review guards (quick 261008-x40): the top three findings of
// 08-UI-REVIEW.md, pinned on SOURCE so they cannot regress.
// =============================================================================
//
// WHAT THESE PIN
//   - no file under src carries the three pre-Phase-8 greys: text, fills, strokes
//     and the tooltip surface read var(--text), var(--muted) and var(--ink);
//   - the blue literal survives only as the `--focus` declaration in the token
//     stylesheet;
//   - native controls get one explicit element-level body size, stated as the
//     shared token since plan 14-06;
//   - the list-pane footer is sticky at the bottom of the scrolling pane at 900px
//     and above;
//   - the phone width is declared once, in the shell stylesheet, and no comment
//     claims otherwise.
//
//   The type scale and the colour-literal rules are NOT here any more: since
//   plan 14-21 they live in design-tokens-guards.test.ts (G1 and G4), on every
//   file with no folder exemption and no allow-list.
//
// WHY THE HELPERS ARE COPIED RATHER THAN IMPORTED
// Test files do not import from each other in this repository (the header of
// phase5-layout-guards.test.ts gives the reason), so `stripComments` is copied.
// =============================================================================

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SRC = path.join(REPO_ROOT, 'src');
const APP_CSS = path.join(SRC, 'app.css');

/** Strip HTML, block and line comments from Svelte/CSS/TS source. */
function stripComments(source: string): string {
  return source
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*/gm, '');
}

/** Every .svelte, .css and .ts file under `dir`, sorted. */
function walk(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...walk(full));
    } else if (/\.(svelte|css|ts)$/.test(entry.name)) {
      found.push(full);
    }
  }
  return found;
}

const FILES = walk(SRC);

/** The repo-relative name and comment-stripped source of every file under src. */
const SOURCES = FILES.map((file) => ({
  name: path.relative(REPO_ROOT, file),
  source: stripComments(readFileSync(file, 'utf8')),
}));

const APP_CSS_STRIPPED = stripComments(readFileSync(APP_CSS, 'utf8'));

/** The shell stylesheet (layout and the one phone block), comment-stripped. */
const SHELL_CSS_STRIPPED = stripComments(readShellSource());

/**
 * The token source, comment-stripped.
 *
 * The two token checks below ask for a DECLARATION, not for a file: the
 * `--focus` token and the `--text` token are declared in the token
 * stylesheet, and a reader that named the file would have to be edited every
 * time a token moved. `readTokenSource()` returns that stylesheet's text.
 */
const TOKEN_STRIPPED = stripComments(readTokenSource());

const LEGACY_GREYS = /#3c4043|#5f6368|#08060d/i;
const BLUE = /#1a73e8/i;

describe('phase 8 UI-review guards (quick 261008-x40)', () => {
  it('walks a real source tree', () => {
    const names = SOURCES.map(({ name }) => name);
    expect(names.length).toBeGreaterThan(80);
    expect(names).toContain(path.join('src', 'app.css'));
    expect(names).toContain(path.join('src', 'lib', 'ui-copy.ts'));
  });

  it('no file under src carries a legacy grey', () => {
    const offenders = SOURCES.filter(({ source }) => LEGACY_GREYS.test(source)).map(
      ({ name }) => name,
    );
    expect(offenders, 'read var(--text), var(--muted) or var(--ink)').toEqual([]);
  });

  it('the blue literal exists only as the --focus declaration', () => {
    const offenders = SOURCES.map(({ name, source }) => ({
      name,
      source:
        name === path.join('src', 'app.css') || name === path.join('src', 'styles', 'tokens.css')
          ? source.replace(/--focus:\s*#1a73e8;/i, '')
          : source,
    }))
      .filter(({ source }) => BLUE.test(source))
      .map(({ name }) => name);
    expect(offenders, 'read var(--focus)').toEqual([]);

    // The declaration itself is still there to be read.
    expect(TOKEN_STRIPPED).toMatch(/--focus:\s*#1a73e8;/i);
  });

  it('white text on the tooltip surface (the --text token) clears 7:1', () => {
    const text = /--text:\s*(#[0-9a-f]{6});/i.exec(TOKEN_STRIPPED)?.[1];
    expect(text, 'the token source declares --text').toBeDefined();
    expect(contrastRatio('#ffffff', text!)).toBeGreaterThanOrEqual(7);
  });

  it('native controls get one explicit element-level body size at every width', () => {
    const rule = /(?:^|[};])\s*button\s*,\s*input\s*,\s*select\s*,\s*textarea\s*\{([^}]*)\}/m.exec(
      APP_CSS_STRIPPED,
    );
    expect(rule, 'app.css has a `button, input, select, textarea` rule').not.toBeNull();
    // The size is the shared Body token (14px), not a raw px: the element rule
    // states the same size the page default states, so a reader can see that
    // the two agree without reading the token file.
    expect(rule![1]).toMatch(/font-size:\s*var\(--fs-body\)/);
    expect(rule![1]).toMatch(/font-family:\s*inherit/);

    // The rule is a TOP-LEVEL rule (no at-rule and no parent rule around it),
    // and app.css holds no width query at all, so it holds at every width.
    const rules = scanRules(APP_CSS_STRIPPED);
    const at = rules.findIndex((_, index) => {
      const flat = flatSelectors(rules, index);
      return (
        flat.length === 4 &&
        ['button', 'input', 'select', 'textarea'].every((selector) => flat.includes(selector))
      );
    });
    expect(at, 'the native-control rule is found by the scanner').toBeGreaterThan(-1);
    expect(rules[at]!.parent, 'the rule is a top-level rule').toBeNull();
    expect(APP_CSS_STRIPPED, 'app.css declares no media query').not.toContain('@media');
  });

  it('the list-pane footer is sticky inside the min-width 900px block', () => {
    // The rule is NESTED under its own parent since plan 14-06 (D-05), so a
    // regex over the block's text can no longer find it: the brace-aware
    // scanner finds the rule, and the flat selector is what identifies it.
    expect(SHELL_CSS_STRIPPED.length, 'the shell stylesheet was read').toBeGreaterThan(0);
    const rules = scanRules(SHELL_CSS_STRIPPED);
    const index = rules.findIndex((_, at) =>
      flatSelectors(rules, at).includes('.pane-list .import-region'),
    );
    expect(index, 'a `.pane-list .import-region` rule in the shell stylesheet').toBeGreaterThan(-1);

    // And it is inside the min-width 900px at-rule, which is the only place
    // the pane is a scroll container. The rule is nested under its own parent
    // (`.pane-list`), so the at-rule is an ANCESTOR of it, not its parent.
    const chain = ancestry(rules, index);
    const atRules = chain.filter((rule) => rule.atRule).map((rule) => rule.selector);
    expect(atRules, 'the rule sits inside the 900px at-rule').toContain(
      '@media (min-width: 900px)',
    );

    const body = rules[index]!.declarations.join('; ');
    expect(body).toMatch(/position:\s*sticky/);
    expect(body).toMatch(/bottom:\s*0/);
    expect(body).toMatch(/background:/);
  });
});

// =============================================================================
// Phase 8 UI re-review guards (quick 261009-0qw): the single phone block.
// =============================================================================
//
// The 08-UI-SPEC says the phone width is declared once. The re-audit found it
// declared in nine places across eight components. Every phone rule now lives in
// the one block in the shell stylesheet, each selector namespaced under `.shell` and the
// component's own unique hook so it is strictly more specific than the scoped
// rule it replaced and never depends on the order two stylesheets land in.

/** A phone-width query, whitespace tolerant: `max-width: 480px` in any spacing. */
const PHONE_QUERY = /max-width\s*:\s*480px/g;

describe('phase 8 UI re-review guards (quick 261009-0qw)', () => {
  it('declares exactly one phone-width query under src, and it is in the shell stylesheet', () => {
    expect(SOURCES.length, 'the walk visited the source tree').toBeGreaterThan(50);
    expect(shellHomeName(), 'the shell stylesheet has a name').not.toBe('');
    const home = path.normalize(shellHomeName());

    const counts = SOURCES.map(({ name, source }) => ({
      name,
      count: (source.match(PHONE_QUERY) ?? []).length,
    })).filter(({ count }) => count > 0);

    const outside = counts.filter(({ name }) => name !== home);
    expect(
      outside.map(({ name, count }) => `${name} (${count})`),
      'move these rules into the shell stylesheet phone block with a namespaced selector',
    ).toEqual([]);

    const inShell = counts.find(({ name }) => name === home);
    expect(inShell?.count, `${home} holds exactly one phone-width query`).toBe(1);
  });

  it('no comment still says a component repeats the phone query because a scoped rule outranks the global one', () => {
    const stale = FILES.map((file) => ({
      name: path.relative(REPO_ROOT, file),
      raw: readFileSync(file, 'utf8'),
    })).filter(({ raw }) => /scoped\s+rule\s+outranks\s+(?:the|a)\s+global/i.test(raw));
    expect(stale.map(({ name }) => name)).toEqual([]);
  });
});
