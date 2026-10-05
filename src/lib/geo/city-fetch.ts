/**
 * The ONE network call of the product (phase 06, plan 06-11, ACTIVITY-07,
 * D-14, D-16, T-06-41, T-06-43, T-06-44).
 *
 * After the page has loaded this application makes zero network requests. The
 * single exception is a user's explicit opt-in to city-level geolocation: one
 * same-origin GET for one static file, the pre-derived city dataset. This is
 * the only module under `src/` that may call the platform fetch function, and
 * `eslint.config.js` exempts exactly this path (and nothing else in it: the
 * legacy request object, the socket and every other network API stay banned
 * here too). `tests/unit/guards/fetch-scan.test.ts` counts the call sites and
 * fails unless there is exactly one, in this file.
 *
 * ## Where the real enforcement is (and where it is not)
 *
 * A meta CSP is blind to worker traffic: measured, `connect-src 'none'`
 * blocked a main-thread fetch while a module-worker fetch returned 200. A
 * `'self'` host source cannot be restricted to a path either. So the widened
 * `connect-src 'self'` is defence in depth only. The guarantee is (1) the lint
 * ban, which covers `src/lib/worker/` with no exemption at all, and (2) the
 * Playwright request assertions, which prove WHICH asset the one request
 * fetched. The `connect-src 'none'` shipped before this phase never governed
 * worker traffic either; nothing is being loosened that was ever tight.
 *
 * ## Why this runs on the main thread
 *
 * The decision recorded at the end of plan 06-09 (option-a): the main thread
 * downloads, the buffer is TRANSFERRED to the worker, and the worker decodes.
 * `src/lib/worker/` holds the raw rows, so it keeps an absolute network ban.
 *
 * ## What the request can carry (T-06-41)
 *
 * Nothing about the user or the export. The URL is built from the page origin,
 * the project base path, `geo-city-data/` and a file name taken from the
 * build-time manifest that matches a strict pattern. There is no query string,
 * no fragment, no header and no body; credentials are omitted and the referrer
 * is suppressed, so not even the page's own address leaves with it.
 *
 * ## Why ONE error text
 *
 * {@link CITY_FETCH_ERROR} is a constant. A response is attacker-influenced
 * input, and an error message built from it would be text somebody else chose.
 * An abort is the exception: it propagates as the abort it is, so a caller can
 * tell "the user cancelled" from "it failed".
 */

/**
 * The file name pattern, shared in spirit with `scripts/geo/lib/city-manifest.ts`
 * (a unit test asserts the two sources are identical, because the build script
 * cannot import from `src/`). Letters, digits, dot, underscore and hyphen,
 * ending `.citydb.bin`, with no dot segment, no leading dot and a length cap:
 * a path separator, a query, a fragment or a `..` can never match.
 */
export const CITY_FILE_PATTERN = /^(?!.*\.\.)[A-Za-z0-9_-][A-Za-z0-9._-]{0,120}\.citydb\.bin$/;

/**
 * The base path is a path, nothing else: it starts with ONE slash and ends with
 * one, and no segment is only dots. That rules out a protocol-relative
 * `//host/` base, which would resolve to another origin, a `..` segment, and a
 * relative `./` base, which this module does not support (Phase 7 sets an
 * absolute subpath).
 */
const BASE_PATH_PATTERN = /^\/(?:(?!\.+\/)[A-Za-z0-9._~-]+\/)*$/;

/** The one text every failure here answers with. */
export const CITY_FETCH_ERROR = 'city fetch failed';

/**
 * The most bytes this module will buffer. Mirrors `MAX_CITY_TABLE_BYTES` in
 * `range-table.ts` (a unit test pins the two together; this module may not
 * import it because that module is worker-only). The container is 50 MB raw
 * and 11.9 MB gzipped, so this has headroom over the gzipped file the manifest
 * describes and none for a response that is simply unbounded.
 *
 * The contract is GZIP-ONLY (WR-07): the manifest's `bytes` and `sha256` both
 * describe the gzipped file as served. A host that transparently decodes
 * `Content-Encoding` hands the browser a different (plain) body, which fails the
 * worker's length and hash checks and answers the generic city error. Plain
 * bodies are not a supported production path.
 */
