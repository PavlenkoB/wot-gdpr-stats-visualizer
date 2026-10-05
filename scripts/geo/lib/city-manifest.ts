/**
 * The build-time reader of the city manifest (phase 06, plan 06-11, D-13,
 * D-16, T-06-44, RESEARCH Decision 7, Pitfall 5).
 *
 * `vite.config.ts` calls {@link loadCityManifestFile} once and bakes the answer
 * into the bundle as `__GEO_CITY__`, so the page knows the name and the size of
 * the opt-in city file without asking anything. The answer is one of three:
 *
 *  - the committed FIXTURE manifest, when `GEO_FIXTURE` is `1` (the browser
 *    tests, selected in exactly one place: `playwright.config.ts`, guarded by
 *    `tests/unit/guards/geo-seam.test.ts`);
 *  - the real manifest the `geo:city` script wrote, when
 *    `public/geo-city-data/manifest.json` exists;
 *  - `null` otherwise, which is what a local or pull-request build looks like.
 *    `null` makes the opt-in unavailable (plan 06-13), so a build never offers
 *    a button that can only fail.
 *
 * `vite build` is invoked directly by Playwright, so this is a plain file read
 * at config time and never an npm lifecycle hook (RESEARCH Pitfall 5).
 *
 * ## Why the validation lives here as well as at URL construction
 *
 * The file name in the manifest ends up in a request URL. `city-fetch.ts`
 * checks it again when it builds the URL, but a malformed manifest is better
 * rejected at BUILD time, where the failure is a red build and not a button
 * that fails in a user's browser. The build script cannot import from `src/`
 * (the node project has no DOM types and no `__GEO_CITY__`), so the pattern is
 * written out here as well; `tests/unit/geo/city-manifest.test.ts` asserts the
 * two sources are identical.
 *
 * The errors name the FIELD and never print the manifest's content.
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** The manifest as `vite.config.ts` bakes it. Mirrors `city-manifest.d.ts`. */
export interface CityManifestFile {
  file: string;
  bytes: number;
  month: string;
  sha256: string;
  source: 'dbip' | 'fixture';
}

/**
 * The file name pattern. IDENTICAL to `CITY_FILE_PATTERN` in
 * `src/lib/geo/city-fetch.ts`; a unit test compares the two sources.
 */
export const CITY_FILE_PATTERN = /^(?!.*\.\.)[A-Za-z0-9_-][A-Za-z0-9._-]{0,120}\.citydb\.bin$/;

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

/** Where the committed fixture manifest lives, relative to the repository. */
export const FIXTURE_MANIFEST_PATH = path.join(
  'tests',
  'fixtures',
  'geo',
  'city-fixture-manifest.json',
);

/** Where `geo:city` writes the real manifest, relative to the repository. */
export const REAL_MANIFEST_PATH = path.join('public', 'geo-city-data', 'manifest.json');

function fail(field: string): never {
  throw new Error(`city manifest: invalid or missing "${field}"`);
}

/**
 * Checks the shape and returns a fresh object holding ONLY the known fields, so
 * an extra key in the file never reaches the bundle.
 */
export function validateCityManifest(raw: unknown): CityManifestFile {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) fail('manifest');
  const record = raw as Record<string, unknown>;

  const { file, bytes, month, sha256, source } = record;
  if (typeof file !== 'string' || !CITY_FILE_PATTERN.test(file)) fail('file');
  if (typeof bytes !== 'number' || !Number.isSafeInteger(bytes) || bytes <= 0) fail('bytes');
  if (typeof month !== 'string' || !/^\d{4}-\d{2}$/.test(month)) fail('month');
  if (typeof sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(sha256)) fail('sha256');
  if (source !== 'dbip' && source !== 'fixture') fail('source');

  return { file, bytes, month, sha256, source };
}

function readManifest(filePath: string): CityManifestFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(filePath, 'utf8'));
  } catch {
    // Never `error.message`: a JSON parse error quotes the text it choked on.
    throw new Error('city manifest: not readable as JSON');
  }
  return validateCityManifest(parsed);
}

/**
 * The manifest to bake into this build, or `null` when none exists.
 *
 * @param env the whole environment, passed through by the caller so there is no
 *   second path to the fixture switch (see `geoAliasEntries`).
 * @param root the repository root; a parameter only so a test can point it at a
 *   temporary directory.
 */
export function loadCityManifestFile(
  env: Record<string, string | undefined>,
  root: string = REPO_ROOT,
): CityManifestFile | null {
  if (env.GEO_FIXTURE === '1') return readManifest(path.join(root, FIXTURE_MANIFEST_PATH));

  const real = path.join(root, REAL_MANIFEST_PATH);
  return existsSync(real) ? readManifest(real) : null;
}
