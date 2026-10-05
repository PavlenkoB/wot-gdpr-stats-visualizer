import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { parseCityLine } from '../../../scripts/geo/lib/csv-ranges.ts';
import { dbipUrl, resolveDbipUrl, type HeadFn } from '../../../scripts/geo/lib/download.ts';

// =============================================================================
// 06-09 Task 2, TDD RED — the real-mode city build (D-13, D-14, T-06-17,
// RESEARCH A8, Pitfall 16)
// =============================================================================
//
// The fixture path is hermetic and needs no network; the REAL path is the one
// Phase 7's deploy job runs, and it is the only path that produces the shipped
// asset. Two things about it are checked here, and neither is about the bytes:
//
//   1. `--download` is a real flag, so the one command Phase 7 owns exists and
//      resolves its month through the same `resolveDbipUrl` the country build
//      uses. The test asserts the flag is ACCEPTED, not that it reaches
//      download.db-ip.com: CI has no business making a build depend on a third
//      party's availability, and a test that did would be the reason the flag
//      stayed untested for a phase.
//
//   2. A real build writes `ATTRIBUTION.txt` beside the asset. DB-IP's data is
//      CC BY 4.0 and its own instruction is a visible link-back (RESEARCH A8);
//      shipping a derived binary without the licence text beside it would be a
//      licence problem the repository caused, and a file nobody regenerates is
//      a file that goes stale, so the BUILD writes it rather than a person
//      remembering to.
//
// `--csv` is used throughout rather than `--download` wherever the assertion is
// about what a real build writes, so these tests are hermetic end to end.
// =============================================================================

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const BUILD_SCRIPT = path.join(REPO_ROOT, 'scripts/geo/build-city-dataset.ts');
const FIXTURE_CSV = path.join(REPO_ROOT, 'tests/fixtures/geo/city-fixture.csv');
const FIXTURE_GZ = path.join(REPO_ROOT, 'tests/fixtures/geo/city-fixture.gz');
const FIXTURE_MANIFEST = path.join(REPO_ROOT, 'tests/fixtures/geo/city-fixture-manifest.json');

/** Run the city build the way a contributor does: the same Node, no flags. */
function runBuild(args: readonly string[]): string {
  return execFileSync(process.execPath, [BUILD_SCRIPT, ...args], {
    encoding: 'utf8',
    cwd: REPO_ROOT,
  });
}

/** Run it expecting a usage refusal, and return what it said on stderr. */
function runBuildExpectingUsage(args: readonly string[]): string {
  let stderr = '';
  let status: number | null = null;
  try {
    runBuild(args);
  } catch (err) {
    const e = err as { status?: number | null; stderr?: string };
    status = e.status ?? null;
    stderr = e.stderr ?? '';
  }
  expect(status, `expected a usage exit, got ${status}: ${stderr}`).toBe(2);
  return stderr;
}

let workDir = '';

beforeAll(() => {
  workDir = mkdtempSync(path.join(tmpdir(), 'geo-city-build-'));
});

afterAll(() => {
  rmSync(workDir, { recursive: true, force: true });
});

describe('06-09: the real-mode city build', () => {
  it('knows --download, without making a request to prove it', () => {
    // The flag is proved by its two REFUSALS rather than by a successful
    // download, because a unit test that reaches download.db-ip.com is a test
    // CI can fail for a reason that has nothing to do with this code — and the
    // refusals are the parts a caller actually gets wrong. Both answer exit 2,
    // this script's usage code; a build that did not know the flag at all would
    // answer "unknown flag", which is a different sentence.
    const unknownFlag = /unknown flag/;
    expect(runBuildExpectingUsage(['--download', '--csv', FIXTURE_CSV])).not.toMatch(unknownFlag);
    expect(runBuildExpectingUsage(['--download', '--month', '2026-10'])).not.toMatch(unknownFlag);
    // And the refusals are the RIGHT ones, not merely different ones.
    expect(runBuildExpectingUsage(['--download', '--csv', FIXTURE_CSV])).toMatch(
      /either --csv or --download/,
    );
    expect(runBuildExpectingUsage(['--download', '--month', '2026-10'])).toMatch(/drop --month/);
  });

  it('writes the DB-IP licence note beside a real asset', () => {
    const outDir = path.join(workDir, 'attribution');
    runBuild(['--csv', FIXTURE_CSV, '--month', '2026-10', '--out-dir', outDir]);

    const note = path.join(outDir, 'ATTRIBUTION.txt');
    expect(existsSync(note), `${note} was not written`).toBe(true);
    const text = readFileSync(note, 'utf8');
    // The four facts a reader needs: what the data is, under what licence,
    // where the licence is, and where the data came from — plus the month,
    // because the month is what a stale copy has to be caught by.
    expect(text).toContain('DB-IP');
    expect(text).toContain('CC BY 4.0');
    expect(text).toContain('creativecommons.org/licenses/by/4.0');
    expect(text).toContain('db-ip.com');
    expect(text).toContain('2026-10');
  });
});

