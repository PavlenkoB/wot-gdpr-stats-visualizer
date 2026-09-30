import type { CategoryEntry, CategoryStatus, ClassifyResult } from '../types/worker-messages.ts';
import { CATEGORY_STATUS_ORDER, classifyFolder } from './categories.ts';

/**
 * Hardened root/category detection for a Wargaming GDPR export.
 *
 * All inputs here are entry-name STRINGS as returned by
 * `listEntryPaths(...)` from `src/lib/worker/zip-paths.ts`. The lister
 * does NOT normalize names — backslashes, leading "./", and OS-metadata
 * entries are returned verbatim. This module owns:
 *   1. Path normalization (forward slashes only, strip leading "/" or "./")
 *   2. OS-metadata filtering (`__MACOSX/...`, `.DS_Store`, `Thumbs.db`,
 *      `desktop.ini`)
 *   3. Single-root detection with a directory-entry guarantee
 *   4. Per-category file counts (directory entries register 0)
 *   5. The reasoned outcome: a `ClassifyResult` OR one of four named
 *      reasons an archive is NOT a recognizable Wargaming export.
 *
 * Nothing here touches the DOM, a worker, or fflate — every function is
 * pure, so unit tests can run under Node with no fixture infrastructure.
 */

// -----------------------------------------------------------------------------
// New public surface for 01-03
// -----------------------------------------------------------------------------

export type UnrecognizedReason =
  'empty-archive' | 'no-single-root' | 'no-category-folders' | 'no-recognized-category';

export type AnalyzeOutcome =
  { ok: true; result: ClassifyResult } | { ok: false; reason: UnrecognizedReason };

// -----------------------------------------------------------------------------
// Pure helpers
// -----------------------------------------------------------------------------

/**
 * Normalize a single raw entry path:
 *   - replace every backslash with a forward slash
 *   - strip a leading "/" and a leading "./" (preserving what follows)
 *   - preserve a trailing "/" (the directory marker)
 */
export function normalizeEntryPath(path: string): string {
  let p = path.replace(/\\/g, '/');
  while (p.startsWith('/') || p.startsWith('./')) {
    if (p.startsWith('./')) {
      p = p.slice(2);
    } else if (p.startsWith('/')) {
      p = p.slice(1);
    }
  }
  return p;
}

/**
 * True when the path is one of the OS-metadata artifacts that a real
 * archive should never classify as a category folder:
 *   - the `__MACOSX` sidecar tree (macOS Finder zips)
 *   - `.DS_Store`, `thumbs.db`, `desktop.ini` at any depth
 *
 * `path` MUST already have been `normalizeEntryPath`-ed.
 */
export function isOsMetadataEntry(normalizedPath: string): boolean {
  const segments = normalizedPath.split('/').filter((s) => s.length > 0);
  if (segments.length === 0) return false;
  if (segments[0] === '__MACOSX') return true;
  const last = segments[segments.length - 1]!.toLowerCase();
  return last === '.ds_store' || last === 'thumbs.db' || last === 'desktop.ini';
}

/**
 * Internal: normalize, drop empties, drop OS-metadata. Both
 * `detectRoot` and `categoryFoldersUnder` apply this so callers
 * always see a hardened view of the entry-name list.
 */
function prepare(paths: readonly string[]): string[] {
  const out: string[] = [];
  for (const p of paths) {
    if (!p) continue;
    const norm = normalizeEntryPath(p);
    if (!norm) continue;
    if (isOsMetadataEntry(norm)) continue;
    out.push(norm);
  }
  return out;
}

// -----------------------------------------------------------------------------
// 01-01 baseline signatures, now hardened
// -----------------------------------------------------------------------------

/**
 * Detect the account-root folder as the single distinct first path
 * segment, returned only when at least one prepared path STARTS WITH
 * `<segment>/` — that is, the segment acts as a real folder (a lone
 * top-level file like `document.pdf` is NOT a root).
 */
export function detectRoot(paths: string[]): string | null {
  const prepared = prepare(paths);
  if (prepared.length === 0) return null;
  const segmentCounts = new Map<string, number>();
  for (const p of prepared) {
    const seg = p.split('/')[0] ?? '';
    if (!seg) continue;
    segmentCounts.set(seg, (segmentCounts.get(seg) ?? 0) + 1);
  }
  if (segmentCounts.size !== 1) return null;
  const [root] = [...segmentCounts.keys()];
  if (!root) return null;
  const prefix = root + '/';
  for (const p of prepared) {
    if (p.startsWith(prefix)) return root;
  }
  return null;
}

