import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  currentMonthUtc,
  dbipUrl,
  downloadToFile,
  headStatus,
  previousMonth,
  resolveDbipUrl,
  type DbipKind,
  type HeadFn,
} from '../../../scripts/geo/lib/download.ts';

// =============================================================================
// The geo BUILD SCRIPTS (06-04 Task 3, ACTIVITY-06, RESEARCH Decision 1,
// T-06-17, A2)
//
// Three claims are defended here, and they are unrelated to each other:
//
//   1. MONTH RESOLUTION — the official DB-IP downloads keep only a recent
//      window, so a pinned month 404s. `resolveDbipUrl` takes the month logic
//      with an INJECTED `head`, which is what lets the whole fallback be tested
//      without a network and without a date the test cannot control.
//
//   2. THE BUILD IS REPRODUCIBLE — a gzipped source and the same source plain
//      produce byte-identical tables, so regenerating from a different transport
//      cannot silently produce a different committed artifact.
//
//   3. THE SCRIPTS RUN AS PLAIN NODE `.ts` FILES (RESEARCH assumption A2) —
//      CI runs Node 24 and this machine runs Node 26, and the whole official-
//      downloads path depends on `node script.ts` working identically on both.
//      The suite cannot run on both, so it pins the three properties that make
//      the claim portable (erasable syntax, explicit `.ts` specifiers, no
//      stripping flag) plus the CI pin that executes this file on Node 24.
// =============================================================================

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const BUILD_SCRIPT = path.join(REPO_ROOT, 'scripts/geo/build-country-table.ts');
const DOWNLOAD_LIB = path.join(REPO_ROOT, 'scripts/geo/lib/download.ts');
const FIXTURE_CSV = path.join(REPO_ROOT, 'tests/fixtures/geo/country-fixture.csv');
const FIXTURE_BIN = path.join(REPO_ROOT, 'tests/fixtures/geo/country-fixture.bin');

/** Run the build script the way a contributor does: the same Node, no flags. */
function runBuild(args: readonly string[]): string {
  return execFileSync(process.execPath, [BUILD_SCRIPT, ...args], {
    encoding: 'utf8',
    cwd: REPO_ROOT,
  });
}

/** A `head` that answers from a fixed map of URL -> status, recording the order. */
function stubHead(statuses: Record<string, number>): { head: HeadFn; asked: string[] } {
  const asked: string[] = [];
  const head: HeadFn = async (url) => {
    asked.push(url);
    return statuses[url] ?? 404;
  };
  return { head, asked };
}

/** A `head` where the current month's file is present, which is the common case. */
function foundHead(kind: DbipKind, month: string): { head: HeadFn; asked: string[] } {
  return stubHead({ [dbipUrl(kind, month)]: 200 });
}

