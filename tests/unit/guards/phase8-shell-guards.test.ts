import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { componentPath } from '../../helpers/components.ts';
import { readTokenSource } from '../../helpers/styles.ts';
import {
  PHONE_MAX_WIDTH_PX,
  SIDE_BY_SIDE_MIN_WIDTH_PX,
} from '../../../src/lib/shell/selection-state.ts';

// =============================================================================
// Phase 8 shell guards (plan 08-07): the master-detail shell's structural
// promises, asserted on SOURCE so they cannot rot unnoticed.
// =============================================================================
//
// WHAT THESE PIN
//   - the legacy dark-text and grey-text hex are gone from all of src, and blue
//     survives only where the UI-SPEC keeps it (focus rings, spinner);
//   - the detail pane never scrolls on its own (the PAGE scrolls), so a sticky
//     list and a sticky chart head keep one scrolling ancestor;
//   - app.css has ONE phone block and it equals the constant the selection state
//     uses, and the side-by-side threshold is the same number in both places;
//   - selection is component state only (D-03): no storage, hash, history or
//     raw HTML in the shell sources;
//   - the anchor nav and scroll-spy stay deleted (D-02);
//   - the test ids the e2e contract is written against are still in the sources;
//   - the focus-clear helper never measures the tag `nav`;
//   - (08-19) the e2e spec tree carries no retired nav hook, no skip / only /
//     fixme marker, no spec that reads a section it never opened, and a nav spec
//     within its test budget.
//
// WHY THE PATTERNS ARE COPIED RATHER THAN IMPORTED
// `stripComments` and `ruleDeclarations` are copied from
// phase5-layout-guards.test.ts: test files do not import from each other in this
// repository (that file's header gives the reason).
// =============================================================================

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SRC = path.join(REPO_ROOT, 'src');
const SHELL_DIR = path.join(SRC, 'lib', 'shell');
const APP_CSS = path.join(SRC, 'app.css');

/** Strip HTML, block and line comments from Svelte/CSS source. */
function stripComments(source: string): string {
  return source
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*/gm, '');
}

/** A regex metacharacter-safe copy of `text`. */
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * The declaration body of the FIRST rule whose selector list is EXACTLY
 * `selector` (the whole rule, anchored on a rule boundary).
 */
function ruleDeclarations(source: string, selector: string): string {
  const boundary = '(?:^|[};])';
  const pattern = new RegExp(`${boundary}\\s*${escapeRegExp(selector)}\\s*\\{([^}]*)\\}`, 'm');
  return pattern.exec(source)?.[1] ?? '';
}

/**
 * The declaration bodies of EVERY rule, at any media nesting, whose selector
 * list has a member that ENDS in `selector` (so `.shell .pane-detail` counts and
 * `.pane-detail .child` does not).
 */
function allRuleBodies(source: string, selector: string): string[] {
  const bodies: string[] = [];
  for (const rule of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const members = (rule[1] ?? '').split(',').map((member) => member.trim());
    if (members.some((member) => member === selector || member.endsWith(' ' + selector))) {
      bodies.push(rule[2] ?? '');
    }
  }
  return bodies;
}

/** Every file in src/lib/shell with its comment-stripped source. */
function shellSources(): readonly { name: string; source: string }[] {
  return readdirSync(SHELL_DIR)
    .filter((name) => name.endsWith('.svelte') || name.endsWith('.ts'))
    .sort()
    .map((name) => ({
      name,
      source: stripComments(readFileSync(path.join(SHELL_DIR, name), 'utf8')),
    }));
}

/** Every .svelte, .css and .ts file under src, with its comment-stripped source. */
function srcSources(): readonly { name: string; source: string }[] {
  const found: { name: string; source: string }[] = [];
  const visit = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (/\.(svelte|css|ts)$/.test(entry.name)) {
        found.push({
          name: path.relative(REPO_ROOT, full),
          source: stripComments(readFileSync(full, 'utf8')),
        });
      }
    }
  };
  visit(SRC);
  return found.sort((a, b) => a.name.localeCompare(b.name));
}

/** A shell source by file name, comments stripped. */
function shellSource(name: string): string {
  return stripComments(readFileSync(path.join(SHELL_DIR, name), 'utf8'));
}

