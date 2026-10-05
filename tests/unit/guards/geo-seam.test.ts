import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { geoAliasEntries } from '../../../scripts/geo/lib/geo-alias.ts';

// =============================================================================
// The geo fixture seam (06-06 Task 3, T-06-22, D-17)
// =============================================================================
//
// The seam is the one place where a TEST artifact can reach a SHIPPED build, so
// it is guarded by reading the files that select it rather than by trusting
// them. Three properties, and each one is a different file:
//
//   1. `geoAliasEntries` answers the shipped table for an ordinary environment
//      and the fixture only for `GEO_FIXTURE=1`. If the default ever inverted,
//      every production build would ship a 377-byte table of made-up countries
//      and no browser test would notice — the fixture would be what they have
//      always seen.
//   2. `playwright.config.ts` sets the variable in `webServer.env` and NOWHERE
//      ELSE. A second assignment — in `use`, in a `test.use`, at module scope —
//      would be a path into the seam nobody is looking at.
//   3. `package.json` mentions it in no script. `prebuild`-style hooks are the
//      classic leak (RESEARCH Pitfall 5), and a script is the other classic.
//
// The fourth block is the dynamic-import scan. A dynamic `import()` in the geo
// or logins code would make Vite emit a lazy chunk that the browser requests
// AFTER load, and the zero-network check would count it (RESEARCH Pitfall 1).
// The check is a source scan because there is no instrument that observes a
// build-time decision from a unit test.
// =============================================================================

const REPO_ROOT = fileURLToPath(new URL('../../..', import.meta.url));

function readRepoFile(relativePath: string): string {
  return readFileSync(join(REPO_ROOT, relativePath), 'utf8');
}

/** Every `.ts` file under a directory, recursively. */
function tsFilesUnder(relativeDir: string): string[] {
  const found: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(join(REPO_ROOT, dir))) {
      const rel = join(dir, entry);
      if (statSync(join(REPO_ROOT, rel)).isDirectory()) walk(rel);
      else if (entry.endsWith('.ts')) found.push(rel);
    }
  };
  walk(relativeDir);
  return found;
}

/** Source with its comments stripped, so prose about `import()` is not a hit. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('the geo alias targets', () => {
  it('an ordinary environment resolves the committed shipped table', () => {
    for (const env of [{}, { GEO_FIXTURE: '' }, { GEO_FIXTURE: '0' }, { GEO_FIXTURE: 'true' }]) {
      const [entry] = geoAliasEntries(env);
      expect(entry, JSON.stringify(env)).toBeDefined();
      expect(entry!.replacement, JSON.stringify(env)).toContain(
        join('src', 'lib', 'geo', 'assets', 'country-table.bin'),
      );
    }
  });

  it('only GEO_FIXTURE=1 resolves the fixture table', () => {
    const [entry] = geoAliasEntries({ GEO_FIXTURE: '1' });
    expect(entry).toBeDefined();
    expect(entry!.replacement).toContain(join('tests', 'fixtures', 'geo', 'country-fixture.bin'));
  });

  it('keeps the query suffix, so ?inline still inlines the file', () => {
    // A replacement that swallowed the query would turn `?inline` into a plain
    // asset reference: a separate file the browser requests after load, which
    // is the exact failure the alias exists to prevent.
    const [entry] = geoAliasEntries({});
    expect(entry!.replacement).toContain('$1');
    const rewritten = '#geo/country-data?inline'.replace(entry!.find, entry!.replacement);
    expect(rewritten.endsWith('country-table.bin?inline')).toBe(true);
    expect(rewritten).not.toContain('#geo/country-data');
  });
});

describe('only Playwright may select the fixture', () => {
  it('playwright.config.ts sets GEO_FIXTURE only inside webServer.env', () => {
    const src = readRepoFile('playwright.config.ts');
    const hits = src.split('\n').map((line, i) => ({ line: i + 1, text: line }));
    const mentions = hits.filter((h) => h.text.includes('GEO_FIXTURE') && !h.text.includes(' *'));

    // The comment block above the entry names the variable several times; the
    // setting itself appears once, and the one before it is the env key.
    const settings = mentions.filter((h) => /env:\s*\{\s*GEO_FIXTURE\s*:\s*'1'\s*\}/.test(h.text));
    expect(settings.length).toBe(1);

    // And the key is inside the webServer object, not at module scope or in
    // `use` — a bare assignment anywhere else would be a second path.
    const envLine = settings[0]!.line;
    const webServerLine = hits.find((h) => /^\s*webServer:\s*\{/.test(h.text))?.line ?? -1;
    expect(webServerLine).toBeGreaterThan(0);
    expect(envLine).toBeGreaterThan(webServerLine);

    // No bare assignment, no process.env write, no second mention outside the
    // documenting comment.
    expect(src).not.toMatch(/process\.env\.GEO_FIXTURE\s*=/);
    expect(src).not.toMatch(/GEO_FIXTURE\s*=\s*'1'/);
  });

  it('vite.config.ts passes process.env through and selects nothing itself', () => {
    const src = readRepoFile('vite.config.ts');
    expect(src).toContain('geoAliasEntries(process.env)');
    // A second, config-local selector would let a stray environment reach the
    // table without the one the guard reads.
    expect(src).not.toMatch(/GEO_FIXTURE\s*===/);
    expect(src).not.toMatch(/country-fixture\.bin/);
  });

  it('vitest.config.ts always points at the fixture and never at the shipped table', () => {
    const src = readRepoFile('vitest.config.ts');
    expect(src).toContain("geoAliasEntries({ GEO_FIXTURE: '1' })");
    // A unit test that resolved the 3.4 MB table would slow every run and make
    // its country assertions a function of the DB-IP month on disk.
    expect(src).not.toMatch(/geoAliasEntries\(process\.env\)/);
  });

  it('no package.json script sets GEO_FIXTURE', () => {
    const pkg = JSON.parse(readRepoFile('package.json')) as {
      scripts?: Record<string, string>;
    };
    const offenders = Object.entries(pkg.scripts ?? {}).filter(([, body]) =>
      /GEO_FIXTURE/.test(body),
    );
    expect(offenders.map(([name]) => name)).toEqual([]);
  });

  it('no npm lifecycle hook file can set it either', () => {
    // `prebuild`, `postinstall` and friends are scripts by another name, and
    // they are the one mechanism RESEARCH Pitfall 5 warns about: Playwright
    // invokes the `vite` binary directly, so a hook that quietly selects the
    // fixture would change what a build ships without the config showing it.
    for (const file of ['.npmrc', 'package-lock.json', 'pnpm-workspace.yaml']) {
      let text: string;
      try {
        text = readRepoFile(file);
      } catch {
        continue;
      }
      expect(text, file).not.toContain('GEO_FIXTURE');
    }
  });
});

describe('no lazy chunk for the geo code (RESEARCH Pitfall 1)', () => {
  it('no module under src/lib/geo or src/lib/features/logins uses a dynamic import', () => {
    const files = [...tsFilesUnder('src/lib/geo'), ...tsFilesUnder('src/lib/features/logins')];
    // Not vacuous: an empty file list would make a `for` loop assert nothing.
    expect(files.length).toBeGreaterThan(5);

    const offenders: string[] = [];
    for (const file of files) {
      const src = stripComments(readFileSync(join(REPO_ROOT, file), 'utf8'));
      if (/(^|[^.\w])import\s*\(/.test(src)) offenders.push(relative(REPO_ROOT, file));
    }
    expect(offenders).toEqual([]);
  });
});