describe('resolveDbipUrl: the official DB-IP month, with a one-month fallback', () => {
  it('builds the country URL from the current UTC month', async () => {
    const { head, asked } = foundHead('country', '2026-10');
    const resolved = await resolveDbipUrl('country', new Date('2026-10-03T12:00:00Z'), head);
    expect(resolved.url).toBe('https://download.db-ip.com/free/dbip-country-lite-2026-10.csv.gz');
    expect(resolved.month).toBe('2026-10');
    expect(asked).toHaveLength(1);
  });

  it('builds the city URL for the other tier', async () => {
    const { head } = foundHead('city', '2026-10');
    const resolved = await resolveDbipUrl('city', new Date('2026-10-03T12:00:00Z'), head);
    expect(resolved.url).toBe('https://download.db-ip.com/free/dbip-city-lite-2026-10.csv.gz');
  });

  it('reads the month in UTC, not in the machine timezone', async () => {
    // 23:30 UTC on the last day is still that month everywhere east of UTC+0:30
    // and already the next month west of it, so a local-time implementation
    // gives different answers on different machines. The Date is built with
    // Date.UTC so the assertion itself does not depend on the runner's zone.
    expect(currentMonthUtc(new Date(Date.UTC(2026, 9, 31, 23, 30)))).toBe('2026-10');
    expect(currentMonthUtc(new Date(Date.UTC(2026, 10, 1, 0, 30)))).toBe('2026-11');
  });

  it('steps back one month across a year boundary', () => {
    expect(previousMonth('2026-10')).toBe('2026-09');
    expect(previousMonth('2026-01')).toBe('2025-12');
  });

  it('falls back exactly one month when the current month is a 404', async () => {
    const current = dbipUrl('country', '2026-10');
    const previous = dbipUrl('country', '2026-09');
    const { head, asked } = stubHead({ [current]: 404, [previous]: 200 });
    const resolved = await resolveDbipUrl('country', new Date('2026-10-20T00:00:00Z'), head);
    expect(resolved.month).toBe('2026-09');
    expect(resolved.url).toBe(previous);
    // The order matters: a fallback that asked the previous month FIRST would
    // silently pin a stale table forever.
    expect(asked).toEqual([current, previous]);
  });

  it('throws after two 404s rather than guessing a third month', async () => {
    const { head, asked } = stubHead({});
    await expect(resolveDbipUrl('country', new Date('2026-10-20T00:00:00Z'), head)).rejects.toThrow(
      /2026-10.*2026-09/,
    );
    expect(asked).toHaveLength(2);
  });

  it('does not treat a non-404 as a missing month', async () => {
    // A 403 is a different problem from a vanished month, and retrying the
    // previous month would answer it with a table that is a month out of date
    // and look like success.
    const { head } = stubHead({ [dbipUrl('country', '2026-10')]: 403 });
    await expect(resolveDbipUrl('country', new Date('2026-10-20T00:00:00Z'), head)).rejects.toThrow(
      /403/,
    );
  });
});

