import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import {
  validateCityManifest,
  type CityManifestFile,
} from '../../scripts/geo/lib/city-manifest.ts';

/**
 * What the Pages artifact CONTAINS (phase 07, plan 07-01, D-13, T-07-01,
 * T-07-02, T-07-04).
 *
 * ## Why this is a filesystem spec and not a browser one
 *
 * The trust boundary this defends is between the build machine and the public
 * internet: whatever is in `dist/` gets published. A browser can only observe
 * what the server chose to serve it; it cannot observe a file that is sitting
 * in the artifact but unreferenced. A stray fixture, a test export archive, a
 * source map, a 693 MB source CSV, or a planning file would be uploaded,
 * billed, indexed and permanently readable by anyone with the URL — and no
 * browser assertion would ever mention it.
 *
 * So this spec walks the directory tree, and it uses NO browser fixture at all:
 * `tests/unit/guards/deploy-gate.test.ts` asserts the absence of `page` and
 * `browser` from this file, so it stays runnable in the milliseconds a deploy
 * job can afford before an upload.
 *
 * ## The allowlist is positive, not negative
 *
 * Every file must match a known shape. A denylist of "bad" names would have to
 * enumerate everything that could go wrong, and would miss the next one; an
 * allowlist makes the safe set explicit and turns every surprise into a
 * failure. All offenders are collected and reported together, because a build
 * that violated six rules should take one round trip, not six.
 */

const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));

/** The directory under inspection. A deploy job may point it elsewhere. */
const DIST_DIR = process.env.DIST_DIR || 'dist';
const DIST = join(REPO_ROOT, DIST_DIR);

const EXPECTED_CITY_MONTH = process.env.EXPECT_CITY_MONTH || '';

/** Extensions permitted under `assets/`. */
const ASSET_EXTENSIONS = new Set(['.js', '.css', '.svg']);

/** The three files `geo-city-data/` may hold, the last one named by the manifest. */
const GEO_STATIC_FILES = new Set(['geo-city-data/manifest.json', 'geo-city-data/ATTRIBUTION.txt']);

/** Every file in the tree, as POSIX-separated paths relative to `DIST`. */
function walk(dir: string, prefix = ''): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const rel = prefix ? posix.join(prefix, entry) : entry;
    if (statSync(join(dir, entry)).isDirectory()) found.push(...walk(join(dir, entry), rel));
    else found.push(rel);
  }
  return found;
}

function readDist(relPath: string): Buffer {
  return readFileSync(join(DIST, ...relPath.split('/')));
}

function distFile(relPath: string): string {
  return join(DIST, ...relPath.split('/'));
}