// =============================================================================
// 06-09 Task 2 — the quoted-field parser, the fixture's reproducibility, and the
// city tier's month resolution
// =============================================================================

describe('06-09: the city CSV parser meets the real layout', () => {
  /** The eight-field layout, so each case names only the field under test. */
  const HEAD = '192.0.2.0,192.0.2.31,EU,';

  it('keeps a city name that contains a comma as ONE place', () => {
    // DB-IP's own export quotes this, and a plain split(',') would turn one
    // city into four columns — a wrong answer, not a parse error.
    const row = parseCityLine(`${HEAD}MX,Jalisco,"Zapopan, Jalisco",20.72,-103.46`);
    expect(row).not.toBeNull();
    expect(row!.place).toBe('MX\tJalisco\tZapopan, Jalisco');
  });

  it('unescapes a doubled quote inside a quoted city name', () => {
    const row = parseCityLine(`${HEAD}NL,,"Utrecht""s Helling",52.09,5.12`);
    expect(row).not.toBeNull();
    expect(row!.place).toBe('NL\t\tUtrecht"s Helling');
  });

  it('accepts empty state and city fields rather than skipping the row', () => {
    // Dropping such a row would delete the range: the address would fall into
    // the surrounding unknown hole and the user would be told "no record"
    // about a prefix the database does describe.
    const row = parseCityLine(`${HEAD}AU,Victoria,,−37.81,144.96`);
    expect(row).not.toBeNull();
    expect(row!.place).toBe('AU\tVictoria\t');
  });

  it('refuses a line with the wrong field count', () => {
    // A source that gained a column must be visible in the build's skipped
    // count, not silently half-read.
    expect(parseCityLine(`${HEAD}AU,Victoria,Melbourne`)).toBeNull();
    expect(parseCityLine(`${HEAD}AU,Victoria,Melbourne,-37.81,144.96,extra,more`)).toBeNull();
  });

  it('refuses a header, a blank line, a comment and a mixed-family row', () => {
    expect(parseCityLine('start_ip,end_ip,continent,CC,state,city,latitude,longitude')).toBeNull();
    expect(parseCityLine('   ')).toBeNull();
    expect(parseCityLine('# a comment')).toBeNull();
    expect(parseCityLine('192.0.2.0,2001:db8::1,EU,DE,Bayern,München,48.14,11.58')).toBeNull();
    // No country: a row that cannot name a place is skipped, and the build's
    // skipped count is where it shows up.
    expect(parseCityLine('192.0.2.0,192.0.2.31,EU,,Bayern,München,48.14,11.58')).toBeNull();
  });

  it('parses every data line of the committed fixture CSV', () => {
    const lines = readFileSync(FIXTURE_CSV, 'utf8').split('\n');
    const rows = lines.filter((line) => line.length > 0 && !line.startsWith('#'));
    // The header plus twenty-four IPv4 blocks plus sixty IPv6 /48s.
    expect(rows).toHaveLength(1 + 24 + 60);
    const parsed = rows.map((line) => parseCityLine(line));
    expect(parsed.filter((row) => row !== null)).toHaveLength(24 + 60);
  });
});

