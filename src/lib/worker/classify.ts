import type {
  AccountSummary,
  CategoryEntry,
  CategoryStatus,
  ClassifyResult,
} from '../core/types/worker-messages.ts';
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
 *   3. N-account-root resolution (Phase 9, D-01..D-05) plus the unchanged
 *      single-root chain for every archive with NO account root
 *   4. Per-category file counts (directory entries register 0)
 *   5. The reasoned outcome: a `ClassifyResult` OR one of the named
 *      reasons an archive is NOT a recognizable Wargaming export.
 *
 * Nothing here touches the DOM, a worker, or fflate — every function is
 * pure, so unit tests can run under Node with no fixture infrastructure.
 */

// -----------------------------------------------------------------------------
// New public surface for 01-03
// -----------------------------------------------------------------------------

export type UnrecognizedReason =
  | 'empty-archive'
  | 'no-single-root'
  | 'no-category-folders'
  | 'no-recognized-category'
  | 'ambiguous-root'
  | 'no-csv-data'
  | 'too-many-roots'
  | 'root-name-too-long';

export type AnalyzeOutcome =
  | { ok: true; result: ClassifyResult; roots: AccountRootAnalysis[] }
  | { ok: false; reason: UnrecognizedReason };

/**
 * One account root's own category list (Phase 9, D-01).
 *
 * `analyzeExport` reports every root it found with that root's OWN categories
 * and file counts, alongside the merged list in `result.categories` (merged by
 * exact folder name, so two roots carrying `Player_Statistics` report one
 * merged entry with the summed count).
 *
 * `roots` is in CODE-UNIT order of the root names. D-16 order (first
 * activity year ascending) is applied by the ingest worker after parsing,
 * because years exist only once rows have been read.
 */
export interface AccountRootAnalysis {
  root: string;
  categories: CategoryEntry[];
}

/**
 * Hard cap on the number of account roots one archive may declare (Phase 9,
 * D-20 / T-09-02). The user's real export has three.
 *
 * The cap exists for COST, not for trust: an archive with thousands of
 * well-formed account folders would multiply the parse, the inflate budget and
 * the stored rows for no realistic export.
 *
 * ## What the code actually costs (09-09, WR-02)
 *
 * The root scan is ONE pass over the entry list, and the cap is decided from
 * its result BEFORE any per-root category counting — so an archive with 3,000
 * account folders is rejected at the same cost as one with 3,000 loose files,
 * and the rejection itself is cheap.
 *
 * What is NOT one pass is the work for a root that survives the cap: each root
 * is counted through `foldersAt`, which re-runs `prepare()` over the WHOLE
 * entry list before scanning it. The honest statement is therefore a product of
 * a pass and a count of survivors, not a linear scan: `MAX_ACCOUNT_ROOTS` (32)
 * and {@link MAX_ROOT_NAME_LENGTH} are what bound it. Those two constants —
 * together with the existing unit cases for the cap, cap+1 and the many-folder
 * cost case — are what make this note checkable rather than aspirational.
 *
 * It applies to ONE root as well as to several. Restricting it to several would
 * leave a single 60 KB root name free to be stamped onto every stored row,
 * which is the other half of the same bound ({@link MAX_ROOT_NAME_LENGTH}).
 */
export const MAX_ACCOUNT_ROOTS = 32;

/**
 * Hard bound on the length of an account folder name (Phase 9, D-20 /
 * T-09-02).
 *
 * The root name is stamped onto every stored row (D-07) and shown in the
 * identity header, so an unbounded folder name would be copied into every row
 * of the dataset. Real Wargaming export folders are numeric account ids.
 *
 * This NARROWS one v1.0 shape on purpose: a single account folder named longer
 * than 128 characters used to import and now fails with the one generic
 * banner. The narrowing is recorded as a decision (D-20), not a defect, and
 * the bound holds for every root count including one — a bound that applied
 * only to several roots would let the very row-copy cost it exists to stop
 * through the single-root door.
 */
