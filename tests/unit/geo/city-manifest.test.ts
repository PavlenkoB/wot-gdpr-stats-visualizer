import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CITY_FILE_PATTERN as SCRIPT_PATTERN,
  FIXTURE_MANIFEST_PATH,
  REAL_MANIFEST_PATH,
  loadCityManifestFile,
  validateCityManifest,
} from '../../../scripts/geo/lib/city-manifest.ts';
import { CITY_FILE_PATTERN } from '../../../src/lib/geo/city-fetch.ts';

// =============================================================================
// The build-time city manifest (06-11 Task 2, T-06-44, RESEARCH Decision 7)
// =============================================================================

const REPO_ROOT = fileURLToPath(new URL('../../..', import.meta.url));

const GOOD = {
  file: 'city-2026-10.citydb.bin',
  bytes: 11_877_710,
  month: '2026-10',
  sha256: 'a'.repeat(64),
  source: 'dbip',
} as const;

let root: string;

function writeManifest(relative: string, content: unknown): void {
  const target = path.join(root, relative);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, typeof content === 'string' ? content : JSON.stringify(content));
}

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'city-manifest-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('loadCityManifestFile', () => {
  it('returns the fixture manifest when GEO_FIXTURE is 1, even when a real one exists', () => {
    writeManifest(FIXTURE_MANIFEST_PATH, {
      ...GOOD,
      file: 'city-fixture.citydb.bin',
      source: 'fixture',
    });
    writeManifest(REAL_MANIFEST_PATH, GOOD);
    expect(loadCityManifestFile({ GEO_FIXTURE: '1' }, root)).toEqual({
      ...GOOD,
      file: 'city-fixture.citydb.bin',
      source: 'fixture',
    });
  });

  it('returns the real manifest when it exists and the fixture is not selected', () => {
    writeManifest(REAL_MANIFEST_PATH, GOOD);
    for (const env of [{}, { GEO_FIXTURE: '' }, { GEO_FIXTURE: '0' }, { GEO_FIXTURE: 'true' }]) {
      expect(loadCityManifestFile(env, root), JSON.stringify(env)).toEqual(GOOD);
    }
  });

  it('returns null when there is no real manifest, so the opt-in is unavailable', () => {
    expect(loadCityManifestFile({}, root)).toBeNull();
  });

  it('keeps only the known fields, so an extra key never reaches the bundle', () => {
    writeManifest(REAL_MANIFEST_PATH, { ...GOOD, extra: 'x', note: { nested: true } });
    expect(Object.keys(loadCityManifestFile({}, root)!).sort()).toEqual(
      ['bytes', 'file', 'month', 'sha256', 'source'].sort(),
    );
  });

  it('reads the committed fixture manifest of this repository', () => {
    const manifest = loadCityManifestFile({ GEO_FIXTURE: '1' });
    expect(manifest).not.toBeNull();
    expect(manifest!.source).toBe('fixture');
    expect(manifest!.file).toBe('city-fixture.citydb.bin');
    // The size of the committed gzip, not a literal: deflate output differs by Node release.
    expect(manifest!.bytes).toBe(
      readFileSync(path.join(REPO_ROOT, 'tests/fixtures/geo/city-fixture.gz')).length,
    );
  });

  it('is null for the real repository when no city file has been built', () => {
    // Not asserted when a developer HAS built one locally: the directory is
    // gitignored, so the answer is a fact about the machine, not the code.
    const built = (() => {
      try {
        readFileSync(path.join(REPO_ROOT, REAL_MANIFEST_PATH));
        return true;
      } catch {
        return false;
      }
    })();
    if (!built) expect(loadCityManifestFile({})).toBeNull();
  });

  it('rejects a manifest that is not JSON without quoting it', () => {
    writeManifest(REAL_MANIFEST_PATH, '{ "file": "SECRET-TEXT", ');
    expect(() => loadCityManifestFile({}, root)).toThrow('city manifest: not readable as JSON');
    expect(() => loadCityManifestFile({}, root)).not.toThrow(/SECRET-TEXT/);
  });
});

describe('validateCityManifest', () => {
  it('accepts a well-formed manifest', () => {
    expect(validateCityManifest(GOOD)).toEqual(GOOD);
    expect(validateCityManifest({ ...GOOD, source: 'fixture', month: '0000-00' })).toMatchObject({
      source: 'fixture',
    });
  });

  it.each([
    ['file', { file: 'a/b.citydb.bin' }],
    ['file', { file: '..citydb.bin' }],
    ['file', { file: 'a.citydb.bin?x=1' }],
    ['file', { file: 'a.bin' }],
    ['file', { file: 5 }],
    ['file', { file: undefined }],
    ['bytes', { bytes: 0 }],
    ['bytes', { bytes: -1 }],
    ['bytes', { bytes: 1.5 }],
    ['bytes', { bytes: '100' }],
    ['bytes', { bytes: Number.NaN }],
    ['bytes', { bytes: Number.POSITIVE_INFINITY }],
    ['month', { month: '2026-1' }],
    ['month', { month: '202610' }],
    ['month', { month: 'June 26' }],
    ['month', { month: 202610 }],
    ['sha256', { sha256: 'a'.repeat(63) }],
    ['sha256', { sha256: 'A'.repeat(64) }],
    ['sha256', { sha256: 'g'.repeat(64) }],
    ['sha256', { sha256: 'a'.repeat(65) }],
    ['source', { source: 'maxmind' }],
    ['source', { source: undefined }],
  ])('rejects a bad %s with an error that names the field', (field, patch) => {
    expect(() => validateCityManifest({ ...GOOD, ...patch })).toThrow(`"${field}"`);
  });

  it.each([null, undefined, 'text', 5, [], [GOOD]])('rejects a non-object manifest (%j)', (raw) => {
    expect(() => validateCityManifest(raw)).toThrow('"manifest"');
  });

  it('never prints the offending value', () => {
    expect(() => validateCityManifest({ ...GOOD, file: 'SECRET/../x' })).not.toThrow(/SECRET/);
  });
});

describe('the two file name patterns', () => {
  it('are one source, because the build script cannot import from src', () => {
    expect(SCRIPT_PATTERN.source).toBe(CITY_FILE_PATTERN.source);
    expect(SCRIPT_PATTERN.flags).toBe(CITY_FILE_PATTERN.flags);
  });
});

describe('vite.config.ts', () => {
  const src = readFileSync(path.join(REPO_ROOT, 'vite.config.ts'), 'utf8');

  it('bakes the manifest through the one loader, with the whole environment', () => {
    expect(src).toContain('__GEO_CITY__: JSON.stringify(loadCityManifestFile(process.env))');
  });

  it('changes connect-src from none to self and no other directive', () => {
    const policy = /const CSP_POLICY = \[([\s\S]*?)\]\.join\('; '\);/.exec(src);
    expect(policy).not.toBeNull();
    const directives = [...policy![1]!.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    expect(directives).toEqual([
      "default-src 'self'",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'none'",
      "form-action 'none'",
    ]);
  });

  it('does not claim the CSP confines the request to the city asset', () => {
    // The measured fact: a meta CSP is blind to worker traffic and a 'self'
    // host source cannot be path-restricted. The comment must not say otherwise.
    expect(src).not.toMatch(/restricts? the (fetch|request) to the city/i);
    expect(src).toMatch(/defence in depth/i);
  });
});