/**
 * For every prepared path beneath `<root>/<category>/...`, count it.
 *
 *   - File entries (not ending in "/") add 1.
 *   - Directory entries register the category with 0.
 *   - Files directly under the root (no category segment) are skipped.
 *
 * An empty `root` means "no root folder" — the category folders sit at
 * the top level. It delegates to the prefix-agnostic internal read rather
 * than building the prefix `"/"`, which would match nothing and silently
 * return an empty Map (01-07, WR-03).
 */
export function categoryFoldersUnder(root: string, paths: string[]): Map<string, number> {
  return foldersAt(root === '' ? '' : root + '/', paths);
}

/**
 * Internal: generalize the category-folder count to any prefix.
 *
 *   - If `prefix` is non-empty, only paths starting with `prefix` are
 *     considered; `rest` is the path with `prefix` sliced off.
 *   - If `prefix` is the empty string, every prepared path is considered
 *     in full (used for the rootless case where category folders sit at
 *     the top level).
 *   - File entries (no trailing "/") whose `rest` contains at least one
 *     "/" add 1 to the segment just before that slash (the "category").
 *   - Directory entries (trailing "/") register the segment with 0.
 *   - Paths with no "/" after the prefix are skipped (files directly
 *     under the prefix, or lone top-level files when prefix is "").
 *
 * Normalizes and filters OS-metadata exactly as `categoryFoldersUnder`
 * did before, so callers always see a hardened view.
 */
function foldersAt(prefix: string, paths: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>();
  const prepared = prepare(paths);
  for (const p of prepared) {
    let rest: string;
    if (prefix === '') {
      rest = p;
    } else {
      if (!p.startsWith(prefix)) continue;
      rest = p.slice(prefix.length);
      if (!rest) continue; // the prefix's own directory entry, e.g. "<prefix>"
    }
    const slash = rest.indexOf('/');
    if (slash === -1) continue; // a file directly under the prefix
    const category = rest.slice(0, slash);
    if (!category) continue;
    if (rest.endsWith('/')) {
      // Directory entry: register the category with 0 (idempotent on repeat).
      if (!counts.has(category)) counts.set(category, 0);
      continue;
    }
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }
  return counts;
}

/**
 * Internal: true when at least one of the category counts corresponds
 * to a recognized Wargaming category (supported or known-deferred).
 * Anything else stays as an `unknown` entry alongside the recognized
 * ones (RESEARCH Pitfall 1) — but if NO category is recognized, the
 * archive as a whole is "not a Wargaming export" and must fail.
 */
function hasRecognizedCategory(counts: Map<string, number>): boolean {
  for (const name of counts.keys()) {
    if (classifyFolder(name) !== 'unknown') return true;
  }
  return false;
}

/**
 * Bound on the wrapper-descent retry. Real exports need at most one
 * extra wrapper level; this just leaves a small headroom for unusual
 * but legitimate nesting chains (e.g. a user unzipped then re-zipped
 * inside a "Downloads" folder and then inside a "Personal" folder).
 * A maliciously deep chain of single-child folders cannot force
 * unbounded work per import (T-01-18).
 */
const MAX_WRAPPER_DEPTH = 4;

/**
 * The folder name Wargaming puts at the top of the export it hands out
 * (the same name the repo's own fixtures use, see
 * `tests/fixtures/export-fixtures.ts`). It is a Wargaming artifact, NOT an
 * account id, so it is never reported as `accountRoot`.
 *
 * Why a name is the only signal here (01-07, CR-01): the wrapper-around-
 * categories shape (`personal_data_export/Activity_history/foo.csv`) and
 * the canonical single-account shape (`123456789/Activity_history/...`)
 * are STRUCTURALLY identical — one top-level folder whose direct children
 * are recognized categories. No path-shape predicate can tell them apart;
 * any "single folder above recognized categories is a wrapper" rule would
 * report `accountRoot: ''` for the ordinary account-id export and throw
 * away a real account id. The discriminator is therefore the folder name,
 * and it is an explicit allow-list of Wargaming's own export-wrapper name
 * rather than a guess between the two shapes: `WrapperName/1234567/...`
 * and `renamed-root-2026/...` are untouched, because only the names
 * Wargaming itself emits match.
 */
const EXPORT_WRAPPER_FOLDER = 'personal_data_export';

/**
 * True when `name` is Wargaming's export-wrapper folder (case-insensitive),
 * i.e. a folder that is transparent in `accountRoot` terms.
 */
function isTransparentWrapper(name: string): boolean {
  return name.toLowerCase() === EXPORT_WRAPPER_FOLDER;
}