export const MAX_ROOT_NAME_LENGTH = 128;

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
 * unbounded work per import (T-01-32).
 */
const MAX_WRAPPER_DEPTH = 4;

/**
 * Internal: does an UNKNOWN category-level folder beneath `prefix` itself
 * hold a recognized category? (CR-01 / W-1, plan 01-11, threat T-01-42.)
 *
 * `prefix` is `''` for the top level, or a `<folder>/` prefix. For every
 * prepared path under it, the first segment is the category-level folder.
 * That folder is "itself a root" when:
 *
 *   - `classifyFolder(name)` is `'unknown'` (a recognized folder is never a
 *     root candidate), AND
 *   - within the first `MAX_WRAPPER_DEPTH` DIRECTORY segments beneath it
 *     (the filename, or the empty tail of a directory entry, is dropped
 *     first) some segment classifies as recognized.
 *
 * A real account folder looks exactly like this
 * (`123/User_Info/Account_Info.csv`), so a recognized sibling beside it
 * cannot be told apart from "an unknown folder that happens to hold
 * category-named data". The resolver therefore refuses to guess.
 *
 * One linear pass over the already-prepared path list (T-01-43): each path
 * is split once and examined to at most `MAX_WRAPPER_DEPTH` segments, so
 * the cost does not grow with the number of distinct unknown folders.
 */
function unknownFolderHoldsRecognized(prefix: string, prepared: readonly string[]): boolean {
  for (const p of prepared) {
    if (prefix !== '' && !p.startsWith(prefix)) continue;
    const rest = prefix === '' ? p : p.slice(prefix.length);
    if (!rest) continue;
    const segments = rest.split('/');
    // segments[0] is the category-level folder; it must be a directory, so
    // there has to be at least one more segment (a filename or the empty
    // tail of a directory entry). `foldersAt` skips the same shape.
    if (segments.length < 2) continue;
    const name = segments[0]!;
    if (!name || classifyFolder(name) !== 'unknown') continue;
    // Drop the name and the filename (or the empty tail of "dir/"), then
    // look at no more than MAX_WRAPPER_DEPTH directory levels.
    const dirs = segments.slice(1, -1).slice(0, MAX_WRAPPER_DEPTH);
    for (const dir of dirs) {
      if (dir && classifyFolder(dir) !== 'unknown') return true;
    }
  }
  return false;
}

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
 * The three outcomes of `resolveAccountRootAndCategories` (01-11):
 *
 *   - `resolved`  — a root (possibly `''`) and its category counts.
 *   - `ambiguous` — a rootless reading was possible, but an unknown
 *                   top-level folder holds a recognized category beneath it,
 *                   so the importer will not guess which folder is the
 *                   account. `analyzeExport` maps this straight to
 *                   `'ambiguous-root'`.
 *   - `null`      — no shape matched; `analyzeExport` names the failure
 *                   through its legacy detectRoot / categoryFoldersUnder
 *                   chain.
 */
type RootResolution =
  { kind: 'resolved'; root: string; counts: Map<string, number> } | { kind: 'ambiguous' } | null;