describe('06-09: the committed city fixture cannot drift from its CSV', () => {
  // `--fixture` writes the committed paths by construction, so whatever a test
  // here regenerates is put back: a run must never leave the tree dirty, and a
  // sibling test file must never read a half-swapped pair.
  const gzBefore = readFileSync(FIXTURE_GZ);
  const manifestBefore = readFileSync(FIXTURE_MANIFEST);
  afterAll(() => {
    writeFileSync(FIXTURE_GZ, gzBefore);
    writeFileSync(FIXTURE_MANIFEST, manifestBefore);
  });

  it('reproduces the committed container and manifest', () => {
    // The same guarantee `build-scripts.test.ts` makes for the country table,
    // one tier up: a committed binary nobody can regenerate is an artifact, not
    // a build product. The check is on the DECOMPRESSED container, not the gzip
    // bytes: zlib's deflate output differs between Node releases (1214 bytes on
    // Node 26, 1204 on Node 24), and a drift test that pins them fails on every
    // Node but the one that last wrote the file.
    const before = gzBefore;
    runBuild(['--fixture']);
    const after = readFileSync(FIXTURE_GZ);
    expect(gunzipSync(after).equals(gunzipSync(before))).toBe(true);
    const regenerated = JSON.parse(readFileSync(FIXTURE_MANIFEST).toString()) as Record<
      string,
      unknown
    >;
    const committed = JSON.parse(manifestBefore.toString()) as Record<string, unknown>;
    // `bytes` and `sha256` describe the gzip, which is zlib-version dependent.
    for (const key of ['bytes', 'sha256']) {
      delete regenerated[key];
      delete committed[key];
    }
    expect(regenerated).toEqual(committed);

    const manifest = JSON.parse(manifestBefore.toString()) as {
      file: string;
      bytes: number;
      month: string;
      sha256: string;
      source: string;
    };
    // The manifest's `bytes` and `sha256` are of the GZIPPED bytes, because
    // those are what a browser receives and what the worker hashes.
    expect(manifest.bytes).toBe(before.length);
    expect(manifest.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(manifest.month).toBe('0000-00');
    expect(manifest.source).toBe('fixture');
    // The name the URL will carry is NOT the committed name — that is what
    // keeps `git check-ignore` silent while the real asset stays ignored.
    expect(manifest.file).toBe('city-fixture.citydb.bin');
  });

  it('prints one summary line carrying the month, both sizes and the hash', () => {
    const stdout = runBuild(['--fixture']);
    const lines = stdout.trim().split('\n');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('kind=city');
    expect(lines[0]).toContain('month=0000-00');
    expect(lines[0]).toMatch(/container_bytes=\d+/);
    expect(lines[0]).toMatch(/bytes=\d+/);
    expect(lines[0]).toMatch(/sha256=[0-9a-f]{64}/);
    expect(lines[0]).toMatch(/ms=\d+/);
  });
});

describe('06-09: the city tier resolves its own month', () => {
  /** A `head` answering from a fixed map, so the fallback needs no network. */
  function stubHead(statuses: Record<string, number>): { head: HeadFn; asked: string[] } {
    const asked: string[] = [];
    const head: HeadFn = async (url) => {
      asked.push(url);
      return statuses[url] ?? 404;
    };
    return { head, asked };
  }

  it('falls back exactly one month when the current month is a 404', async () => {
    // DB-IP removes old months (measured: 2026-09 and 2026-10 answered 200;
    // 2026-06 and 2025-01 answered 404), so a pinned URL is a build that breaks
    // on its own. The month actually resolved is what the manifest records and
    // what the summary line prints, so a stale build is visible rather than
    // silently dated.
    const current = dbipUrl('city', '2026-10');
    const previous = dbipUrl('city', '2026-09');
    const { head, asked } = stubHead({ [current]: 404, [previous]: 200 });
    const resolved = await resolveDbipUrl('city', new Date('2026-10-20T00:00:00Z'), head);
    expect(resolved.month).toBe('2026-09');
    expect(resolved.url).toBe(previous);
    expect(asked).toEqual([current, previous]);
  });
});
