import { zipSync as fflateZipSync } from 'fflate';

/**
 * `fflate.zipSync` with a PINNED mtime — the only way to build a fixture archive
 * in this suite.
 *
 * ## Why the pin is load-bearing
 *
 * fflate stamps every local file header with `Date.now()` when no `mtime` is
 * given. Two calls to the same builder therefore produce DIFFERENT BYTES — and
 * a different SHA-256 — as soon as they straddle a two-second tick (a zip header
 * stores the seconds field divided by two, so the granularity is two seconds,
 * not one).
 *
 * That is invisible to a test that builds one archive, but it broke the dedup
 * gate (IMPORT-06 / D-12). `replay-reclassify.test.ts` builds the SAME export
 * twice to assert that a hash-identical re-drop answers `duplicate`; whenever
 * those two builds landed in different ticks the second archive genuinely was
 * not hash-identical, the gate correctly answered `done`, and the suite failed
 * about one run in forty — more often on a loaded machine, where the two builds
 * sit further apart in wall-clock time. That load sensitivity is what made it
 * read as an ordinary flaky test rather than as a content-hash contract that
 * silently did not hold.
 *
 * A content hash is only meaningful over reproducible content, so the mtime is
 * pinned once, here, instead of at each call site.
 *
 * ## Import THIS, not `fflate`
 *
 * `sessions-fixtures.ts` and `playtime-real-shape-fixture.ts` build archives
 * too. If any of them reaches past this module for `fflate.zipSync` directly,
 * the property this file exists to guarantee is gone for its archives — and it
 * will not fail loudly, because a test that builds one archive and asserts on
 * its contents cannot see the difference. The guard for it is in
 * `tests/unit/sample-export-shape.test.ts`.
 *
 * `SAMPLE_CREATED_AT` is the instant the export body already writes, so the
 * archive agrees with its own contents.
 */
const ZIP_MTIME = new Date('2020-01-01T00:00:00Z');

/**
 * `fflate.zipSync` with a deterministic mtime.
 *
 * `opts` is spread BEFORE the pin on purpose: the pin is the property this
 * module exists to guarantee, so it must not be something a call site can
 * accidentally opt out of by passing its own `mtime`. Every other fflate option
 * (level, mem, etc.) is still the caller's to set.
 */
export function zipSync(
  data: Parameters<typeof fflateZipSync>[0],
  opts?: Parameters<typeof fflateZipSync>[1],
): Uint8Array {
  return fflateZipSync(data, { ...opts, mtime: ZIP_MTIME });
}
