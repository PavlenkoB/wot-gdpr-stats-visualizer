import { execFileSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  WORLD_SHAPES,
  WORLD_VIEWBOX,
  type WorldShape,
} from '../../../src/lib/geo/world-map.generated.ts';
import * as generated from '../../../src/lib/geo/world-map.generated.ts';

// =============================================================================
// The committed world map (06-07, ACTIVITY-06, AGENTS.md geo-assets constraint)
// =============================================================================
//
// The map the runtime draws is a plain list of `<path d="...">` produced at
// BUILD time by `scripts/geo/build-world-map.ts` and committed. Nothing under
// `src/` may import `world-atlas`, `d3-geo` or `topojson-client` (AGENTS.md:
// "Geo-map assets are build-time only"), so the shape of what is tested here is
// itself the guarantee: a module of strings, an alpha-2 key per shape, and a
// viewBox the UI-SPEC can hand straight to the `<svg>`.
//
// The invariants below are the ones a broken generation would violate
// silently — a duplicate key would make one country unreachable while still
// rendering, an empty or lower-case iso would never match a DB-IP code, and a
// changed viewBox would silently rescale every path drawn against it.
//
// Three of the guarantees are about the MAP'S TRUSTWORTHINESS rather than its
// pixels, and they are the ones that cannot be checked by looking at it:
//
//   * Reproducibility. The file is committed, so a hand edit or a regeneration
//     under different input would ship a map nobody re-derived. `--check`
//     regenerates in memory and compares byte for byte (T-06-26).
//   * Coverage. A 110m-only map has no shape at all for Singapore, Hong Kong,
//     Malta, Bahrain, Monaco or Liechtenstein, which is 61 DB-IP codes a real
//     login history reaches — every one of them would read as "not drawn".
//   * Containment. The three build-time packages must not be able to reach the
//     shipped bundle. A source scan catches a direct import; a `dist/` scan
//     catches what the bundler actually produced, which is the claim the
//     project's dependency-minimalism constraint makes.
// =============================================================================

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const GENERATOR = path.join(REPO_ROOT, 'scripts/geo/build-world-map.ts');
const GENERATED_FILE = path.join(REPO_ROOT, 'src/lib/geo/world-map.generated.ts');

/** The build-time-only packages (AGENTS.md: "Geo-map assets are build-time only"). */
const BUILD_TIME_PACKAGES = ['world-atlas', 'd3-geo', 'topojson-client'];

/**
 * The codes DB-IP can hand the map and the hybrid has no polygon for.
 *
 * `XK` is absent because the feature named Kosovo gives the hybrid one — the
 * list is what the generator emits, and this is the answer it has to match.
 */
const EXPECTED_NO_POLYGON_CODES = [
  'RE',
  'GI',
  'YT',
  'MQ',
  'GP',
  'GF',
  'TK',
  'TV',
  'UM',
  'BQ',
  'BV',
  'SJ',
  'CC',
  'CX',
];

// Read through the namespace with a cast rather than a bare named import, so a
// MISSING export fails as a named assertion ("expected undefined to equal
// ...") instead of taking the whole file down with a module link error. A test
// file that cannot load proves far less than one that says what is absent.
const NO_POLYGON_CODES = (generated as { NO_POLYGON_CODES?: readonly string[] }).NO_POLYGON_CODES;

const ISO_PATTERN = /^[A-Z]{2}$/;

function byIso(iso: string): WorldShape | undefined {
  return WORLD_SHAPES.find((shape) => shape.iso === iso);
}

/** Run the generator and return its exit status, never throwing. */
function generatorStatus(args: readonly string[]): number {
  try {
    execFileSync(process.execPath, [GENERATOR, ...args], { stdio: 'ignore' });
    return 0;
  } catch (error) {
    return (error as { status?: number }).status ?? 1;
  }
}