export const MAX_CITY_DOWNLOAD_BYTES = 96 * 1024 * 1024;

/** What the build-time manifest says about the opt-in file. */
export type CityManifest = NonNullable<typeof __GEO_CITY__>;

/**
 * The manifest baked into this bundle, or `null` when none was built.
 *
 * Read inside the function and never at import time, so a test can stub the
 * global; a bundle built without the constant at all (a tool that does not run
 * the Vite `define`) reads as "no manifest" rather than a ReferenceError.
 */
export function readCityManifest(): CityManifest | null {
  return typeof __GEO_CITY__ === 'undefined' ? null : __GEO_CITY__;
}

/**
 * The URL of the opt-in file: page origin, base path, `geo-city-data/`, file
 * name. Throws {@link CITY_FETCH_ERROR} for a file name or a base path that
 * does not match, or for a page whose origin is opaque (a `file:` page).
 *
 * @param baseUrl `import.meta.env.BASE_URL`, passed in so a test controls it.
 * @param pageHref `location.href`, passed in for the same reason.
 */
export function cityAssetUrl(
  manifest: Pick<CityManifest, 'file'>,
  baseUrl: string,
  pageHref: string,
): URL {
  if (!CITY_FILE_PATTERN.test(manifest.file) || !BASE_PATH_PATTERN.test(baseUrl)) {
    throw new Error(CITY_FETCH_ERROR);
  }
  let origin: string;
  try {
    origin = new URL(pageHref).origin;
  } catch {
    throw new Error(CITY_FETCH_ERROR);
  }
  if (origin === 'null') throw new Error(CITY_FETCH_ERROR);

  // `origin` and the path are concatenated rather than resolved against the
  // page, so nothing in the page's own path or query can reach the result.
  const url = new URL(`${origin}${baseUrl}geo-city-data/${manifest.file}`);
  if (url.origin !== origin || url.search !== '' || url.hash !== '') {
    throw new Error(CITY_FETCH_ERROR);
  }
  return url;
}

/**
 * Downloads the file and returns it whole as an `ArrayBuffer`, ready to be
 * transferred to the worker.
 *
 * Progress is reported against `expectedBytes`, the size baked into the
 * manifest at build time, because `Content-Length` is unreliable (absent in a
 * probe, and a static host may transfer-encode). The count can pass the
 * denominator if a host re-encodes the body (which the worker then refuses on
 * its length and hash checks); the caller clamps what it shows.
 *
 * @param signal an `AbortController` signal; an abort rejects as an abort.
 */
export async function fetchCityBytes(
  url: URL,
  expectedBytes: number,
  onProgress: (received: number, total: number) => void,
  signal: AbortSignal,
): Promise<ArrayBuffer> {
  // The ONE network call. The bare identifier is deliberate: the lint ban on
  // the explicit-global forms (`window.`, `self.`, `globalThis.`) is still in
  // force in this file, so the exemption is for this one spelling only.
  const response = await fetch(url, {
    method: 'GET',
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    // Refuses to leave the page's origin at all, including by redirect, on top
    // of the CSP, which a worker would bypass but this thread does not.
    mode: 'same-origin',
    signal,
  });
  if (!response.ok || response.body === null) throw new Error(CITY_FETCH_ERROR);

  const chunks: Uint8Array[] = [];
  let received = 0;
  const reader = response.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.length;
    if (received > MAX_CITY_DOWNLOAD_BYTES) {
      // Stop pulling; the caller sees the same fixed failure as any other.
      await reader.cancel().catch(() => undefined);
      throw new Error(CITY_FETCH_ERROR);
    }
    chunks.push(value);
    onProgress(received, expectedBytes);
  }

  const out = new Uint8Array(received);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  // `out` owns a fresh buffer of exactly its own length, so it can be
  // transferred as it stands.
  return out.buffer;
}
