import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CITY_FETCH_ERROR,
  CITY_FILE_PATTERN,
  MAX_CITY_DOWNLOAD_BYTES,
  cityAssetUrl,
  fetchCityBytes,
  readCityManifest,
} from '../../../src/lib/geo/city-fetch.ts';
import { MAX_CITY_TABLE_BYTES } from '../../../src/lib/geo/range-table.ts';

// =============================================================================
// The one network module (06-11 Task 1, T-06-41, T-06-44)
// =============================================================================
//
// The global fetch is stubbed, so nothing here touches a network. What is under
// test is the SHAPE of the single request: one call, nothing about the export in
// it, and a failure that says one fixed thing.
// =============================================================================

const MANIFEST = { file: 'city-2026-10.citydb.bin' };
const PAGE = 'https://example.test/app/index.html?secret=1#frag';

function streamOf(...chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  let next = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      const chunk = chunks[next];
      next += 1;
      if (chunk === undefined) controller.close();
      else controller.enqueue(chunk);
    },
  });
}

function stubFetch(response: Response | (() => Promise<Response>)): ReturnType<typeof vi.fn> {
  const stub = vi.fn(async () => (typeof response === 'function' ? response() : response));
  vi.stubGlobal('fetch', stub);
  return stub;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('readCityManifest', () => {
  it('reads the baked constant when it is called, not when the module loads', () => {
    vi.stubGlobal('__GEO_CITY__', null);
    expect(readCityManifest()).toBeNull();
    const manifest = {
      file: 'a.citydb.bin',
      bytes: 3,
      month: '2026-10',
      sha256: '0',
      source: 'dbip',
    };
    vi.stubGlobal('__GEO_CITY__', manifest);
    expect(readCityManifest()).toEqual(manifest);
  });

  it('reads as no manifest, not as a ReferenceError, when the constant was never defined', () => {
    expect(readCityManifest()).toBeNull();
  });
});

describe('cityAssetUrl', () => {
  it('is the page origin, the base path, geo-city-data and the file name, and nothing else', () => {
    const url = cityAssetUrl(MANIFEST, '/app/', PAGE);
    expect(url.href).toBe('https://example.test/app/geo-city-data/city-2026-10.citydb.bin');
    expect(url.search).toBe('');
    expect(url.hash).toBe('');
    expect(url.pathname.endsWith(MANIFEST.file)).toBe(true);
  });

  it('does not carry the page path, query or fragment into the URL', () => {
    const url = cityAssetUrl(MANIFEST, '/', 'http://localhost:4173/deep/page?x=y#z');
    expect(url.href).toBe('http://localhost:4173/geo-city-data/city-2026-10.citydb.bin');
  });

  it.each([
    ['a path separator', 'a/b.citydb.bin'],
    ['a backslash', 'a\\b.citydb.bin'],
    ['a query', 'a.citydb.bin?x=1'],
    ['a fragment', 'a.citydb.bin#x'],
    ['a double dot', '..citydb.bin'],
    ['a dot segment', 'a..b.citydb.bin'],
    ['a leading dot', '.hidden.citydb.bin'],
    ['the wrong suffix', 'a.bin'],
    ['an empty name', ''],
    ['a percent escape', 'a%2f.citydb.bin'],
    ['a space', 'a b.citydb.bin'],
    ['a name over the length cap', `${'a'.repeat(130)}.citydb.bin`],
  ])('rejects a file name with %s', (_label, file) => {
    expect(() => cityAssetUrl({ file }, '/', PAGE)).toThrow(CITY_FETCH_ERROR);
  });

  it.each([
    ['a protocol-relative base', '//evil.test/'],
    ['a relative base', './'],
    ['an empty base', ''],
    ['a base with a dot segment', '/../'],
    ['a base with no trailing slash', '/app'],
    ['an absolute URL base', 'https://evil.test/'],
  ])('rejects %s', (_label, base) => {
    expect(() => cityAssetUrl(MANIFEST, base, PAGE)).toThrow(CITY_FETCH_ERROR);
  });

  it('rejects a page whose origin is opaque', () => {
    expect(() => cityAssetUrl(MANIFEST, '/', 'file:///tmp/index.html')).toThrow(CITY_FETCH_ERROR);
    expect(() => cityAssetUrl(MANIFEST, '/', 'not a url')).toThrow(CITY_FETCH_ERROR);
  });

  it('accepts the names the build actually writes', () => {
    for (const file of ['city-2026-10.citydb.bin', 'city-fixture.citydb.bin']) {
      expect(CITY_FILE_PATTERN.test(file), file).toBe(true);
    }
  });
});

describe('fetchCityBytes', () => {
  const url = cityAssetUrl(MANIFEST, '/', 'https://example.test/');

  it('issues ONE bare GET that carries nothing but the URL', async () => {
    const stub = stubFetch(new Response(streamOf(new Uint8Array([1, 2, 3]))));
    const controller = new AbortController();
    await fetchCityBytes(url, 3, () => undefined, controller.signal);

    expect(stub).toHaveBeenCalledTimes(1);
    const [target, init] = stub.mock.calls[0] as unknown as [URL, RequestInit];
    expect(target).toBe(url);
    expect(init.method).toBe('GET');
    expect(init.credentials).toBe('omit');
    expect(init.referrerPolicy).toBe('no-referrer');
    expect(init.mode).toBe('same-origin');
    expect(init.signal).toBe(controller.signal);
    expect(init.headers).toBeUndefined();
    expect(init.body).toBeUndefined();
    expect(Object.keys(init).sort()).toEqual(
      ['credentials', 'method', 'mode', 'referrerPolicy', 'signal'].sort(),
    );
    expect(target.search).toBe('');
    expect(target.hash).toBe('');
  });

  it('reports monotone progress against the manifest size and returns the bytes', async () => {
    stubFetch(
      new Response(
        streamOf(new Uint8Array([1, 2]), new Uint8Array([3]), new Uint8Array([4, 5, 6, 7])),
      ),
    );
    const seen: Array<[number, number]> = [];
    const buffer = await fetchCityBytes(
      url,
      7,
      (received, total) => seen.push([received, total]),
      new AbortController().signal,
    );

    expect(seen).toEqual([
      [2, 7],
      [3, 7],
      [7, 7],
    ]);
    expect(seen.at(-1)![0]).toBe(buffer.byteLength);
    expect([...new Uint8Array(buffer)]).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('does not trust Content-Length: the denominator is the manifest size', async () => {
    stubFetch(
      new Response(streamOf(new Uint8Array(4)), { headers: { 'content-length': '999999' } }),
    );
    const seen: Array<[number, number]> = [];
    await fetchCityBytes(
      url,
      4,
      (received, total) => seen.push([received, total]),
      new AbortController().signal,
    );
    expect(seen).toEqual([[4, 4]]);
  });

  it('returns a buffer that owns exactly its bytes, ready to transfer', async () => {
    stubFetch(new Response(streamOf(new Uint8Array([9, 8]), new Uint8Array([7]))));
    const buffer = await fetchCityBytes(url, 3, () => undefined, new AbortController().signal);
    expect(buffer).toBeInstanceOf(ArrayBuffer);
    expect(buffer.byteLength).toBe(3);
  });

  it('throws the one fixed error for a non-success response', async () => {
    for (const status of [404, 500, 403]) {
      stubFetch(new Response('secret detail from the host', { status }));
      const failure = await fetchCityBytes(url, 1, () => undefined, new AbortController().signal)
        .then(() => null)
        .catch((error: unknown) => error);
      expect(failure).toBeInstanceOf(Error);
      expect((failure as Error).message).toBe(CITY_FETCH_ERROR);
      expect((failure as Error).message).not.toContain('secret');
    }
  });

  it('throws the one fixed error for a response with no body', async () => {
    stubFetch(new Response(null, { status: 204 }));
    await expect(
      fetchCityBytes(url, 1, () => undefined, new AbortController().signal),
    ).rejects.toThrow(CITY_FETCH_ERROR);

    // `ok` with a null body: a 200 that has nothing to read.
    stubFetch({ ok: true, body: null } as unknown as Response);
    await expect(
      fetchCityBytes(url, 1, () => undefined, new AbortController().signal),
    ).rejects.toThrow(CITY_FETCH_ERROR);
  });

  it('lets an abort propagate as an abort, not as the fixed failure', async () => {
    const controller = new AbortController();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: unknown, init: RequestInit) => {
        if (init.signal?.aborted) throw init.signal.reason;
        return new Response(streamOf(new Uint8Array(1)));
      }),
    );
    controller.abort();
    const failure = await fetchCityBytes(url, 1, () => undefined, controller.signal)
      .then(() => null)
      .catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(DOMException);
    expect((failure as DOMException).name).toBe('AbortError');
    expect((failure as DOMException).message).not.toBe(CITY_FETCH_ERROR);
  });

  it('lets an abort during the read propagate as an abort too', async () => {
    const controller = new AbortController();
    const body = new ReadableStream<Uint8Array>({
      pull(stream) {
        stream.enqueue(new Uint8Array(2));
        controller.abort();
        stream.error(controller.signal.reason);
      },
    });
    stubFetch(new Response(body));
    const failure = await fetchCityBytes(url, 4, () => undefined, controller.signal)
      .then(() => null)
      .catch((error: unknown) => error);
    expect((failure as DOMException).name).toBe('AbortError');
  });

  it('refuses a body larger than the table cap, with the fixed error', async () => {
    // A 1 MiB chunk repeated past the cap, produced lazily: nothing here ever
    // holds more than one chunk of the test's own.
    const chunk = new Uint8Array(1024 * 1024);
    let sent = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(stream) {
        sent += 1;
        stream.enqueue(chunk);
      },
    });
    stubFetch(new Response(body));
    await expect(
      fetchCityBytes(url, 1, () => undefined, new AbortController().signal),
    ).rejects.toThrow(CITY_FETCH_ERROR);
    expect(sent).toBeLessThan(MAX_CITY_DOWNLOAD_BYTES / chunk.length + 8);
  });

  it('keeps the download cap equal to the container cap the worker enforces', () => {
    expect(MAX_CITY_DOWNLOAD_BYTES).toBe(MAX_CITY_TABLE_BYTES);
  });
});
