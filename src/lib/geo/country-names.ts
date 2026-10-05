/**
 * English country names, from the platform (phase 06, D-11).
 *
 * ## Main-thread safe
 *
 * This module holds NO table and reads no data. It is the one module in
 * `src/lib/geo/` the main thread may import, and it is safe there precisely
 * because it does nothing but ask `Intl` a question — the country code arrives
 * as a string, already resolved inside the worker.
 *
 * ## Why no bundled list
 *
 * A hand-maintained table of ~250 names is a file that goes stale, a few
 * kilobytes in the main chunk, and a set of typos to review. `Intl.DisplayNames`
 * is in every browser this project targets, and it is the same authority the
 * platform uses to render a region name anywhere else on the machine. D-11
 * settles it: the names come from `Intl`, English whatever the viewer's locale.
 *
 * ## Why the guards come BEFORE the call
 *
 * `Intl.DisplayNames.of()` THROWS a `RangeError` on a structurally invalid
 * code, and a `try/catch` around the call is not enough on its own: `ZZ` is
 * structurally valid on some ICU builds and would render as a name on a table
 * that means "reserved space". The caller's answer for an unmatched address is
 * the muted `Unknown country` (D-08), so `ZZ` and every malformed shape are
 * answered null here, before an `Intl` object is ever constructed.
 *
 * The fall-back for a genuinely thrown error is the raw upper-cased code. That
 * is not a "something went wrong" branch: a code is two letters, it is the
 * only thing the export ever claimed, and a cell showing `DE` is a far better
 * outcome than a cell showing nothing or an exception raised inside a render.
 */

/** A country code is exactly two upper-case ASCII letters (D-08, D-11). */
const COUNTRY_CODE_RE = /^[A-Z]{2}$/;

/** The code the source data uses for reserved space, and the caller's "unknown". */
const UNKNOWN_CODE = 'ZZ';

/**
 * Constructed on FIRST use, never at module load.
 *
 * Two reasons, and the second is the one that matters: the main-thread cost of
 * an object nothing has asked for is small, but a module-load side effect is a
 * thing a bundler can move and a test can observe, and this module is imported
 * by the UI code that has no country to name until an export is loaded.
 */
let displayNames: Intl.DisplayNames | null = null;

function englishRegionNames(): Intl.DisplayNames {
  displayNames ??= new Intl.DisplayNames(['en'], { type: 'region' });
  return displayNames;
}

/**
 * The English name for a two-letter country code, or null.
 *
 * null means "show the caller's unknown state", never "show nothing": D-08
 * gives the caller a muted `Unknown country` for a null, and the map and the
 * country list both need that row to exist with a count beside it.
 *
 * @param code The code as the aggregate stored it — upper case, or null.
 */
export function countryName(code: string | null): string | null {
  if (code === null) return null;
  // The shape test, not `toUpperCase()`: a cell that reached this function as
  // `de` or `DE ` is a bug upstream, and quietly repairing it here would hide
  // that bug while also accepting a code the aggregate never produced.
  if (!COUNTRY_CODE_RE.test(code)) return null;
  if (code === UNKNOWN_CODE) return null;
  try {
    // `of` is typed as returning `string | undefined`; an unrecognised but
    // well-formed code comes back as the code itself on current ICU, and
    // `undefined` on some. Both mean the same thing to a reader.
    return englishRegionNames().of(code) ?? code;
  } catch {
    return code;
  }
}