/**
 * Internal: depth-tolerant root + category resolution (G-01-20, 01-07).
 *
 * Walks the prepared entry list looking for a real account-ID folder
 * with at least one recognized Wargaming category under it. Returns
 * `{ root, counts }` on success (with `root` being the innermost
 * folder name, never a wrapper prefix) or `null` when no shape
 * matches. Two complementary strategies, tried in this order:
 *
 *   1. Rootless read (01-07, WR-06). Read the top-level segments
 *      directly, before any named-reason chain can run. When the
 *      top-level segments are themselves real category folders (no
 *      account-ID wrapper above them), report `accountRoot === ''`.
 *      This handles `Activity_history/..., Payment_history/...` shapes —
 *      what a user gets when their re-zip tool flattened the account-ID
 *      folder away. Running it FIRST removes the WR-06 reachability gap:
 *      a wrapper retry that exhausts can no longer pre-empt the rootless
 *      read, so a rootless re-zip is never mis-routed to a named reason.
 *
 *   2. detectRoot-style wrapper retry. When detectRoot() finds a
 *      single top-level folder whose only child is itself unrecognized,
 *      try the inner folder as the new candidate root. This handles
 *      `WrapperName/AccountId/Category/...` shapes — exactly what a
 *      user gets when they re-zip a downloaded archive into an extra
 *      top-level folder. The retry is bounded by MAX_WRAPPER_DEPTH so
 *      a single-child-folder chain cannot loop forever.
 *
 * Whatever candidate root the retry settles on is reported only if it is
 * a real account id: Wargaming's own export-wrapper folder is
 * transparent, so a wrapper that sits DIRECTLY above the recognized
 * categories (the account-ID wrapper dropped on re-zip, CR-01) reports
 * `accountRoot === ''` instead of the wrapper name.
 *
 * An ambiguous wrapper (root with TWO distinct, equally unrecognized
 * children) is intentionally NOT guessed between — the retry only
 * descends when the sole child is one folder, and the rootless read
 * never starts classifying it. Failure paths still surface as named
 * `UnrecognizedReason`s via analyzeExport's fallback chain.
 */
function resolveAccountRootAndCategories(
  prepared: string[],
): { root: string; counts: Map<string, number> } | null {
  // Strategy 1: rootless read, before anything else (WR-06).
  const counts0 = foldersAt('', prepared);
  if (hasRecognizedCategory(counts0)) {
    return { root: '', counts: counts0 };
  }

  // Strategy 2: wrapper-descent retry.
  const root = detectRoot(prepared);
  if (root !== null) {
    let fullRoot = root;
    let displayRoot = root;
    let counts = categoryFoldersUnder(fullRoot, prepared);
    let depth = 0;
    while (!hasRecognizedCategory(counts) && counts.size === 1 && depth < MAX_WRAPPER_DEPTH) {
      const [onlyFolder] = [...counts.keys()];
      const nextCounts = categoryFoldersUnder(`${fullRoot}/${onlyFolder}`, prepared);
      if (nextCounts.size === 0) break; // dead end — no further nesting to try
      fullRoot = `${fullRoot}/${onlyFolder}`;
      displayRoot = onlyFolder;
      counts = nextCounts;
      depth += 1;
    }
    if (hasRecognizedCategory(counts)) {
      // CR-01: a Wargaming export-wrapper folder is not an account id —
      // when the categories hang directly off it, the account-root layer
      // is gone and the honest answer is `''`, not the wrapper name.
      return { root: isTransparentWrapper(displayRoot) ? '' : displayRoot, counts };
    }
    // No recognized category found at any depth we tried. Fall through
    // to the existing reason-classification chain in analyzeExport
    // (preserves every pre-existing failure fixture's exact reason).
    return null;
  }
  return null;
}

// -----------------------------------------------------------------------------
// analyzeExport — the reasoned outcome
// -----------------------------------------------------------------------------