describe('the DB-IP fetches check https on every redirect hop (T-06-17 / T-06-36)', () => {
  // `downloadToFile` and `headStatus` call the global `fetch` and have no
  // injected seam of their own, so the global is stubbed here: no test in this
  // block can reach a network.
  //
  // The stub is a ROUTER, not a canned response. The code under test follows
  // redirects itself (`redirect: 'manual'`) and tracks the current URL itself,
  // rather than reading `response.url`, so the stub answers each requested URL
  // from a table (a 3xx with a `Location`, or a final status) and RECORDS every
  // URL it is asked for. The earlier version of this block set `response.url`
  // on a single canned response, which modelled only the last URL of a
  // `redirect: 'follow'` chain and could not express an https -> http -> https
  // chain or prove that the plaintext hop was never requested; that is the gap
  // the independent audit exploited. The router also honours `redirect:
  // 'follow'` like real `fetch`, so these tests discriminate the old code from
  // the new rather than passing by accident.
  const REQUESTED = 'https://download.db-ip.com/free/dbip-country-lite-2026-10.csv.gz';
  const REFUSAL = 'dbip: refusing a non-HTTPS redirect';
  const TOO_MANY = 'dbip: too many redirects';
  const NO_LOCATION = 'dbip: redirect without a Location header';
  const PLAIN_HOP = 'http://example.test/hop?token=secret-query';
  const SECRET = 'secret-query';
  let tempDir = '';

  interface Route {
    readonly status: number;
    readonly location?: string;
    readonly body?: string | null;
  }

  /**
   * Stub `fetch` from a URL -> route table, modelling real `fetch` redirect
   * semantics: with `redirect: 'manual'` the 3xx comes back to the caller with
   * the url it was requested at; with `redirect: 'follow'` (or unset) the stub
   * follows the chain ITSELF, recording each request, and returns the final
   * response with `response.url` set to the last hop, which is exactly the view
   * the previous implementation had. Returns every URL requested and every
   * method used, in order.
   */
  function stubRoutes(routes: Record<string, Route>): { requested: string[]; methods: string[] } {
    const requested: string[] = [];
    const methods: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, init?: RequestInit) => {
        let current = String(input);
        for (let hop = 0; hop < 20; hop += 1) {
          requested.push(current);
          methods.push(init?.method ?? 'GET');
          const route = routes[current] ?? { status: 404, body: null };
          const isRedirect =
            route.status >= 300 && route.status < 400 && route.location !== undefined;
          if (isRedirect && init?.redirect !== 'manual') {
            current = new URL(route.location as string, current).href;
            continue;
          }
          const headers = route.location === undefined ? undefined : { location: route.location };
          const response = new Response(route.body ?? null, { status: route.status, headers });
          Object.defineProperty(response, 'url', { value: current });
          return response;
        }
        throw new TypeError('fetch failed');
      }),
    );
    return { requested, methods };
  }

  async function failureOf(run: () => Promise<unknown>): Promise<Error> {
    const failure = await run().then(
      () => null,
      (error: unknown) => error as Error,
    );
    expect(failure).toBeInstanceOf(Error);
    return failure as Error;
  }

  function expectNoEcho(error: Error): void {
    expect(error.message).not.toContain('example.test');
    expect(error.message).not.toContain('db-ip');
    expect(error.message).not.toContain(SECRET);
  }

  beforeAll(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'geo-redirect-'));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('downloadToFile refuses an https -> http redirect, never requests the plaintext hop, and echoes nothing', async () => {
    const { requested } = stubRoutes({
      [REQUESTED]: { status: 302, location: PLAIN_HOP },
      [PLAIN_HOP]: { status: 200, body: 'stolen' },
    });
    const target = path.join(tempDir, 'refused.csv.gz');
    const failure = await failureOf(() => downloadToFile(REQUESTED, target));
    expect(failure.message).toBe(REFUSAL);
    expectNoEcho(failure);
    expect(requested).toEqual([REQUESTED]);
  });

  it('headStatus refuses an https -> http redirect, never requests the plaintext hop, and echoes nothing', async () => {
    const { requested } = stubRoutes({
      [REQUESTED]: { status: 302, location: PLAIN_HOP },
      [PLAIN_HOP]: { status: 200 },
    });
    const failure = await failureOf(() => headStatus(REQUESTED));
    expect(failure.message).toBe(REFUSAL);
    expectNoEcho(failure);
    expect(requested).toEqual([REQUESTED]);
  });

  it('refuses an https -> http -> https chain (the bypass) for both fetches, without requesting the http hop', async () => {
    const BACK = 'https://download.db-ip.com/free/back.csv.gz';
    const routes = {
      [REQUESTED]: { status: 302, location: PLAIN_HOP },
      [PLAIN_HOP]: { status: 302, location: BACK },
      [BACK]: { status: 200, body: 'laundered' },
    };

    const download = stubRoutes(routes);
    const downloadFailure = await failureOf(() =>
      downloadToFile(REQUESTED, path.join(tempDir, 'bypass.csv.gz')),
    );
    expect(downloadFailure.message).toBe(REFUSAL);
    expectNoEcho(downloadFailure);
    expect(download.requested).not.toContain(PLAIN_HOP);
    expect(download.requested).not.toContain(BACK);

    const head = stubRoutes(routes);
    const headFailure = await failureOf(() => headStatus(REQUESTED));
    expect(headFailure.message).toBe(REFUSAL);
    expectNoEcho(headFailure);
    expect(head.requested).not.toContain(PLAIN_HOP);
    expect(head.requested).not.toContain(BACK);
  });

  it('refuses a plaintext hop reached after a legitimate https hop', async () => {
    const CDN = 'https://cdn.example.test/file.csv.gz';
    const { requested } = stubRoutes({
      [REQUESTED]: { status: 301, location: CDN },
      [CDN]: { status: 307, location: PLAIN_HOP },
    });
    const failure = await failureOf(() => headStatus(REQUESTED));
    expect(failure.message).toBe(REFUSAL);
    expect(requested).toEqual([REQUESTED, CDN]);
  });

  it('refuses a protocol-relative or scheme-less Location that resolves to plaintext', async () => {
    // `new URL('//host/x', 'https://...')` stays https; a scheme such as ftp:
    // or javascript: is not https and is refused with the same fixed message.
    for (const location of ['ftp://example.test/x', 'javascript:alert(1)']) {
      const { requested } = stubRoutes({ [REQUESTED]: { status: 302, location } });
      const failure = await failureOf(() => headStatus(REQUESTED));
      expect(failure.message).toBe(REFUSAL);
      expect(requested).toEqual([REQUESTED]);
    }
  });

  it('follows an https -> https redirect for downloadToFile and hashes the final body', async () => {
    const CDN = 'https://cdn.example.test/free/file.csv.gz';
    const { requested } = stubRoutes({
      [REQUESTED]: { status: 302, location: CDN },
      [CDN]: { status: 200, body: 'payload' },
    });
    const target = path.join(tempDir, 'redirected-ok.csv.gz');
    const result = await downloadToFile(REQUESTED, target);
    expect(requested).toEqual([REQUESTED, CDN]);
    expect(result.bytes).toBe('payload'.length);
    expect(result.sha256).toBe(createHash('sha256').update('payload').digest('hex'));
    expect(readFileSync(target, 'utf8')).toBe('payload');
  });

  it('follows an https -> https redirect for headStatus and keeps the HEAD method', async () => {
    const CDN = 'https://cdn.example.test/free/file.csv.gz';
    const first = stubRoutes({
      [REQUESTED]: { status: 302, location: CDN },
      [CDN]: { status: 200 },
    });
    expect(await headStatus(REQUESTED)).toBe(200);
    expect(first.requested).toEqual([REQUESTED, CDN]);
    expect(first.methods).toEqual(['HEAD', 'HEAD']);

    stubRoutes({
      [REQUESTED]: { status: 302, location: CDN },
      [CDN]: { status: 404 },
    });
    expect(await headStatus(REQUESTED)).toBe(404);
  });

  it('keeps the method on a 303 (both callers use HEAD or GET only)', async () => {
    const CDN = 'https://cdn.example.test/see-other.csv.gz';
    const { methods } = stubRoutes({
      [REQUESTED]: { status: 303, location: CDN },
      [CDN]: { status: 200 },
    });
    expect(await headStatus(REQUESTED)).toBe(200);
    expect(methods).toEqual(['HEAD', 'HEAD']);
  });

  it('resolves a relative Location against the current URL', async () => {
    const RESOLVED = 'https://download.db-ip.com/other/relative.csv.gz';
    const { requested } = stubRoutes({
      [REQUESTED]: { status: 302, location: '/other/relative.csv.gz' },
      [RESOLVED]: { status: 200 },
    });
    expect(await headStatus(REQUESTED)).toBe(200);
    expect(requested).toEqual([REQUESTED, RESOLVED]);

    const SIBLING = 'https://download.db-ip.com/free/sibling.csv.gz';
    const sibling = stubRoutes({
      [REQUESTED]: { status: 302, location: 'sibling.csv.gz' },
      [SIBLING]: { status: 200 },
    });
    expect(await headStatus(REQUESTED)).toBe(200);
    expect(sibling.requested).toEqual([REQUESTED, SIBLING]);
  });

  it('refuses a redirect loop with the fixed too-many-redirects message after a bounded number of requests', async () => {
    const LOOP = 'https://download.db-ip.com/free/loop.csv.gz';
    const { requested } = stubRoutes({
      [LOOP]: { status: 302, location: LOOP },
    });
    const failure = await failureOf(() => headStatus(LOOP));
    expect(failure.message).toBe(TOO_MANY);
    expectNoEcho(failure);
    // The initial request plus the five redirects the cap allows.
    expect(requested).toHaveLength(6);

    const download = stubRoutes({ [LOOP]: { status: 302, location: LOOP } });
    const downloadFailure = await failureOf(() =>
      downloadToFile(LOOP, path.join(tempDir, 'loop.csv.gz')),
    );
    expect(downloadFailure.message).toBe(TOO_MANY);
    expect(download.requested).toHaveLength(6);
  });

  it('allows exactly five redirects and refuses the sixth', async () => {
    const hop = (n: number): string => `https://download.db-ip.com/free/hop-${n}.csv.gz`;
    const routes: Record<string, Route> = {};
    for (let n = 0; n < 5; n += 1) routes[hop(n)] = { status: 302, location: hop(n + 1) };
    routes[hop(5)] = { status: 200 };
    stubRoutes(routes);
    expect(await headStatus(hop(0))).toBe(200);

    routes[hop(5)] = { status: 302, location: hop(6) };
    routes[hop(6)] = { status: 200 };
    stubRoutes(routes);
    const failure = await failureOf(() => headStatus(hop(0)));
    expect(failure.message).toBe(TOO_MANY);
  });

  it('refuses a 3xx without a Location header, with a fixed message', async () => {
    stubRoutes({ [REQUESTED]: { status: 302 } });
    const failure = await failureOf(() => headStatus(REQUESTED));
    expect(failure.message).toBe(NO_LOCATION);
    expectNoEcho(failure);

    stubRoutes({ [REQUESTED]: { status: 308 } });
    const downloadFailure = await failureOf(() =>
      downloadToFile(REQUESTED, path.join(tempDir, 'no-location.csv.gz')),
    );
    expect(downloadFailure.message).toBe(NO_LOCATION);
  });

  it('refuses an unparseable Location with the fixed refusal and no echo', async () => {
    stubRoutes({ [REQUESTED]: { status: 302, location: 'https://' } });
    const failure = await failureOf(() => headStatus(REQUESTED));
    expect(failure.message).toBe(REFUSAL);
  });

  it('headStatus refuses a plaintext initial URL without requesting it', async () => {
    const { requested } = stubRoutes({ [PLAIN_HOP]: { status: 200 } });
    const failure = await failureOf(() => headStatus(PLAIN_HOP));
    expect(failure.message).toBe(REFUSAL);
    expectNoEcho(failure);
    expect(requested).toEqual([]);
  });

  it('downloadToFile still downloads when there is no redirect', async () => {
    stubRoutes({ [REQUESTED]: { status: 200, body: 'payload' } });
    const target = path.join(tempDir, 'ok.csv.gz');
    const result = await downloadToFile(REQUESTED, target);
    expect(result.bytes).toBe('payload'.length);
    expect(readFileSync(target, 'utf8')).toBe('payload');
  });

  it('headStatus still reports the status when there is no redirect', async () => {
    stubRoutes({ [REQUESTED]: { status: 200 } });
    expect(await headStatus(REQUESTED)).toBe(200);
    stubRoutes({ [REQUESTED]: { status: 404 } });
    expect(await headStatus(REQUESTED)).toBe(404);
  });

  it('downloadToFile keeps the non-OK handling after the final hop', async () => {
    stubRoutes({ [REQUESTED]: { status: 403, body: 'nope' } });
    const failure = await failureOf(() =>
      downloadToFile(REQUESTED, path.join(tempDir, 'forbidden.csv.gz')),
    );
    expect(failure.message).toMatch(/403/);
  });

  it('requests every hop with redirect: manual', async () => {
    const CDN = 'https://cdn.example.test/m.csv.gz';
    stubRoutes({
      [REQUESTED]: { status: 302, location: CDN },
      [CDN]: { status: 200 },
    });
    await headStatus(REQUESTED);
    const calls = (fetch as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls;
    expect(calls.map(([, init]) => init.redirect)).toEqual(['manual', 'manual']);
  });
});