/**
 * Internal: depth-tolerant root + category resolution (G-01-20, 01-07).
 *
 * Walks the prepared entry list looking for a real account-ID folder
 * with at least one recognized Wargaming category under it. Returns
 * a `resolved` outcome (with `root` being the innermost folder name,
 * never a wrapper prefix), an `ambiguous` marker (01-11, CR-01 / W-1) or
 * `null` when no shape matches. Two complementary strategies, tried in
 * this order:
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
 *      Fail-closed condition (CR-01 / W-1, 01-11, T-01-42): the rootless
 *      claim "there is no account folder" is falsified when an UNKNOWN
 *      top-level folder holds a recognized category within
 *      `MAX_WRAPPER_DEPTH` directory levels beneath it
 *      (`123/User_Info/...` + `123/Activity_history/...` beside `Clans/`).
 *      That folder looks exactly like a real account root, so the importer
 *      does not guess between the two readings and reports `ambiguous`. An
 *      unknown folder with NO recognized category beneath it
 *      (`Misc/x.csv`) is ordinary data and stays an `unknown` entry
 *      (RESEARCH Pitfall 1).
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
function resolveAccountRootAndCategories(prepared: string[]): RootResolution {
  // Strategy 1: rootless read, before anything else (WR-06).
  const counts0 = foldersAt('', prepared);
  if (hasRecognizedCategory(counts0)) {
    // CR-01 / W-1 (T-01-42): a recognized sibling does not prove there is
    // no account folder. When an unknown top-level folder itself holds a
    // recognized category beneath it, that folder may be the real account
    // root, and filing it as an "unknown category" would let its
    // User_Info bypass the folder-name strip. Fail closed.
    if (unknownFolderHoldsRecognized('', prepared)) return { kind: 'ambiguous' };
    return { kind: 'resolved', root: '', counts: counts0 };
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
      if (isTransparentWrapper(displayRoot)) {
        // The reported root would be '': the same "there is no account
        // folder" claim as Strategy 1, so the same falsifier applies
        // (01-11). Examined beneath the FULL settled prefix. A real
        // (non-transparent) root is never examined: there an unknown
        // folder holding a category-named subfolder is ordinary nested
        // data (T-01-45; plan 01-13 protects the strip).
        if (unknownFolderHoldsRecognized(`${fullRoot}/`, prepared)) {
          return { kind: 'ambiguous' };
        }
        return { kind: 'resolved', root: '', counts };
      }
      return { kind: 'resolved', root: displayRoot, counts };
    }
    // No recognized category found at any depth we tried. Fall through
    // to the existing reason-classification chain in analyzeExport
    // (preserves every pre-existing failure fixture's exact reason).
    return null;
  }
  return null;
}

// -----------------------------------------------------------------------------
// Phase 9: the N-account-root resolver (D-01..D-06)
// -----------------------------------------------------------------------------

/**
 * The three non-`null` outcomes of {@link resolveAccountRoots}, plus the
 * failure rules each one stands for. Every one of them is decided BEFORE any
 * per-root category counting runs, which is what keeps the cost of a hostile
 * archive at one linear pass (T-09-02).
 *
 *   `roots`         — at least one account root was found and every rule held
 *   `too-many`      — more than {@link MAX_ACCOUNT_ROOTS} roots (D-20)
 *   `name-too-long` — a root name longer than {@link MAX_ROOT_NAME_LENGTH} (D-20)
 *   `ambiguous`     — a recognised category sits at the candidate level (D-04),
 *                     or two root names collide case-insensitively (T-09-03)
 *   `stray`         — any other non-root candidate folder (D-02)
 *   `null`          — NO account root exists, so the unchanged v1.0 chain runs
 */
type MultiRootResolution =
  | { kind: 'roots'; roots: AccountRootAnalysis[] }
  | { kind: 'too-many' }
  | { kind: 'name-too-long' }
  | { kind: 'ambiguous' }
  | { kind: 'stray' }
  | null;

/**
 * Is this candidate folder an ACCOUNT ROOT (D-01)?
 *
 * A root is a folder whose own name is NOT a recognised Wargaming category and
 * which DIRECTLY holds at least one folder that IS one (supported or
 * known-deferred). The name itself is never checked: a real account folder is
 * a numeric id, a re-zipped one is `WrapperName`, and a renamed one is
 * anything else.
 *
 * The "directly holds" part is load-bearing and is why `unknownFolderHolds-
 * Recognized` is NOT reused here: that helper answers "does this unknown
 * top-level folder hold a recognised folder SOMEWHERE beneath it", which is
 * true of every account root in every archive, so using it as the multi-root
 * rule would reject every multi-account export (RESEARCH Pitfall 4).
 */