/**
 * Build a ClassifyResult from a list of raw entry paths. Returns a
 * `not-ok` outcome with a named reason when the archive is not
 * recognizable enough to be called a Wargaming export:
 *
 *   empty-archive          — the prepared list is empty (after OS-metadata
 *                            filtering); the archive has no payload rows
 *                            that we can act on.
 *   no-single-root         — the entry list has zero or two+ distinct
 *                            first segments, OR the single distinct
 *                            segment is never followed by a "/" (a lone
 *                            top-level file is not a root folder).
 *   no-category-folders    — a single root exists, but the archive has
 *                            no second-level folders beneath it.
 *   no-recognized-category — categories exist under the root, but none
 *                            of them is `supported` or `known-deferred`
 *                            (every folder is unknown). This is FA-01-03-2:
 *                            success criterion 2 requires ordinary
 *                            non-Wargaming zips (e.g. a holiday-photos
 *                            folder) to fail, so a future export in
 *                            which every folder is renamed would be
 *                            rejected — reversible (one predicate).
 *
 * Unknown folders alongside at least one recognized folder ALWAYS
 * stay in the result as `unknown` entries (RESEARCH Pitfall 1).
 *
 * Since 01-06 (G-01-20) analyzeExport is depth-tolerant: a wrapper
 * folder around a real export or a rootless re-zip with category
 * folders at the top level now classifies correctly, while every
 * pre-existing failure fixture keeps its exact reason. See
 * resolveAccountRootAndCategories() for the bounded retry + top-level
 * fallback that powers this.
 *
 * Ordering within a status group is locale-INDEPENDENT: lowercase
 * code-unit order, then raw code-unit order as the tie-break. Plain
 * JS less-than is used (no locale-aware string comparison), because
 * Node and the browser can disagree on locale tables and D-05 / FA-
 * 01-03-2 demand identical ordering on both ends.
 */
export function analyzeExport(paths: string[]): AnalyzeOutcome {
  const prepared = prepare(paths);
  if (prepared.length === 0) return { ok: false, reason: 'empty-archive' };

  const resolved = resolveAccountRootAndCategories(prepared);
  if (resolved !== null) {
    const { root, counts } = resolved;
    const entries: CategoryEntry[] = [];
    const statusCounts: Record<CategoryStatus, number> = {
      supported: 0,
      'known-deferred': 0,
      unknown: 0,
    };
    // resolveAccountRootAndCategories guarantees hasRecognizedCategory,
    // so every entry is recorded without an explicit hasRecognized gate.
    for (const [name, fileCount] of counts) {
      const status = classifyFolder(name);
      entries.push({ name, status, fileCount });
      statusCounts[status] += 1;
    }

    entries.sort((a, b) => {
      const sa = CATEGORY_STATUS_ORDER.indexOf(a.status);
      const sb = CATEGORY_STATUS_ORDER.indexOf(b.status);
      if (sa !== sb) return sa - sb;
      const la = a.name.toLowerCase();
      const lb = b.name.toLowerCase();
      if (la < lb) return -1;
      if (la > lb) return 1;
      if (a.name < b.name) return -1;
      if (a.name > b.name) return 1;
      return 0;
    });

    return {
      ok: true,
      result: {
        accountRoot: root,
        categories: entries,
        counts: statusCounts,
      },
    };
  }

  // Pre-existing reason-classification fallback (preserves every
  // pre-fix failure fixture's exact reason). Recomputed rather than
  // cached inside resolveAccountRootAndCategories so the named-reason
  // mapping stays a single self-contained linear pipeline.
  const root = detectRoot(prepared);
  if (root === null) return { ok: false, reason: 'no-single-root' };
  const counts = categoryFoldersUnder(root, prepared);
  if (counts.size === 0) return { ok: false, reason: 'no-category-folders' };
  return { ok: false, reason: 'no-recognized-category' };
}

/**
 * 01-01 back-compat wrapper: returns the `result` on success and `null`
 * on every named failure (callers written before 01-03 still see the
 * same null-check shape). New callers should prefer `analyzeExport`.
 */
export function classifyExport(paths: string[]): ClassifyResult | null {
  const outcome = analyzeExport(paths);
  return outcome.ok ? outcome.result : null;
}

