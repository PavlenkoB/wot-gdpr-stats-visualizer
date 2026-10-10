/**
 * Declared-size caps for the entries the importer inflates (01-REVIEW.md WR-03,
 * 01-VERIFICATION.md W-2, T-01-52).
 *
 * ## What this bounds
 *
 * `listEntryPaths` is bomb-safe because its filter returns false: nothing is
 * inflated. `handleIngest` is the step that DOES inflate, once per entry that
 * resolves to a category CSV, and fflate allocates `new Uint8Array(originalSize)`
 * for a deflated entry BEFORE it inflates it. `originalSize` is the number the
 * archive's central directory declares, so a few kilobytes of attacker bytes can
 * ask the worker for gigabytes. fflate calls the filter first and takes the
 * declared size from the same record, so refusing inside the filter refuses the
 * allocation before it is made.
 *
 * The cap is on the DECLARED size and that is deliberate. It is the number the
 * allocation is sized from, and it is available before any byte is inflated.
 * (A stream that lies the other way, claiming small and inflating large, cannot
 * outgrow its claim: `unzipSync` hands the inflater a buffer of exactly the
 * declared size and fflate does not resize a caller-supplied buffer, so the
 * output is cut off at the declared size. That was probed against the pinned
 * fflate, not assumed.)
 *
 * ## The limits (a deliberate choice, reversible by editing two constants)
 *
 * - `MAX_ENTRY_BYTES`, 128 MiB. The largest entry inflated by any fixture,
 *   measured at planning time, is the 60,000-session `Sessions.csv` at
 *   4,712,563 B (the sample export's largest is 159,177 B), so this is about
 *   28 times the largest legitimate entry measured.
 * - `MAX_TOTAL_BYTES`, 512 MiB. The whole `buildScaleExport` inflates to
 *   6,011,300 B, so this is about 89 times the largest legitimate export
 *   measured.
 *
 * The review sketched 256 MiB and 1 GiB. A worker that holds every inflated CSV
 * and then its parsed rows has a footprint several times the inflated size, so
 * the smaller pair keeps a hostile archive's worst case inside what a browser
 * tab survives, while staying far above any real export.
 *
 * ## Fixed messages
 *
 * The thrown messages are fixed strings. They contain no entry name, no path and
 * no size, because the message becomes the `detail` of the worker's single
 * `error` response and crosses the worker boundary (01-UAT test 17: no real
 * folder or file names cross it; T-01-53).
 *
 * ## Why this module is pure
 *
 * It takes a structural info type and a callback, imports nothing from fflate and
 * touches no worker global, so the cap logic is unit-tested in plain Node with
 * small injected limits and nothing large is ever allocated. The worker wiring
 * is covered by the `01-14` describe in `ingest-worker.test.ts`.
 */

/** The largest uncompressed size one selected entry may declare: 128 MiB. */
export const MAX_ENTRY_BYTES = 128 * 1024 * 1024;

/** The largest sum of declared sizes across the selected entries: 512 MiB. */
export const MAX_TOTAL_BYTES = 512 * 1024 * 1024;

/** The per-entry limit tripped. Fixed text: see "Fixed messages" above. */
const ENTRY_TOO_LARGE = 'entry too large';

/** The running total tripped. Fixed text: see "Fixed messages" above. */
const ARCHIVE_TOO_LARGE = 'archive too large';

/**
 * The part of fflate's `UnzipFileInfo` the filter reads. Structural, so this
 * module does not import fflate (the lint rule confines it to the worker
 * folder, and a plain-Node test needs no zip library to drive the cap logic).
 */
export interface InflateEntryInfo {
  readonly name: string;
  /** The declared uncompressed size from the central directory. */
  readonly originalSize: number;
}

/** The two limits, injectable so a test needs no large allocation. */
export interface InflateLimits {
  readonly maxEntryBytes: number;
  readonly maxTotalBytes: number;
}

/**
 * Build a stateful `unzipSync` filter that admits only accepted names and
 * throws a fixed-message error when a declared size breaks a limit.
 *
 * - A name `accepts` rejects returns `false` and is neither inflated nor
 *   counted, so an entry the importer would ignore anyway cannot spend the
 *   budget or trip a limit.
 * - An accepted entry whose declared size is not a finite non-negative number,
 *   or exceeds the per-entry limit, throws `entry too large`.
 * - The declared size is added to a total held in this closure, and exceeding
 *   the total limit throws `archive too large`.
 *
 * One instance per import: the total lives in the closure, so a filter shared
 * between two archives would leak the first one's budget into the second.
 */
export function createInflateFilter(
  accepts: (name: string) => boolean,
  limits: InflateLimits = { maxEntryBytes: MAX_ENTRY_BYTES, maxTotalBytes: MAX_TOTAL_BYTES },
): (info: InflateEntryInfo) => boolean {
  let total = 0;
  return (info) => {
    if (!accepts(info.name)) return false;
    const size = info.originalSize;
    if (!Number.isFinite(size) || size < 0 || size > limits.maxEntryBytes) {
      throw new Error(ENTRY_TOO_LARGE);
    }
    total += size;
    if (total > limits.maxTotalBytes) throw new Error(ARCHIVE_TOO_LARGE);
    return true;
  };
}