describe('the build script is reproducible across transports', () => {
  let workDir = '';

  beforeAll(() => {
    workDir = mkdtempSync(path.join(tmpdir(), 'geo-build-'));
  });

  afterAll(() => {
    rmSync(workDir, { recursive: true, force: true });
  });

  it('produces byte-identical tables from a gzipped CSV and the same CSV plain', () => {
    const plain = readFileSync(FIXTURE_CSV);
    const gzPath = path.join(workDir, 'fixture.csv.gz');
    writeFileSync(gzPath, gzipSync(plain));
    const gzOut = path.join(workDir, 'from-gzip.bin');
    const plainOut = path.join(workDir, 'from-plain.bin');

    runBuild(['--csv', gzPath, '--out', gzOut, '--month', '0000-00', '--fixture']);
    runBuild(['--csv', FIXTURE_CSV, '--out', plainOut, '--month', '0000-00', '--fixture']);

    expect(readFileSync(gzOut).equals(readFileSync(plainOut))).toBe(true);
  });

  it('regenerates the committed fixture table byte for byte', () => {
    // The same guarantee the container tests make, one level up: the committed
    // .bin is a derived artifact, and this is what makes it checkable.
    const out = path.join(workDir, 'regenerated.bin');
    runBuild(['--csv', FIXTURE_CSV, '--out', out, '--month', '0000-00', '--fixture']);
    expect(readFileSync(out).equals(readFileSync(FIXTURE_BIN))).toBe(true);
  });

  it('prints exactly one summary line carrying the month, the size and the hash', () => {
    const out = path.join(workDir, 'summary.bin');
    const stdout = runBuild([
      '--csv',
      FIXTURE_CSV,
      '--out',
      out,
      '--month',
      '0000-00',
      '--fixture',
    ]);
    const lines = stdout.trim().split('\n');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('kind=country');
    expect(lines[0]).toContain('month=0000-00');
    expect(lines[0]).toMatch(/bytes=\d+/);
    expect(lines[0]).toMatch(/sha256=[0-9a-f]{64}/);
  });

  it('refuses a build with neither --csv nor --download', () => {
    expect(() => runBuild(['--out', path.join(workDir, 'never.bin')])).toThrow();
  });

  it('accepts the GNU -- separator that pnpm forwards literally', () => {
    // `pnpm run geo:country -- --download` reaches this script as two arguments
    // with a bare `--` first, because pnpm 12 does not strip the separator the
    // way npm does. Without this the documented invocation fails as an unknown
    // flag, which is the least informative way to learn a package manager
    // changed.
    const out = path.join(workDir, 'separator.bin');
    const stdout = runBuild([
      '--',
      '--csv',
      FIXTURE_CSV,
      '--out',
      out,
      '--month',
      '0000-00',
      '--fixture',
    ]);
    expect(stdout).toContain('kind=country');
  });
});