// -----------------------------------------------------------------------------
// resolveCsvFileCategory — per-entry name → { category, sourceFile } (02-01)
// -----------------------------------------------------------------------------
//
// Why this exists (02-01-PLAN Task 3, IMPORT-01 + key_links invariant):
//   The ingest worker inflates ONLY the CSV entries that belong to a
//   recognized category (D-01, D-02, IMPORT-01). It calls
//   `resolveCsvFileCategory(info.name, accountRoot, recognizedSet)` on
//   every zip entry during the `unzipSync` filter to decide which to
//   inflate. The mapping must agree with `analyzeExport`'s own
//   category resolution — otherwise the per-category `rowCount` in
//   `db.meta.categories` would silently diverge from the row counts
//   the worker actually wrote.
//
// Rules (mirroring classify.ts's existing `prepare` + `categoryFoldersUnder`):
//   1. Normalize the raw name (forward slashes only, strip leading
//      '/' or './' — the existing `normalizeEntryPath`).
//   2. Reject OS-metadata (the existing `isOsMetadataEntry`) and
//      directory entries (trailing '/').
//   3. Strip the `${root}/` prefix. When `root` is non-empty that is
//      either the direct prefix or a rightmost `/${root}/` wrapper
//      prefix. When `root === ''` there is nothing to strip, but the
//      path may still carry a TRANSPARENT wrapper above the categories
//      (the CR-01 shape `personal_data_export/Activity_history/x.csv`,
//      which `analyzeExport` reports as `accountRoot: ''` on purpose
//      so a wrapper name is never displayed as an account id).
//      So the prefix to drop is the leading run of segments up to the
//      first RECOGNIZED CATEGORY segment — not blindly segment 0.
//   4. Take the first segment after that prefix as the `category`.
//   5. Reject when no recognized category segment exists at all, when
//      the category is not in `recognizedCategories`, or when the
//      remaining path does not end in `.csv` (case-insensitive).
//   6. Otherwise return `{ category, sourceFile: <rest> }`.
//
// Step 3's "first recognized category segment" rule is what keeps this
// function in agreement with `analyzeExport` under `root === ''`.
// Without it, the CR-01 shape resolved its category to the wrapper
// itself, every entry was rejected, and the worker reported a
// successful import of an entirely empty dashboard.
//
// Returns `null` on every rejection path; callers use the null-check
// shape `if (resolveCsvFileCategory(...) !== null)`.
export function resolveCsvFileCategory(
  rawName: string,
  root: string,
  recognizedCategories: ReadonlySet<string>,
): { category: string; sourceFile: string } | null {
  const normalized = normalizeEntryPath(rawName);
  if (isOsMetadataEntry(normalized)) return null;
  if (normalized.endsWith('/')) return null; // directory entry, not a CSV file

  let rest: string;
  if (root === '') {
    // `accountRoot === ''` does NOT mean "the categories sit at the top
    // level". It ALSO covers the transparent-wrapper shape from CR-01,
    // where the wrapper folder is deliberately not reported as an
    // account id and the categories hang one (or more) wrapper folders
    // deeper — `personal_data_export/Activity_history/foo.csv` resolves
    // to `''` with the category `Activity_history`.
    //
    // Blindly taking segment 0 as the category there resolves it to the
    // wrapper itself, which is not a recognized category, so every entry
    // is rejected. The worker's `unzipSync` filter then inflates nothing
    // and the import "succeeds" with an entirely empty dashboard. So
    // locate the first segment that IS a recognized category and treat
    // everything above it as transparent prefix.
    //
    // This is the same rule the docstring above demands: the mapping must
    // agree with `analyzeExport`'s own category resolution. A bare
    // `foo.csv` with no category folder anywhere still returns null, and
    // the genuinely-rootless `Activity_history/a.csv` is unchanged
    // (its first segment is already the category, start = 0).
    const segments = normalized.split('/');
    const lastSegment = segments.length - 1; // the filename itself
    let start = -1;
    for (let i = 0; i < lastSegment; i++) {
      if (recognizedCategories.has(segments[i]!)) {
        start = i;
        break;
      }
    }
    if (start === -1) return null; // no category folder anywhere in the path
    rest = segments.slice(start).join('/');
  } else {
    // Accept either a `${root}/...` direct prefix OR a rightmost
    // `/${root}/...` wrapper-prefixed path. The wrapper case is the
    // 2021 Wargaming export shape (e.g.
    // `${dateFolder}/${root}/${category}/${file}.csv`) — analyzeExport's
    // wrapper-retry returns the inner account root, but the CSVs sit
    // one wrapper folder deeper than `${root}/`. OS-metadata entries
    // (`__MACOSX/...` sidecars) are rejected above before this point,
    // so a coincidental match inside a sidecar path cannot leak through.
    // Bounded by MAX_WRAPPER_DEPTH upstream — lastIndexOf would find any
    // deeper nested match, but the analysis layer has already bounded
    // the depth at which `${root}/` is identified.
    const directPrefix = root + '/';
    if (normalized.startsWith(directPrefix)) {
      rest = normalized.slice(directPrefix.length);
    } else {
      const rootSuffix = '/' + root + '/';
      const idx = normalized.lastIndexOf(rootSuffix);
      if (idx === -1) return null;
      rest = normalized.slice(idx + rootSuffix.length);
    }
    if (!rest) return null;
  }

  const slash = rest.indexOf('/');
  if (slash === -1) return null; // file directly under the root
  const category = rest.slice(0, slash);
  if (!category) return null;
  if (!recognizedCategories.has(category)) return null;
  const sourceFile = rest.slice(slash + 1);
  if (!sourceFile.toLowerCase().endsWith('.csv')) return null;
  return { category, sourceFile };
}
