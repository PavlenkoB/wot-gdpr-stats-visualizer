import { unzipSync } from 'fflate';

/**
 * Path-only zip enumeration. Wraps fflate's `unzipSync` filter side-channel
 * so the worker can read every entry's `name` without inflating any entry's
 * bytes. This is the safety-critical boundary that:
 *
 *   - satisfies RESEARCH A2 (fflate throws "invalid zip data" on corrupt
 *     bytes — the throw lands in the worker's single try block, which
 *     routes the failure through the generic error banner);
 *   - satisfies the T-01-04 hand-off from 01-01: a zip whose first
 *     deflate stream is corrupt must still list every entry name, while
 *     a full unzip on the same bytes throws.
 *
 * Names are returned verbatim — backslashes, leading `./` prefixes and
 * `__MACOSX/...` sidecars are NOT normalized here. Normalization is the
 * classifier's job (see `classify.ts:normalizeEntryPath`); mixing the two
 * would couple two unrelated responsibilities and make this module's
 * "never inflate" invariant harder to verify.
 *
 * The filter always returns `false`, so fflate never inflates an entry
 * even if it has the bytes in memory — a zip-bomb is bounded by the
 * archive's central directory, not by its largest claimed file size.
 */
export function listEntryPaths(bytes: Uint8Array): string[] {
  const names: string[] = [];
  unzipSync(bytes, {
    filter(info) {
      names.push(info.name);
      return false; // never inflate — path-only enumeration (zip-bomb safe)
    },
  });
  return names;
}