test.describe(`the ${DIST_DIR} artifact about to be uploaded to Pages`, () => {
  test.beforeAll(() => {
    expect(
      existsSync(DIST),
      `${DIST_DIR}/ does not exist — the gate runs against a build that is already on disk, ` +
        'because a gate that rebuilt would test a build rather than the artifact that ships.',
    ).toBe(true);
  });

  test('every file in the tree is an allowlisted public file', () => {
    const manifest = existsSync(distFile('geo-city-data/manifest.json'))
      ? validateCityManifest(
          JSON.parse(readFileSync(distFile('geo-city-data/manifest.json'), 'utf8')),
        )
      : null;
    const cityContainer = manifest ? `geo-city-data/${manifest.file}` : null;

    const offenders: string[] = [];
    for (const rel of walk(DIST)) {
      if (rel === 'index.html' || rel === 'favicon.svg') continue;
      if (rel.startsWith('assets/') && ASSET_EXTENSIONS.has(extensionOf(rel))) continue;
      if (GEO_STATIC_FILES.has(rel)) continue;
      if (cityContainer !== null && rel === cityContainer) continue;
      offenders.push(rel);
    }

    // Not vacuous: an artifact that somehow enumerated zero files would pass
    // this loop without testing anything, so the known-good files are counted.
    const all = walk(DIST);
    expect(all.length, 'the artifact must contain the built app').toBeGreaterThan(2);
    expect(all).toContain('index.html');

    expect(
      offenders,
      `files that would be published and must not be (source maps, fixtures, ` +
        `archives, CSVs, planning files, anything unlisted): ${offenders.join(', ')}`,
    ).toEqual([]);
  });

  test('the city manifest is a real DB-IP manifest, for the month the build expected', () => {
    const manifest = readManifest();

    // `fixture` would mean the artifact carries the 377-byte documentation
    // country table, or a fixture city container, built for tests.
    expect(manifest.source, 'the deployed city file must come from DB-IP').toBe('dbip');

    if (EXPECTED_CITY_MONTH !== '') {
      // The build cache is keyed on the DB-IP month, so a stale month means a
      // stale download rode along. Only checked when the caller states which
      // month it intended, so a local run need not know.
      expect(manifest.month, 'the artifact must carry the month this build downloaded').toBe(
        EXPECTED_CITY_MONTH,
      );
    }

    // The container the manifest names, with the bytes and the hash it claims.
    // These are the same two values the worker checks at runtime; proving them
    // here means a mismatch is found before an upload, not by a user.
    const container = distFile(`geo-city-data/${manifest.file}`);
    expect(
      existsSync(container),
      `the manifest names ${manifest.file}, which is not in the tree`,
    ).toBe(true);
    const bytes = readFileSync(container);
    expect(bytes.byteLength).toBe(manifest.bytes);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(manifest.sha256);
    expect([bytes[0], bytes[1]], 'the container is gzipped').toEqual([0x1f, 0x8b]);

    // The licence the dataset is published under must travel with it. This is
    // a CC BY 4.0 requirement, not a nicety: the file is redistributed.
    expect(existsSync(distFile('geo-city-data/ATTRIBUTION.txt'))).toBe(true);
    const attribution = readFileSync(distFile('geo-city-data/ATTRIBUTION.txt'), 'utf8');
    expect(attribution).toContain('DB-IP');
    expect(attribution).toMatch(/CC\s*BY\s*4\.0/);
  });

  test('the manifest is baked into a built chunk, so the city file existed BEFORE this build', () => {
    const manifest = readManifest();

    // `loadCityManifestFile` runs while Vite evaluates its config, and its
    // answer becomes `__GEO_CITY__` in the bundle. So the file name can only
    // appear inside a chunk if the manifest was on disk when the build ran.
    // A deploy that builds first and generates the dataset afterwards ships an
    // artifact whose bundle promises a file it never baked — the opt-in button
    // appears and then 404s. This assertion is what makes the ORDER enforced
    // rather than merely documented in the workflow YAML.
    const chunks = readdirSync(join(DIST, 'assets')).filter((f) => f.endsWith('.js'));
    expect(chunks.length, 'the build must emit JavaScript chunks').toBeGreaterThan(0);
    const carriers = chunks.filter((chunk) =>
      readFileSync(join(DIST, 'assets', chunk), 'utf8').includes(manifest.file),
    );
    expect(
      carriers,
      `no built chunk mentions ${manifest.file}: the build ran before the city file existed. ` +
        'Generate the dataset first, then build.',
    ).not.toEqual([]);
  });

  test('index.html references its assets under the base and carries the CSP meta tag', () => {
    const html = readDist('index.html').toString('utf8');
    const base = process.env.VITE_BASE || '/';

    // Every reference Vite rewrote must sit under the base. A hand-edited
    // index.html is the one way to get a root-absolute URL past a correct
    // `base`, and it would 404 on every deployment.
    for (const reference of extractReferences(html)) {
      if (!reference.startsWith('/')) continue; // data: and blob: are not paths
      expect(
        reference.startsWith(base === '/' ? '/' : base),
        `${reference} is not under the base ${base}`,
      ).toBe(true);
    }

    expect(html).toContain(`href="${base}favicon.svg"`);
    expect(html).toContain('http-equiv="Content-Security-Policy"');
    // D-15: the policy ships unchanged, with no origin baked in — the same
    // build must be correct wherever it is served from. The full five-directive
    // set is asserted by the served spec; here only the shipped meta tag's
    // presence and the one non-deny directive are the artifact's business.
    expect(html).toContain("connect-src 'self'");
  });
});

/** The manifest, validated by the build's own validator rather than a second one. */
function readManifest(): CityManifestFile {
  const path = distFile('geo-city-data/manifest.json');
  expect(existsSync(path), 'the artifact must carry a city manifest').toBe(true);
  return validateCityManifest(JSON.parse(readFileSync(path, 'utf8')));
}

function extensionOf(relPath: string): string {
  const index = relPath.lastIndexOf('.');
  return index === -1 ? '' : relPath.slice(index).toLowerCase();
}

/**
 * Every `src`/`href` the document points at, as authored (so a test sees the
 * string the browser will resolve, not the resolved URL).
 */
function extractReferences(html: string): string[] {
  const found: string[] = [];
  for (const match of html.matchAll(/(?:src|href)="([^"]*)"/g)) {
    if (match[1]) found.push(match[1]);
  }
  return found;
}