describe('RESEARCH A2: the scripts run as plain Node .ts files', () => {
  it('runs the build script with no type-stripping flag', () => {
    // `process.execPath` is whatever Node is running this suite: Node 24 in CI,
    // whatever the contributor has locally. A flag here would be the only thing
    // making the two agree, and the flag is exactly what A2 says is not needed.
    const stdout = runBuild([
      '--csv',
      FIXTURE_CSV,
      '--out',
      path.join(tmpdir(), 'geo-a2-probe.bin'),
      '--month',
      '0000-00',
      '--fixture',
    ]);
    expect(stdout).toContain('kind=country');
    rmSync(path.join(tmpdir(), 'geo-a2-probe.bin'), { force: true });
  });

  it('uses only erasable syntax, which is what makes stripping portable', () => {
    // Node's type stripping REPLACES types; it does not transform them. An
    // enum, a namespace or a parameter property needs a transform, so it is
    // the construct where two Node majors are most likely to disagree. The
    // check is on the source rather than on the running version because the
    // suite cannot run on both versions at once.
    for (const file of [BUILD_SCRIPT, DOWNLOAD_LIB]) {
      const source = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      const code = source
        .split('\n')
        .filter((line) => !line.trimStart().startsWith('//'))
        .join('\n');
      expect(code, `${file} must not declare an enum`).not.toMatch(/^\s*(export\s+)?enum\s/m);
      expect(code, `${file} must not declare a namespace`).not.toMatch(
        /^\s*(export\s+)?namespace\s/m,
      );
      expect(code, `${file} must not use a constructor parameter property`).not.toMatch(
        /constructor\s*\([^)]*\b(private|public|protected|readonly)\s/m,
      );
    }
  });

  it('imports with explicit .ts specifiers, which is what Node resolves', () => {
    // A bundler-style extensionless import resolves through Vite and fails
    // under Node, so a script can pass type-check and still be unrunnable.
    const source = readFileSync(BUILD_SCRIPT, 'utf8');
    for (const match of source.matchAll(/from '([^']+)'/g)) {
      const specifier = match[1]!;
      if (specifier.startsWith('node:')) continue;
      expect(specifier, `${specifier} must carry its .ts extension`).toMatch(/\.ts$/);
    }
  });

  it('pins Node 24 for the CI job that runs this file', () => {
    const workflow = readFileSync(path.join(REPO_ROOT, '.github/workflows/ci.yml'), 'utf8');
    expect(workflow).toMatch(/node-version:\s*24/);
    expect(workflow).toContain('pnpm run test:unit');
  });
});