function isAccountRoot(name: string, children: ReadonlySet<string>): boolean {
  if (classifyFolder(name) !== 'unknown') return false;
  for (const child of children) {
    if (classifyFolder(child) !== 'unknown') return true;
  }
  return false;
}

/**
 * Resolve every account root in one archive (Phase 9).
 *
 * ONE linear pass over the already-prepared entries. The pass records, for
 * every candidate folder, the set of its DIRECT child folder names using
 * exactly the rule `foldersAt` applies — the segment after the candidate's
 * prefix, taken only when a further slash follows it, directory entries
 * included. Nothing here is per-candidate: an archive with 3,000 top-level
 * folders costs one pass, not 3,000 scans (T-09-02, the T-01-43 cost class).
 *
 * Loose top-level FILES are skipped entirely (D-05). They are not candidates,
 * so they can neither be a root nor trip the stray-folder rule. This is what
 * lets the real sample's two `Readme_*.pdf` sit beside three account folders.
 * `detectRoot` still counts them, which is deliberate: with ZERO roots the
 * unchanged v1.0 chain runs and keeps producing `no-single-root` for a lone
 * top-level file (RESEARCH Pitfall 5).
 *
 * Wargaming's own `personal_data_export` folder stays transparent (D-03): when
 * it is the ONLY top-level name, its children become the candidates and the
 * candidate's prefix is spelled as written. Any OTHER wrapper holding several
 * account roots is NOT a container of roots — it keeps failing, because the
 * root rule demands a candidate hold a recognised category DIRECTLY (pinned
 * shape `w/x/Activity_history/...` + `w/y/Payment_history/...`).
 *
 * One wrapper shape is handed back to the v1.0 chain rather than read here: the
 * wrapper sitting DIRECTLY above recognised categories
 * (`personal_data_export/Activity_history/foo.csv`), with or without account
 * folders beside them. That is the CR-01 shape, where the account-folder layer
 * is gone and the honest answer is `accountRoot === ''` (or `ambiguous-root`
 * when an unknown folder beside it holds a `User_Info`). Reading it as "N
 * roots" would report a wrapper child as an account id.
 */
