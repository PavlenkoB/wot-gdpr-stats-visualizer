/**
 * Resolving and fetching an official DB-IP monthly download (phase 06, plan
 * 06-04, ACTIVITY-06, RESEARCH Decision 1, T-06-17).
 *
 * ## Why the OFFICIAL downloads and not the npm mirror
 *
 * Recorded at the plan's blocking checkpoint (option-a). The evidence is in
 * `tests/unit/geo/source-decision.test.ts` and in the SUMMARY: the
 * `@ip-location-db/dbip-country` mirror is marked deprecated by npm, was
 * flagged SUS by the package-legitimacy gate, is four months stale, agrees with
 * the official file on only 97.35% of sampled /24 blocks, carries no `ZZ` rows
 * for reserved space, and has no city counterpart past 2025-01. The official
 * downloads are the same CC BY 4.0 data, are contiguous, name reserved space
 * explicitly, and are ONE source for both tiers.
 *
 * The build scripts still accept a local `--csv` path, so the mirror remains an
 * offline fallback for anyone who already has the file — which is why nothing
 * here refuses a path, and why the checkpoint's option-b is a policy rather
 * than an architectural change.
 *
 * ## Why the MONTH is resolved rather than pinned
 *
 * DB-IP removes old months from `download.db-ip.com` (measured: 2026-09 and
 * 2026-10 answered 200; 2026-06 and 2025-01 answered 404). A pinned URL is
 * therefore a build that breaks on its own, so this module asks for the current
 * UTC month and falls back ONE month on a 404, and the caller records the month
 * it actually got. The fallback is exactly one month and a 404 is the ONLY
 * status that advances it: a 403 is a different problem, and answering it with
 * a month-old table would look like success.
 *
 * ## Why `head` is INJECTED
 *
 * The month logic is the only interesting part of this module and the only part
 * with branches worth pinning, and it has to be testable on a machine that
 * cannot reach the internet and on a date the test does not control. So
 * `resolveDbipUrl` takes the status function as an argument, and the caller
 * passes {@link headStatus}.
 *
 * ## Why the download is STREAMED and HASHED as it lands
 *
 * The country file is 4.5 MB gzipped and the city file plan 06-09 builds from
 * is 85.8 MB. The response is piped to disk through a `Transform` that hashes
 * and counts on the way past, so the file is never held in memory and the hash
 * costs no second pass. T-06-17 asks for the source hash to be printed: a
 * committed binary that nobody can trace to a source is an artifact, not a
 * build product.
 *
 * HTTPS only, and the check is here rather than at the call site because this
 * is the one function in the repository that turns a URL typed somewhere else
 * into bytes written to disk.
 */

import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

/** The two DB-IP tiers this project builds tables from. */
export type DbipKind = 'country' | 'city';

/** Answers the HTTP status of a HEAD for a URL. Injected so the month logic is testable. */
export type HeadFn = (url: string) => Promise<number>;

/** A resolved download: where it is, and which month's data it holds. */
export interface ResolvedDbipUrl {
  readonly url: string;
  readonly month: string;
}

/** What a completed download cost and what it contained. */
export interface DownloadResult {
  readonly bytes: number;
  readonly sha256: string;
}

const DOWNLOAD_ORIGIN = 'https://download.db-ip.com/free/';
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** The redirect statuses followed by {@link fetchHttpsOnly}. */
const REDIRECT_STATUSES: ReadonlySet<number> = new Set([301, 302, 303, 307, 308]);

/** At most this many redirects are followed; the next one is an error. */
const MAX_REDIRECTS = 5;

const REFUSE_NON_HTTPS = 'dbip: refusing a non-HTTPS redirect';

function isHttps(url: URL): boolean {
  return url.protocol === 'https:';
}

/**
 * `fetch` that follows redirects itself and requires https on EVERY hop
 * (T-06-17 / T-06-36).
 *
 * `redirect: 'follow'` is not enough, and neither is checking `response.url`
 * afterwards: `fetch` follows an https -> http -> https chain and the final url
 * looks fine, while the plaintext hop was requested (and could have been
 * answered by anyone on the path) in between. So the redirect is handled here
 * with `redirect: 'manual'`, which hands back the 3xx and its `Location`
 * without requesting the target, and the target is checked BEFORE it is
 * requested. The initial url is checked the same way.
 *
 * The error messages are fixed on purpose: the `Location` value is
 * attacker-influenced and is not echoed (no url, host or query ever appears in
 * them). The host is deliberately NOT pinned: nothing here has an allowed-host
 * notion, and a CDN hop to another https host is a legitimate answer; the
 * integrity risk this closes is the downgrade to plaintext.
 *
 * The method is kept on every hop, including a 303 and a 301/302: the standard
 * rule would turn a POST into a GET, but both callers send only HEAD or GET,
 * carry no body, and a HEAD probe of the redirect target is exactly the
 * question being asked, so there is nothing to rewrite. A relative `Location`
 * is resolved against the current url. A 3xx without a `Location`, a `Location`
 * that cannot be parsed, and more than {@link MAX_REDIRECTS} redirects are all
 * errors. A 3xx that is not one of {@link REDIRECT_STATUSES} (300, 304, ...) is
 * returned to the caller as the final response.
 */
