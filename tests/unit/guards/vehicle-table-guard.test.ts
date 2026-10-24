import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// =============================================================================
// The tank table stays worker-only, and the key never reaches the bundle
// (13-02 Task 2, D-08, T-13-06, T-13-09)
// =============================================================================
//
// Three claims, each checked by an instrument that is not the one it defends:
//
//   1. THE KEY IS NOT IN THE REPOSITORY. The application key reaches the
//      generator and nothing else, so no file under src/ (and no built
//      output) may name the query parameter, the environment variable or the
//      API host. The three literals are assembled from fragments HERE, so
//      this file does not contain them contiguously and cannot trip itself.
//
//   2. THE TABLE IS NEVER REQUESTED. The generated module is plain data: no
//      import statement, no dynamic import, no network call. A dynamic import
//      of the table would be a chunk request the browser makes after load,
//      which the zero-network contract counts.
//
//   3. ONLY THE WORKER REACHES THE TABLE. Exactly one module under src/ may
//      name a tank-table module in an import specifier: the module that
//      imports the generated table and hands its rows to the lookup. Every
//      other importer would pull the table into the main bundle.
//
// The claim about the import SPECIFIER is deliberately not a claim about the
// raw text: the Vehicles pane (src/lib/features/vehicles/) already uses the
// words "vehicle table" for its own per-vehicle statistics table, so a raw
// text scan would flag a module that imports nothing of the sort.
// =============================================================================

const REPO_ROOT = fileURLToPath(new URL('../../..', import.meta.url));

/** The generated table, the one module that imports it, and the worker. */
const GENERATED_TABLE = 'src/lib/features/overview/vehicle-table.generated.ts';
const THE_IMPORTER = 'src/lib/features/overview/vehicle-table.ts';
const WORKER_DIR = join('src', 'lib', 'worker');

/** The three literals that must never appear in the repository's source. */
const KEY_QUERY_PARAMETER = ['applic', 'ation', '_id'].join('');
const KEY_ENVIRONMENT_VARIABLE = ['WG_', 'APPLICATION', '_ID'].join('');
const API_HOST = ['api.', 'worldoftanks', '.eu'].join('');

/** Every source file under a directory, relative to the repository root. */
function sourceFilesUnder(dir: string): string[] {
  const found: string[] = [];
  const walk = (current: string): void => {
    for (const entry of readdirSync(join(REPO_ROOT, current))) {
      const rel = join(current, entry);
      if (statSync(join(REPO_ROOT, rel)).isDirectory()) walk(rel);
      else if (/\.(ts|js|svelte)$/.test(entry) && !entry.endsWith('.d.ts')) found.push(rel);
    }
  };
  walk(dir);
  return found;
}

/** The source with its comments blanked, so prose is not a hit. */
function withoutComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/** The module specifiers a file names. */
function specifiersIn(src: string): string[] {
  const code = withoutComments(src);
  const found: string[] = [];
  for (const match of code.matchAll(/(?:\bfrom|\bimport)\s*\(?\s*['"]([^'"]+)['"]/g)) {
    found.push(match[1]!);
  }
  return found;
}

describe('the application key is nowhere in the source', () => {
  const files = sourceFilesUnder('src');

  it('scans a real file set, not an empty one', () => {
    expect(files.length).toBeGreaterThan(50);
    expect(files).toContain(GENERATED_TABLE);
    expect(files).toContain(THE_IMPORTER);
  });

  it.each([
    ['the query parameter', KEY_QUERY_PARAMETER],
    ['the environment variable', KEY_ENVIRONMENT_VARIABLE],
    ['the API host', API_HOST],
  ])('no file under src/ names %s', (_label, literal) => {
    const needle = literal.toLowerCase();
    const hits = files.filter((file) =>
      readFileSync(join(REPO_ROOT, file), 'utf8').toLowerCase().includes(needle),
    );
    expect(hits).toEqual([]);
  });
});

describe('the generated table is plain data', () => {
  const source = readFileSync(join(REPO_ROOT, GENERATED_TABLE), 'utf8');

  it('has no import statement', () => {
    expect(source).not.toMatch(/\bimport\s+[{*'"]/);
  });

  it('has no dynamic import', () => {
    expect(source).not.toMatch(/\bimport\s*\(/);
  });

  it('makes no network call', () => {
    expect(source).not.toMatch(/\bfetch\b/);
  });

  it('holds the maintainer-generated rows, once the Terms-of-Use gate passed (13-15)', () => {
    expect(source).not.toContain('count: 0');
    expect(source).toMatch(/count: [1-9][0-9]*,/);
  });
});

describe('no module under src/ reaches the table dynamically', () => {
  const scoped = sourceFilesUnder('src/lib/features/overview').concat(sourceFilesUnder(WORKER_DIR));

  it('finds a real file set', () => {
    expect(scoped.length).toBeGreaterThan(5);
  });

  it('has no import() call expression', () => {
    const hits = scoped.filter((file) =>
      /\bimport\s*\(/.test(withoutComments(readFileSync(join(REPO_ROOT, file), 'utf8'))),
    );
    expect(hits).toEqual([]);
  });
});

describe('only the worker reaches the tank table', () => {
  const files = sourceFilesUnder('src');

  it('names a tank-table module in an import specifier from one module only', () => {
    const importers = files.filter((file) =>
      specifiersIn(readFileSync(join(REPO_ROOT, file), 'utf8')).some((specifier) =>
        specifier.includes('vehicle-table'),
      ),
    );
    // The one module that imports the generated table, and the worker files
    // that import THAT module.
    const allowed = new Set<string>([THE_IMPORTER]);
    const hits = importers.filter((file) => !allowed.has(file) && !file.startsWith(WORKER_DIR));
    expect(hits).toEqual([]);
  });

  it('lets no feature module other than the importer reach it', () => {
    const featureFiles = files.filter(
      (file) => file.startsWith(join('src', 'lib', 'features')) && file !== THE_IMPORTER,
    );
    const hits = featureFiles.filter((file) =>
      specifiersIn(readFileSync(join(REPO_ROOT, file), 'utf8')).some((specifier) =>
        specifier.includes('vehicle-table'),
      ),
    );
    expect(hits).toEqual([]);
  });
});

describe('the built output carries no key either', () => {
  const distExists = existsSync(join(REPO_ROOT, 'dist'));

  it.skipIf(!distExists)('contains none of the three key literals', () => {
    const built = sourceFilesUnder('dist');
    for (const file of built) {
      const text = readFileSync(join(REPO_ROOT, file), 'utf8').toLowerCase();
      expect(text, file).not.toContain(KEY_QUERY_PARAMETER.toLowerCase());
      expect(text, file).not.toContain(KEY_ENVIRONMENT_VARIABLE.toLowerCase());
      expect(text, file).not.toContain(API_HOST.toLowerCase());
    }
  });
});