function resolveAccountRoots(prepared: readonly string[]): MultiRootResolution {
  /** Distinct top-level folder names, in first-seen order. */
  const topLevel = new Set<string>();
  /** First-segment folder name → its direct child FOLDER names. */
  const children = new Map<string, Set<string>>();
  /** Second-segment name under the transparent wrapper → its child folders. */
  const wrapperChildren = new Map<string, Set<string>>();

  for (const p of prepared) {
    const slash1 = p.indexOf('/');
    if (slash1 === -1) continue; // a loose top-level FILE (D-05)
    const first = p.slice(0, slash1);
    topLevel.add(first);
    let kids = children.get(first);
    if (kids === undefined) {
      // Seeded even when this folder holds nothing but loose files, so a
      // stray folder beside a root is still seen as a candidate (D-02).
      kids = new Set<string>();
      children.set(first, kids);
    }
    const rest = p.slice(slash1 + 1);
    const slash2 = rest.indexOf('/');
    if (slash2 === -1) continue; // a file directly under `first`
    kids.add(rest.slice(0, slash2));

    // Only entries under the wrapper need the second-level bookkeeping, and
    // "the only top-level name is the wrapper" implies exactly those entries
    // are the ones whose first segment is the wrapper.
    if (!isTransparentWrapper(first)) continue;
    const second = rest.slice(0, slash2);
    let wrapped = wrapperChildren.get(second);
    if (wrapped === undefined) {
      // Seeded for EVERY second segment, exactly as the top-level map seeds
      // every first segment: a folder holding only loose files is still a
      // candidate, so a stray folder beside the roots fails closed (D-02)
      // under the wrapper just as it does at the top level.
      wrapped = new Set<string>();
      wrapperChildren.set(second, wrapped);
    }
    const afterSecond = rest.slice(slash2 + 1);
    const slash3 = afterSecond.indexOf('/');
    if (slash3 === -1) continue; // a file directly under the candidate folder
    wrapped.add(afterSecond.slice(0, slash3));
  }

  // Candidate folders, and the prefix each one's files sit under, as written.
  let candidates: Map<string, Set<string>> = children;
  let prefixOf: (root: string) => string = (root) => `${root}/`;
  if (topLevel.size === 1) {
    const [only] = [...topLevel];
    if (only !== undefined && isTransparentWrapper(only)) {
      // The wrapper's own direct children are the second segments, which is
      // exactly what `children` recorded. A recognised one there means the
      // categories hang off the wrapper itself (CR-01), not off account roots.
      if (holdsRecognizedFolder(children.get(only) ?? new Set<string>())) return null;
      candidates = wrapperChildren;
      prefixOf = (root) => `${only}/${root}/`;
    }
  }

  const roots: string[] = [];
  const nonRoots: string[] = [];
  for (const [name, kids] of candidates) {
    (isAccountRoot(name, kids) ? roots : nonRoots).push(name);
  }
  // Zero roots: hand the archive back to the unchanged v1.0 chain.
  if (roots.length === 0) return null;

  // The bounds, before ANY per-root work (D-20, T-09-02).
  if (roots.length > MAX_ACCOUNT_ROOTS) return { kind: 'too-many' };
  for (const root of roots) {
    if (root.length > MAX_ROOT_NAME_LENGTH) return { kind: 'name-too-long' };
  }
  // A recognised category at the candidate level cannot be attributed to an
  // account (D-04) — the reason name stays `ambiguous-root`, which is what the
  // pinned single-root tests already assert for this family of shapes.
  for (const name of nonRoots) {
    if (classifyFolder(name) !== 'unknown') return { kind: 'ambiguous' };
  }
  if (nonRoots.length > 0) return { kind: 'stray' };
  // Two roots differing only in case would blur the per-root pools (T-09-03).
  const lowered = new Set<string>();
  for (const root of roots) {
    const lower = root.toLowerCase();
    if (lowered.has(lower)) return { kind: 'ambiguous' };
    lowered.add(lower);
  }

  roots.sort();
  return {
    kind: 'roots',
    roots: roots.map((root) => ({
      root,
      categories: sortCategoryEntries(countsToEntries(foldersAt(prefixOf(root), prepared))),
    })),
  };
}

/** Internal: does any of these folder names classify as supported or known-deferred? */
function holdsRecognizedFolder(names: ReadonlySet<string>): boolean {
  for (const name of names) {
    if (classifyFolder(name) !== 'unknown') return true;
  }
  return false;
}

/** Internal: does any `.csv` entry sit under one of these roots' prefixes? */
function hasCsvUnderAnyRoot(prepared: readonly string[], roots: ReadonlySet<string>): boolean {
  for (const p of prepared) {
    if (!p.toLowerCase().endsWith('.csv')) continue;
    const slash = p.indexOf('/');
    if (slash === -1) continue;
    const first = p.slice(0, slash);
    if (roots.has(first)) return true;
    if (isTransparentWrapper(first)) {
      const rest = p.slice(slash + 1);
      const slash2 = rest.indexOf('/');
      if (slash2 !== -1 && roots.has(rest.slice(0, slash2))) return true;
    }
  }
  return false;
}

// -----------------------------------------------------------------------------
// analyzeExport — the reasoned outcome
// -----------------------------------------------------------------------------