function readPackageJson(): {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
} {
  return JSON.parse(readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8'));
}

describe('the generated world map', () => {
  it('is a non-trivial list of country shapes', () => {
    // An empty or near-empty list still satisfies every other assertion in
    // this file, so the size is stated before anything is inspected.
    expect(WORLD_SHAPES.length).toBeGreaterThan(150);
  });

  it('uses the viewBox the UI-SPEC fixes for the map', () => {
    // The path data, the centroids and the tiny-country marker radius are all
    // expressed in these units, so a different viewBox rescales every one of
    // them against a canvas that no longer matches.
    expect(WORLD_VIEWBOX).toBe('0 0 960 500');
  });

  it('draws Germany with real path data', () => {
    const de = byIso('DE');
    expect(de).toBeDefined();
    // A move command first is what makes the string a path at all; a shape
    // whose `d` is a bare number or empty would render nothing.
    expect(de!.d.length).toBeGreaterThan(0);
    expect(de!.d.startsWith('M')).toBe(true);
  });

  it('keys every shape by two upper-case letters', () => {
    const bad = WORLD_SHAPES.filter((shape) => !ISO_PATTERN.test(shape.iso)).map((s) => s.iso);
    expect(bad).toEqual([]);
  });

  it('has no duplicate iso key', () => {
    // A second entry under one key would render twice and shade the wrong
    // country for the login history, because only one of them can be found.
    const seen = new Set<string>();
    const duplicates = new Set<string>();
    for (const shape of WORLD_SHAPES) {
      if (seen.has(shape.iso)) duplicates.add(shape.iso);
      seen.add(shape.iso);
    }
    expect([...duplicates]).toEqual([]);
  });

  it('gives every shape a centroid and a tiny flag', () => {
    for (const shape of WORLD_SHAPES) {
      expect(Number.isFinite(shape.cx), `${shape.iso} cx`).toBe(true);
      expect(Number.isFinite(shape.cy), `${shape.iso} cy`).toBe(true);
      expect(typeof shape.tiny, `${shape.iso} tiny`).toBe('boolean');
    }
  });
});

describe('the map covers what a login history reaches (D-09, RESEARCH Pattern 5)', () => {
  // The 110m atlas alone is missing 61 DB-IP codes. These are the ones a
  // player actually logs in from, so without the 50m supplement the map would
  // render the world's large countries and silently drop the small ones a
  // dedicated account visits.
  it.each(['SG', 'HK', 'MT', 'BH', 'MC', 'LI'])('draws %s', (iso) => {
    expect(byIso(iso), `${iso} has no shape`).toBeDefined();
    expect(byIso(iso)!.d.length).toBeGreaterThan(0);
  });

  it('draws Kosovo as XK, from the feature that has no id', () => {
    // Kosovo is the one DB-IP code with no ISO 3166-1 alpha-2 at all, so it
    // cannot come from an id; it comes from the feature's NAME, and that is
    // the only reason a shape exists for it at all.
    expect(byIso('XK')).toBeDefined();
  });

  it('omits Antarctica', () => {
    // It is a sixth of the map's area and holds no logins, and drawing it
    // would stretch every other country smaller to fit it.
    expect(byIso('AQ')).toBeUndefined();
  });

  it('never emits an empty iso', () => {
    expect(WORLD_SHAPES.some((shape) => shape.iso.length === 0)).toBe(false);
  });

  it('stays within the node budget the UI-SPEC states', () => {
    // "at most 238 + (tiny countries with logins) + 3" (UI-SPEC section 4).
    // D-09 is the reason the bound exists: node count scales with countries,
    // never with logins.
    expect(WORLD_SHAPES.length).toBeLessThanOrEqual(238);
  });

  it('lists exactly the DB-IP codes with no polygon, and draws none of them', () => {
    expect(NO_POLYGON_CODES).toEqual(EXPECTED_NO_POLYGON_CODES);
    const drawn = new Set(WORLD_SHAPES.map((shape) => shape.iso));
    for (const code of NO_POLYGON_CODES ?? []) {
      expect(drawn.has(code), `${code} is listed as undrawable but has a shape`).toBe(false);
    }
  });
});

describe('the committed map is exactly what the generator produces (T-06-26)', () => {
  it('passes --check on the committed file', () => {
    expect(generatorStatus(['--check'])).toBe(0);
  });

  it('fails --check on an altered copy', () => {
    // The check has to be able to FAIL. A guard that only ever passes is not a
    // guard, so the committed file is copied, one character is appended, and
    // the same check is run against the copy through `--against`. A trailing
    // newline is the smallest edit that is still a real content difference.
    const dir = mkdtempSync(path.join(tmpdir(), 'world-map-check-'));
    try {
      const copy = path.join(dir, 'world-map.generated.ts');
      cpSync(GENERATED_FILE, copy);
      // The unaltered copy must PASS through the same path first. Without
      // this, an `--against` the generator rejects as an unknown flag would
      // make the assertion below pass for the wrong reason — non-zero because
      // the option does not exist, not because the content differs.
      expect(generatorStatus(['--check', '--against', copy])).toBe(0);
      writeFileSync(copy, `${readFileSync(copy, 'utf8')}// hand edit\n`);
      expect(generatorStatus(['--check', '--against', copy])).not.toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('no mapping library can reach the shipped bundle (T-06-27)', () => {
  it('keeps the three packages out of runtime dependencies', () => {
    const { dependencies, devDependencies } = readPackageJson();
    for (const name of BUILD_TIME_PACKAGES) {
      expect(dependencies[name], `${name} is a runtime dependency`).toBeUndefined();
      expect(devDependencies[name], `${name} is not a devDependency`).toBeDefined();
    }
  });

  it('imports none of them from anywhere under src/', () => {
    // A direct import is the only way Vite can pull one into a chunk, so the
    // scan is over the whole of `src/`, comments included: a commented-out
    // import still reads as a violation to the next person who uncomments it.
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
          continue;
        }
        if (!/\.(ts|js|svelte)$/.test(entry.name)) continue;
        const text = readFileSync(full, 'utf8');
        for (const name of BUILD_TIME_PACKAGES) {
          if (text.includes(`'${name}'`) || text.includes(`"${name}"`)) {
            offenders.push(path.relative(REPO_ROOT, full));
          }
        }
      }
    };
    walk(path.join(REPO_ROOT, 'src'));
    expect(offenders).toEqual([]);
  });

  it('keeps the generated module free of imports of any kind', () => {
    // The strongest form of the guard, and the only one that does not depend
    // on where a mapping library might be reached from: the file carrying the
    // map data pulls in nothing, so it cannot drag a projection library into
    // the main chunk.
    const text = readFileSync(GENERATED_FILE, 'utf8');
    const imports = text.split('\n').filter((line) => /^\s*(import|export)\s.*\bfrom\b/.test(line));
    expect(imports).toEqual([]);
    expect(text).not.toMatch(/require\s*\(/);
  });

  it('keeps the three packages out of an existing build output', () => {
    // The source scan above is necessary and not sufficient: what the claim is
    // really about is the artifact, and a future import could reach it through
    // a path the scan does not read. This asserts against `dist/` when a build
    // has been run, and is vacuous otherwise — the build half of the plan's
    // own verification is what makes it real.
    const dist = path.join(REPO_ROOT, 'dist');
    if (!existsSync(dist)) return;
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(js|mjs|cjs|css|html|json)$/.test(entry.name)) {
          const text = readFileSync(full, 'utf8');
          for (const name of BUILD_TIME_PACKAGES) {
            if (text.includes(name)) offenders.push(path.relative(dist, full));
          }
        }
      }
    };
    walk(dist);
    expect(offenders).toEqual([]);
  });
});