async function fetchHttpsOnly(url: string, init: RequestInit): Promise<Response> {
  let current: URL;
  try {
    current = new URL(url);
  } catch {
    throw new Error(REFUSE_NON_HTTPS);
  }

  for (let redirects = 0; ; redirects += 1) {
    if (!isHttps(current)) {
      throw new Error(REFUSE_NON_HTTPS);
    }
    const response = await fetch(current.href, { ...init, redirect: 'manual' });
    if (!REDIRECT_STATUSES.has(response.status)) {
      return response;
    }

    // A redirect body is never read; release the connection.
    await response.body?.cancel();
    const location = response.headers.get('location');
    if (location === null || location === '') {
      throw new Error('dbip: redirect without a Location header');
    }
    if (redirects >= MAX_REDIRECTS) {
      throw new Error('dbip: too many redirects');
    }
    try {
      current = new URL(location, current);
    } catch {
      throw new Error(REFUSE_NON_HTTPS);
    }
  }
}

function checkMonth(month: string): void {
  if (!MONTH_RE.test(month)) {
    throw new Error(`dbip: ${month} is not a YYYY-MM month`);
  }
}

/**
 * The official download URL for one tier and month.
 *
 * The file is always gzipped: DB-IP publishes the `.csv.gz`, and the city tier's
 * 693 MB raw is the reason the build script streams rather than reads.
 */
export function dbipUrl(kind: DbipKind, month: string): string {
  checkMonth(month);
  return `${DOWNLOAD_ORIGIN}dbip-${kind}-lite-${month}.csv.gz`;
}

/**
 * The current month in UTC, as `YYYY-MM`.
 *
 * UTC and not local time, because the month a maintainer sees in the URL must
 * not depend on where they are: 23:30 UTC on the 31st is the 31st in Tokyo and
 * already the 1st in Los Angeles, and a build that silently picked a different
 * file on each side of that line would be a reproducibility bug.
 */
export function currentMonthUtc(now: Date): string {
  const year = String(now.getUTCFullYear()).padStart(4, '0');
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/** The month before `month`, across the year boundary. */
export function previousMonth(month: string): string {
  checkMonth(month);
  // Month index minus one, handed to Date as -1 for January and left to
  // normalise — which is how December of the previous year comes out.
  const date = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)) - 2, 1));
  return currentMonthUtc(date);
}

/**
 * Find a downloadable month: the current UTC month, else the one before it.
 *
 * Throws rather than returning a third guess. Two 404s in a row means DB-IP has
 * nothing recent published, which is a fact a build should stop on and say out
 * loud — returning an older month would keep the build "working" while shipping
 * data nobody chose.
 */
export async function resolveDbipUrl(
  kind: DbipKind,
  now: Date,
  head: HeadFn,
): Promise<ResolvedDbipUrl> {
  const current = currentMonthUtc(now);
  const previous = previousMonth(current);

  const currentUrl = dbipUrl(kind, current);
  const currentStatus = await head(currentUrl);
  if (currentStatus >= 200 && currentStatus < 300) return { url: currentUrl, month: current };
  if (currentStatus !== 404) {
    throw new Error(`dbip: HEAD ${currentStatus} for ${currentUrl}`);
  }

  const previousUrl = dbipUrl(kind, previous);
  const previousStatus = await head(previousUrl);
  if (previousStatus >= 200 && previousStatus < 300) return { url: previousUrl, month: previous };
  if (previousStatus !== 404) {
    throw new Error(`dbip: HEAD ${previousStatus} for ${previousUrl}`);
  }

  throw new Error(`dbip: no ${kind} download for ${current} or ${previous}, both returned 404`);
}

/**
 * The real status function, for callers that are not a test.
 *
 * Redirects are followed (by {@link fetchHttpsOnly}, https on every hop)
 * because a CDN that answers 302 for an older month is serving it, and a 404
 * after following is the answer this module needs.
 */
export async function headStatus(url: string): Promise<number> {
  const response = await fetchHttpsOnly(url, { method: 'HEAD' });
  return response.status;
}

/**
 * Stream a download to `filePath`, returning its size and sha256.
 *
 * HTTPS is required and checked before the request is made: this is the one
 * function in the repository that turns a URL into bytes on disk, and the caller
 * is a build script whose URL argument is derived from a date. Every redirect
 * hop is checked too, before it is requested ({@link fetchHttpsOnly}). The response is
 * hashed on the way past rather than in a second read, so a 693 MB city file
 * costs one pass.
 */
export async function downloadToFile(url: string, filePath: string): Promise<DownloadResult> {
  if (!url.startsWith('https://')) {
    throw new Error(`dbip: refusing a non-HTTPS download: ${url}`);
  }
  const response = await fetchHttpsOnly(url, { method: 'GET' });
  if (!response.ok) {
    throw new Error(`dbip: download answered ${response.status} for ${url}`);
  }
  if (response.body === null) {
    throw new Error(`dbip: download returned no body for ${url}`);
  }

  const hash = createHash('sha256');
  let bytes = 0;
  const meter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      hash.update(chunk);
      bytes += chunk.length;
      callback(null, chunk);
    },
  });

  await pipeline(
    Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]),
    meter,
    createWriteStream(filePath),
  );

  return { bytes, sha256: hash.digest('hex') };
}