/**
 * Sort category entries into the canonical order: status group, then
 * lower-case code-unit name, then raw name.
 *
 * Ordering within a status group is locale-INDEPENDENT: lowercase
 * code-unit order, then raw code-unit order as the tie-break. Plain JS
 * less-than is used (no locale-aware string comparison), because Node and
 * the browser can disagree on locale tables and D-05 / FA-01-03-2 demand
 * identical ordering on both ends.
 *
 * ## Why this is exported (05-03, D-01)
 *
 * This body used to live inline in `analyzeExport`. It now has a second
 * caller: `resultFromMeta` in `ingest.worker.ts`, which re-derives a
 * user's STORED category statuses on every replay (a Phase-4 cache says
 * `Financial_data: unknown`, and the repair moves that entry from the
 * unknown group into the supported one).
 *
 * One comparator for both is the point. A replay that sorted by anything
 * else would produce a list ordered differently from the import that wrote
 * it, and the user would see the same export's categories reorder itself
 * across a page reload — with nothing wrong enough to report.
 *
 * Returns a NEW array (the input is not mutated), so a caller can keep the
 * original ordering — `analyzeExport` builds `statusCounts` from the
 * entries before sorting, and mutating in place would make the two depend
 * on evaluation order.
 */
export function sortCategoryEntries(entries: readonly CategoryEntry[]): CategoryEntry[] {
  return [...entries].sort((a, b) => {
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
}

/**
 * Internal: counts → category entries plus the three status counts.
 *
 * ONE implementation for both callers (the N-root merge and the v1.0 chain),
 * because two of them would be a second answer to the same question that could
 * drift the moment a field is added.
 *
 * The caller guarantees a recognised category exists (both resolvers refuse
 * to return without one), so no entry is filtered here — an unknown folder
 * alongside a recognised one always stays in the list (RESEARCH Pitfall 1).
 */
function countsToEntries(counts: ReadonlyMap<string, number>): CategoryEntry[] {
  const entries: CategoryEntry[] = [];
  for (const [name, fileCount] of counts) {
    entries.push({ name, status: classifyFolder(name), fileCount });
  }
  return entries;
}

/** Internal: the `{ supported, known-deferred, unknown }` tally of an entry list. */
function statusCountsOf(entries: readonly CategoryEntry[]): Record<CategoryStatus, number> {
  const statusCounts: Record<CategoryStatus, number> = {
    supported: 0,
    'known-deferred': 0,
    unknown: 0,
  };
  for (const entry of entries) statusCounts[entry.status] += 1;
  return statusCounts;
}

/** Internal: one pre-parse `AccountSummary` per root (the classifier reads no cell). */
function preParseAccounts(roots: readonly AccountRootAnalysis[]): AccountSummary[] {
  return roots.map((r) => ({
    root: r.root,
    identity: null,
    games: [] as string[],
    firstYear: null,
    lastYear: null,
  }));
}

/**
 * Build a ClassifyResult from a list of raw entry paths. Returns a
 * `not-ok` outcome with a named reason when the archive is not
 * recognizable enough to be called a Wargaming export:
 *
 *   empty-archive          — the prepared list is empty (after OS-metadata
 *                            filtering); the archive has no payload rows
 *                            that we can act on.
 *   no-single-root         — no account root resolved, and the legacy chain
 *                            named it (a lone top-level file, a stray folder
 *                            beside roots (D-02), …).
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
 *   ambiguous-root         — a rootless reading was possible, but an unknown
 *                            top-level folder holds a recognized category
 *                            beneath it (CR-01 / W-1, 01-11), so the
 *                            importer will not guess which folder is the
 *                            account; OR, with roots present, a recognized
 *                            category sits at the candidate level (D-04) or
 *                            two root names collide case-insensitively.
 *                            Fail closed: nothing is parsed.
 *   no-csv-data            — a recognized category holds no CSV at all.
 *   too-many-roots         — more than MAX_ACCOUNT_ROOTS account folders (D-20).
 *   root-name-too-long     — an account folder name is longer than
 *                            MAX_ROOT_NAME_LENGTH (D-20).
 *
 * Unknown folders alongside at least one recognized folder ALWAYS
 * stay in the result as `unknown` entries (RESEARCH Pitfall 1).
 *
 * Since 01-06 (G-01-20) analyzeExport is depth-tolerant: a wrapper
 * folder around a real export or a rootless re-zip with category
 * folders at the top level now classifies correctly, while every
 * pre-existing failure fixture keeps its exact reason. See
 * resolveAccountRootAndCategories() for the bounded retry + top-level
 * fallback that powers this, and for its three outcomes (resolved,
 * ambiguous, no shape matched). `ambiguous` is mapped straight to
 * `ambiguous-root`; `null` falls through to the legacy naming chain, which
 * keeps every pre-existing failure fixture's exact reason.
 *
 * Since Phase 9 the N-root resolver runs FIRST, and only hands the archive
 * back to that unchanged chain when NO account root exists — which is why
 * every v1.0 reason still fires for its v1.0 shape. On success the outcome
 * also carries `roots` (one entry per account, code-unit order) and
 * `result.accounts` (the same list, pre-parse).
 *
 * Ordering is owned by `sortCategoryEntries` below — status group, then
 * lower-case code-unit order, then raw name — which the replay path in
 * `ingest.worker.ts` shares.
 */
export function analyzeExport(paths: string[]): AnalyzeOutcome {
  const prepared = prepare(paths);
  if (prepared.length === 0) return { ok: false, reason: 'empty-archive' };

  const multi = resolveAccountRoots(prepared);
  if (multi !== null) {
    if (multi.kind === 'too-many') return { ok: false, reason: 'too-many-roots' };
    if (multi.kind === 'name-too-long') return { ok: false, reason: 'root-name-too-long' };
    if (multi.kind === 'ambiguous') return { ok: false, reason: 'ambiguous-root' };
    if (multi.kind === 'stray') return { ok: false, reason: 'no-single-root' };

    // A recognized folder name is not an export: Phase 2 parses CSVs only, so
    // an archive with none would "import" successfully and show nothing
    // (windows #3). Fail closed with a named reason instead.
    const prefixes = new Set(multi.roots.map((r) => r.root));
    if (!hasCsvUnderAnyRoot(prepared, prefixes)) {
      return { ok: false, reason: 'no-csv-data' };
    }

    // Merged categories: one entry per EXACT folder name, counts summed
    // across roots. Case variants stay separate entries, exactly as v1.0
    // treats `Clans` and `clans` inside one root.
    const mergedCounts = new Map<string, number>();
    for (const root of multi.roots) {
      for (const entry of root.categories) {
        mergedCounts.set(entry.name, (mergedCounts.get(entry.name) ?? 0) + entry.fileCount);
      }
    }
    const merged = sortCategoryEntries(countsToEntries(mergedCounts));
    const roots = multi.roots;
    return {
      ok: true,
      roots,
      result: {
        accountRoot: roots[0]?.root ?? '',
        categories: merged,
        counts: statusCountsOf(merged),
        accounts: preParseAccounts(roots),
      },
    };
  }

  const resolved = resolveAccountRootAndCategories(prepared);
  // 01-11: an ambiguous root is named directly, before the legacy chain
  // below, so the reason is truthful for every shape that can raise it
  // (the transparent-wrapper case would otherwise be mislabelled).
  if (resolved !== null && resolved.kind === 'ambiguous') {
    return { ok: false, reason: 'ambiguous-root' };
  }
  if (resolved !== null) {
    // A recognized folder name is not an export: Phase 2 parses CSVs only, so
    // an archive with none would "import" successfully and show nothing
    // (windows #3). Fail closed with a named reason instead.
    if (!prepared.some((p) => p.toLowerCase().endsWith('.csv'))) {
      return { ok: false, reason: 'no-csv-data' };
    }
    const { root, counts } = resolved;
    const entries = countsToEntries(counts);

    return {
      ok: true,
      roots: [{ root, categories: sortCategoryEntries(entries) }],
      result: {
        accountRoot: root,
        categories: sortCategoryEntries(entries),
        counts: statusCountsOf(entries),
        accounts: preParseAccounts([{ root, categories: entries }]),
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

// -----------------------------------------------------------------------------
// resolveCsvFileOwner — per-entry name → { root, category, sourceFile } (09-01)
// -----------------------------------------------------------------------------
//
// Why this exists (Phase 9, D-06):
//   `resolveCsvFileCategory` maps an entry name to its category for ONE root,
//   which is what the `unzipSync` filter uses to decide which entries to
//   inflate. An export can now hold SEVERAL roots, so the filter has to learn
//   WHICH root a file belongs to — and the per-category row counts written to
//   the cache are computed from exactly these resolutions. If the two ever
//   disagreed, the inflate filter would store rows the counts never claimed, or
//   (far worse) attribute one account's `User_Info` to another account.
//
// Rules, in order:
//   1. Normalize the raw name and reject OS-metadata and directory entries,
//      exactly as the one-root function does — the two must never disagree
//      about what a name is at all.
//   2. An EMPTY root set resolves nothing: there is no owner to attribute to.
//   3. A root set of EXACTLY ONE delegates to `resolveCsvFileCategory` and
//      attaches the root. Delegating rather than reimplementing is what keeps
//      the single-root behaviour — including its bounded rightmost-root wrapper
//      fallback — byte-identical to v1.0.
//   4. TWO OR MORE roots use a STRICT rule: the owner is the first path
//      segment, or the second segment when the first is Wargaming's
//      transparent wrapper (D-03). The one-root rightmost-`/root/`
//      fallback is deliberately OFF here: `A/Activity_history/B/…/x.csv`
//      would otherwise attribute a folder merely NAMED like another root to
//      that root, filing one account's rows under another account.
//
// Returns `null` on every rejection path, the same shape as the one-root form.
export function resolveCsvFileOwner(
  rawName: string,
  roots: ReadonlySet<string>,
  recognizedCategories: ReadonlySet<string>,
): { root: string; category: string; sourceFile: string } | null {
  const normalized = normalizeEntryPath(rawName);
  if (isOsMetadataEntry(normalized)) return null;
  if (normalized.endsWith('/')) return null; // directory entry, not a CSV file
  if (roots.size === 0) return null;

  if (roots.size === 1) {
    const [root] = [...roots];
    if (root === undefined) return null;
    const one = resolveCsvFileCategory(normalized, root, recognizedCategories);
    return one === null ? null : { root, category: one.category, sourceFile: one.sourceFile };
  }

  const slash = normalized.indexOf('/');
  if (slash === -1) return null; // a loose top-level file is never inflated
  const first = normalized.slice(0, slash);
  let root: string | undefined;
  let rest: string;
  if (roots.has(first)) {
    root = first;
    rest = normalized.slice(slash + 1);
  } else if (isTransparentWrapper(first)) {
    const remainder = normalized.slice(slash + 1);
    const slash2 = remainder.indexOf('/');
    if (slash2 === -1) return null; // a loose file under the wrapper (D-05)
    const second = remainder.slice(0, slash2);
    if (!roots.has(second)) return null;
    root = second;
    rest = remainder.slice(slash2 + 1);
  } else {
    return null;
  }

  const inner = rest.indexOf('/');
  if (inner === -1) return null; // a file directly under the root
  const category = rest.slice(0, inner);
  if (!category) return null;
  if (!recognizedCategories.has(category)) return null;
  const sourceFile = rest.slice(inner + 1);
  if (!sourceFile.toLowerCase().endsWith('.csv')) return null;
  // `root` is narrowed by the branch chain above — every arm that leaves it
  // unset returns first — so the value carries its own type here. This module's
  // header rule is that a narrowing problem is an error and never a cast, and
  // the cast that used to stand on this line read as an exception to that rule
  // without being one (09-09, WR-03).
  return { root, category, sourceFile };
}
