import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// =============================================================================
// Exactly one file under src/ makes a network call (06-11, D-16, T-06-43)
// =============================================================================
//
// The lint override exempts one path; this scan is the independent count. It
// reads the source rather than the lint config, so a second exemption written
// anywhere (a `// eslint-disable` comment, a second override, an alias that
// hides the identifier) is caught by a different instrument than the one that
// would have been bypassed.
//
// Every network-API spelling is counted, not only the platform fetch call: the
// product's promise is zero requests after load apart from the one opt-in
// download, so the other APIs must have no call site at all.
// =============================================================================

const REPO_ROOT = fileURLToPath(new URL('../../..', import.meta.url));
const THE_ONE = 'src/lib/geo/city-fetch.ts';

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

/** Source with comments and string literals blanked, so prose is not a hit. */
function code(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
    .replace(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g, "''");
}

const FETCH_CALL = /(^|[^.\w$])fetch\s*\(/;
const OTHER_NETWORK_API =
  /\b(XMLHttpRequest|WebSocket|WebTransport|EventSource|RTCPeerConnection|fetchLater|importScripts|sendBeacon)\b/;
const EXPLICIT_GLOBAL_FETCH = /\b(window|self|globalThis)\s*(\.|\[)\s*['"]?fetch\b/;

describe('the network call sites under src/', () => {
  const files = sourceFilesUnder('src');

  it('scans a real file set, not an empty one', () => {
    expect(files.length).toBeGreaterThan(50);
    expect(files).toContain(THE_ONE);
    expect(files.some((f) => f.startsWith(join('src', 'lib', 'worker')))).toBe(true);
  });

  it('the platform fetch call appears in exactly one file, and it is the city loader', () => {
    const hits = files.filter((file) =>
      FETCH_CALL.test(code(readFileSync(join(REPO_ROOT, file), 'utf8'))),
    );
    expect(hits.map((f) => relative(REPO_ROOT, join(REPO_ROOT, f)))).toEqual([THE_ONE]);
  });

  it('the loader calls it exactly once', () => {
    const src = code(readFileSync(join(REPO_ROOT, THE_ONE), 'utf8'));
    expect(src.match(new RegExp(FETCH_CALL.source, 'g'))).toHaveLength(1);
  });

  it('no file under src/ calls fetch through window, self or globalThis', () => {
    const hits = files.filter((file) =>
      EXPLICIT_GLOBAL_FETCH.test(code(readFileSync(join(REPO_ROOT, file), 'utf8'))),
    );
    expect(hits).toEqual([]);
  });

  it('no file under src/ names any other network API, the loader included', () => {
    const hits = files.filter((file) =>
      OTHER_NETWORK_API.test(code(readFileSync(join(REPO_ROOT, file), 'utf8'))),
    );
    expect(hits).toEqual([]);
  });

  it('nothing under src/lib/worker/ can reach the network at all', () => {
    const worker = files.filter((f) => f.startsWith(join('src', 'lib', 'worker')));
    expect(worker.length).toBeGreaterThan(0);
    for (const file of worker) {
      const src = code(readFileSync(join(REPO_ROOT, file), 'utf8'));
      expect(FETCH_CALL.test(src), file).toBe(false);
      expect(OTHER_NETWORK_API.test(src), file).toBe(false);
    }
  });

  it('no source file disables the network-ban rule inline', () => {
    // A lint-disable comment is the other way past the ban, and it is invisible
    // to `code()` by design, so it is searched for on the raw text.
    const hits = files.filter((file) => {
      const raw = readFileSync(join(REPO_ROOT, file), 'utf8');
      return /eslint-disable[^\n]*no-restricted-(globals|properties)/.test(raw);
    });
    expect(hits).toEqual([]);
  });
});