describe('phase 8 shell guards (08-07)', () => {
  it('no file under src carries the legacy dark-text or grey-text hex', () => {
    // Widened from src/lib/shell to all of src (quick 261009-qbo).
    const offenders = srcSources()
      .filter(({ source }) => /#3c4043|#5f6368|#08060d/i.test(source))
      .map(({ name }) => name);

    expect(srcSources().length, 'the walk visited the source tree').toBeGreaterThan(80);
    expect(offenders, 'use var(--text) and var(--muted)').toEqual([]);
  });

  it('blue survives only in the focus ring token and the two spinner tokens, under src', () => {
    // The spinner draws the focus blue through the two shared tokens, which
    // the token file mixes from var(--focus); no component carries a blue
    // literal any more. The Dropzone drag highlight derives from var(--focus)
    // with color-mix and carries no blue literal of its own (quick 261009-qbo).
    const blue = /#1a73e8|rgba\(26,\s*115,\s*232/i;

    const offenders = srcSources()
      // The token stylesheet holds the --focus declaration, checked separately
      // below; `src/app.css` holds no declaration at all any more, and its own
      // blue check is the last assertion of this test.
      .filter(({ name }) => name !== path.join('src', 'app.css'))
      .filter(({ name }) => name !== path.join('src', 'styles', 'tokens.css'))
      .filter(({ source }) => blue.test(source))
      .map(({ name }) => name);
    expect(offenders, 'components must use var(--focus) for the ring').toEqual([]);

    // The blue literal appears exactly once in the token source, as the
    // --focus token's value, and nowhere else in it. The reader asks for the
    // DECLARATION rather than for a file, so the check survives the token's
    // move between the stylesheets.
    const tokens = stripComments(readTokenSource());
    const outsideToken = tokens.replace(/--focus:\s*#1a73e8;/i, '');
    expect(outsideToken).not.toMatch(blue);
    expect(tokens).toMatch(/--focus:\s*#1a73e8;/i);

    // Both copies of the spinner read the shared tokens.
    for (const file of [path.join('App.svelte'), path.join('lib', 'shell', 'ImportBar.svelte')]) {
      const source = stripComments(readFileSync(path.join(SRC, file), 'utf8'));
      expect(source, `${file} reads the shared spinner track`).toContain('var(--spinner-track)');
      expect(source, `${file} reads the shared still arc`).toContain('var(--spinner-arc-still)');
    }

    // And the tokens are the focus blue at the two alphas the literals carried.
    expect(tokens).toMatch(
      /--spinner-track:\s*color-mix\(in srgb,\s*var\(--focus\)\s*25%,\s*transparent\)/,
    );
    expect(tokens).toMatch(
      /--spinner-arc-still:\s*color-mix\(in srgb,\s*var\(--focus\)\s*60%,\s*transparent\)/,
    );

    // And app.css carries no blue literal of its own.
    const css = stripComments(readFileSync(APP_CSS, 'utf8')).replace(/--focus:\s*#1a73e8;/i, '');
    expect(css).not.toMatch(blue);
  });

  it('declares no overflow on .pane-detail, in app.css or in DetailPane', () => {
    const css = stripComments(readFileSync(APP_CSS, 'utf8'));
    const detailPane = shellSource('DetailPane.svelte');

    const bodies = [
      ...allRuleBodies(css, '.pane-detail'),
      ...allRuleBodies(detailPane, '.pane-detail'),
    ];
    // The rule exists, so the check below is not vacuous.
    expect(allRuleBodies(css, '.pane-detail').length).toBeGreaterThan(0);
    expect(ruleDeclarations(css, '.pane-detail')).not.toBe('');

    for (const body of bodies) {
      expect(body, 'the page scrolls, not the detail pane').not.toMatch(/\boverflow(?:-[xy])?\s*:/);
    }
  });

  it('has exactly one phone block, and the thresholds equal the selection-state constants', () => {
    const css = stripComments(readFileSync(APP_CSS, 'utf8'));

    const maxWidths = [...css.matchAll(/@media\s*\(max-width:\s*(\d+)px\)/g)].map((match) =>
      Number(match[1]),
    );
    expect(
      maxWidths.filter((width) => width === PHONE_MAX_WIDTH_PX),
      `one @media (max-width: ${PHONE_MAX_WIDTH_PX}px) block`,
    ).toHaveLength(1);
    // The only other max-width block is the stacked-layout complement of the
    // side-by-side query, one pixel below it.
    expect(maxWidths.filter((width) => width !== PHONE_MAX_WIDTH_PX)).toEqual([
      SIDE_BY_SIDE_MIN_WIDTH_PX - 1,
    ]);

    // The sticky-list media query is the side-by-side threshold.
    expect(css).toContain(`@media (min-width: ${SIDE_BY_SIDE_MIN_WIDTH_PX}px)`);
  });

  it('keeps selection as component state: no storage, hash, history or raw HTML in the shell', () => {
    const files = [
      'Dashboard.svelte',
      'ListPane.svelte',
      'DetailPane.svelte',
      'Overview.svelte',
      'selection-state.ts',
    ];
    const banned = [
      'localStorage',
      'sessionStorage',
      'location.hash',
      'pushState',
      'replaceState',
      '{@html',
      'innerHTML',
    ];

    for (const file of files) {
      const source = shellSource(file);
      for (const token of banned) {
        expect(source, `${file} must not use ${token}`).not.toContain(token);
      }
    }
  });

  it('keeps the anchor nav and scroll-spy deleted', () => {
    expect(existsSync(path.join(SHELL_DIR, 'DashboardNav.svelte'))).toBe(false);
    expect(existsSync(path.join(SHELL_DIR, 'scroll-spy.ts'))).toBe(false);
    expect(existsSync(componentPath('DashboardNav.svelte'))).toBe(false);
  });

  it('still exposes the contract test ids the e2e specs are written against', () => {
    const joined = shellSources()
      .map(({ source }) => source)
      .join('\n');

    for (const id of [
      'list-pane',
      'list-nav',
      'detail-pane',
      'back-button-sections',
      'empty-state',
      'dropzone-main',
      'overview',
    ]) {
      expect(joined, `data-testid="${id}"`).toMatch(
        new RegExp(`data-testid=(?:"${escapeRegExp(id)}"|'${escapeRegExp(id)}')`),
      );
    }
  });

  it('focus-clear measures marked sticky chrome and never the tag nav', () => {
    const source = stripComments(readFileSync(path.join(SRC, 'lib/core/focus-clear.ts'), 'utf8'));

    expect(source).not.toMatch(/querySelector\(\s*['"`]nav['"`]\s*\)/);
    expect(source).toContain('STICKY_CHROME_SELECTOR');
    expect(source).toContain('[data-sticky-chrome]');
  });
});

// =============================================================================
// The e2e spec tree (plan 08-19): the migration cannot go green by disabling a
// test, by keeping a hook the shell no longer has, or by reading a pane no
// helper opened.
// =============================================================================

const E2E_DIR = path.join(REPO_ROOT, 'tests', 'e2e');

/** Every `.ts` file under tests/e2e (recursive, helpers included), sorted. */
function e2eFiles(dir: string = E2E_DIR): string[] {
  const found: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      found.push(...e2eFiles(full));
    } else if (name.endsWith('.ts')) {
      found.push(full);
    }
  }
  return found;
}

/** A spec-tree file as a path relative to tests/e2e with its comment-stripped source. */
function e2eSources(): readonly { name: string; source: string }[] {
  return e2eFiles().map((file) => ({
    name: path.relative(E2E_DIR, file).split(path.sep).join('/'),
    source: stripComments(readFileSync(file, 'utf8')),
  }));
}

/** The names a file imports from the e2e helpers module (`_support/helpers`). */
function helperImports(source: string): string[] {
  const names: string[] = [];
  for (const match of source.matchAll(
    /import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*['"][^'"]*_support\/helpers(?:\.ts)?['"]/g,
  )) {
    for (const entry of (match[1] ?? '').split(',')) {
      const name = entry
        .trim()
        .split(/\s+as\s+/)[0]
        ?.trim();
      if (name) names.push(name);
    }
  }
  return names;
}

describe('phase 8 e2e spec-tree guards (08-19)', () => {
  it('walks a non-empty spec tree, so the checks below are not vacuous', () => {
    const sources = e2eSources();
    expect(sources.length).toBeGreaterThan(20);
    expect(sources.some(({ name }) => name === '_support/helpers.ts')).toBe(true);
    expect(sources.some(({ name }) => name === 'shell/master-detail-nav.spec.ts')).toBe(true);
  });

  it('no spec references a retired nav hook outside comments', () => {
    const retired: readonly { what: string; pattern: RegExp }[] = [
      { what: 'the anchor nav test id', pattern: /dashboard-nav/ },
      { what: 'the per-link test id prefix', pattern: /nav-link-/ },
      {
        what: 'a tag query for the nav element',
        pattern: /(?:locator|querySelector(?:All)?)\(\s*['"`]nav\b/,
      },
    ];

    const offenders: string[] = [];
    for (const { name, source } of e2eSources()) {
      for (const { what, pattern } of retired) {
        if (pattern.test(source)) offenders.push(`${name}: ${what}`);
      }
    }
    expect(offenders, 'use list-nav / list-row-<pane> / openSection').toEqual([]);
  });

  it('no spec carries a skip, only or fixme marker', () => {
    const marker = /\.(?:only|skip|fixme)\s*\(/;
    const offenders = e2eSources()
      .filter(({ source }) => marker.test(source))
      .map(({ name }) => name);

    expect(offenders, 'a migrated test must run, not be silenced').toEqual([]);
  });

  it('a spec that reads a dashboard section imports a helper that opens it', () => {
    // helpers.ts DEFINES openSection / importAndOpen / replaceExport, so it cannot
    // import them. No other file is exempt: if one ever legitimately reads a
    // section without opening it, name it here with the reason.
    const exempt: Readonly<Record<string, string>> = {
      '_support/helpers.ts': 'defines the opening helpers',
    };
    const openers = ['openSection', 'importAndOpen', 'replaceExport'];
    const folders = ['shell', 'import', 'playtime', 'logins', 'finance', 'vehicles', 'guards'];

    const offenders: string[] = [];
    let checked = 0;
    for (const { name, source } of e2eSources()) {
      if (name in exempt || !folders.includes(name.split('/')[0] ?? '')) continue;
      if (!/dashboard-section-/.test(source)) continue;
      checked += 1;
      const imported = helperImports(source);
      if (!openers.some((opener) => imported.includes(opener))) offenders.push(name);
    }

    expect(
      checked,
      'the tripwire reaches at least the specs known to read sections',
    ).toBeGreaterThan(5);
    expect(
      offenders,
      'import openSection, importAndOpen or replaceExport from _support/helpers',
    ).toEqual([]);
  });

  it('master-detail-nav.spec.ts stays within 19 tests', () => {
    const source = e2eSources().find(
      ({ name }) => name === 'shell/master-detail-nav.spec.ts',
    )?.source;
    expect(source).toBeDefined();

    const count = [...(source ?? '').matchAll(/(?<![\w.])test\(/g)].length;
    expect(count, 'the nav spec is 15 tests; the budget allows 19').toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(19);
  });
});

// =============================================================================
// quick 261009-qbo: the notice announcer (WR-01) and the confirm panel keys (WR-05)
// =============================================================================
//
// Source-contract tests keyed on test ids, not imported symbols. The announcer is
// ONE persistent live region in App.svelte, mounted before every conditional
// branch, so it is never torn down with the import bar it speaks for (a region
// created together with its text is not announced). The bar's notice slot is only
// the visible container. The confirm panel owns its own keys (Phase 8 D-05: no
// window or document handler): Escape cancels, Tab wraps between its two buttons.
describe('notice announcer and confirm panel keys (quick 261009-qbo)', () => {
  const app = stripComments(readFileSync(path.join(SRC, 'App.svelte'), 'utf8'));

  it('ImportBar owns no live region', () => {
    const bar = shellSource('ImportBar.svelte');
    expect(bar).not.toContain('aria-live');
    expect(bar).not.toMatch(/role="status"/);
  });

  it('App.svelte mounts exactly one polite, atomic notice announcer', () => {
    expect(app.match(/data-testid="notice-announcer"/g) ?? []).toHaveLength(1);
    const element = /<p\b[^>]*data-testid="notice-announcer"[^>]*>/.exec(app)?.[0] ?? '';
    expect(element, 'the announcer element exists').not.toBe('');
    expect(element).toContain('role="status"');
    expect(element).toContain('aria-live="polite"');
    expect(element).toContain('aria-atomic="true"');
  });

  it('the announcer sits before the checking-cache branch, outside every conditional', () => {
    const announcer = app.indexOf('data-testid="notice-announcer"');
    const branch = app.indexOf("ingestClient.state === 'checking-cache'");
    expect(announcer).toBeGreaterThan(-1);
    expect(branch).toBeGreaterThan(-1);
    expect(announcer).toBeLessThan(branch);
  });

  it('ConfirmPanel handles Escape and Tab on its own root and cancels from the Escape branch', () => {
    const panel = shellSource('ConfirmPanel.svelte');
    expect(panel).toContain('Escape');
    expect(panel).toContain('Tab');
    expect(panel).toMatch(/Escape[\s\S]{0,200}oncancel\(\)/);
    expect(panel).not.toMatch(/svelte:(window|document)/);
  });
});
