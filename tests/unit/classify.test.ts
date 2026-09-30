import { describe, expect, test } from 'vitest';
import {
  EXTRA_UNKNOWN_FOLDER,
  RENAMED_ACCOUNT_ROOT,
  RENAMED_EXPECTED_COUNTS,
  SAMPLE_BADGE_ORDER,
  SAMPLE_EXPECTED_COUNTS,
  SAMPLE_FILE_COUNTS,
  WRAPPER_FOLDER_NAME,
  buildBackslashExport,
  buildDirectoryEntriesExport,
  buildEmptyZip,
  buildFilesOnlyUnderRootZip,
  buildMacRezippedExport,
  buildMultiRootZip,
  buildNoRecognizedCategoryZip,
  buildRenamedRootExport,
  buildRootlessExport,
  buildSampleExport,
  buildSingleFileZip,
  buildWrapperExport,
} from '../fixtures/export-fixtures.ts';
import {
  analyzeExport,
  categoryFoldersUnder,
  classifyExport,
  detectRoot,
  isOsMetadataEntry,
  normalizeEntryPath,
  resolveCsvFileCategory,
} from '../../src/lib/worker/classify.ts';
import { listEntryPaths } from '../../src/lib/worker/zip-paths.ts';

// =============================================================================
// analyzeExport / classifyExport / detectRoot / categoryFoldersUnder — pure tests
// =============================================================================
//
// Why this file exists (01-03-PLAN Task 2, RED then GREEN):
//   The classifier is the pure core of the worker. It is fed every entry
//   path the lister produces (with no normalization), and it must decide:
//     1. Is there a real account root folder? (auto-detect, no fixed name)
//     2. Which second-level folders under that root have files? (counts)
//     3. Of those, which are supported / known-deferred / unknown?
//     4. Is the archive not recognizable enough to even start?
//
//   Pure-function tests cover every edge the worker-level tests
//   could miss: directory entries (`Bonus_codes/ 0 files`), case-only
//   name clashes (`USER_INFO` vs `user_info`, `Clans` vs `clans`),
//   backslash separators (Windows scanners), macOS noise, renamed
//   roots, and every failure reason (`empty-archive`, `no-single-root`,
//   `no-category-folders`, `no-recognized-category`).
// =============================================================================

// -----------------------------------------------------------------------------
// Path normalization
// -----------------------------------------------------------------------------

describe('normalizeEntryPath', () => {
  test('replaces backslashes with forward slashes', () => {
    expect(normalizeEntryPath('a\\b\\c')).toBe('a/b/c');
  });

  test('strips a leading "/"', () => {
    expect(normalizeEntryPath('/a/b')).toBe('a/b');
  });

  test('strips a leading "./"', () => {
    expect(normalizeEntryPath('./a/b')).toBe('a/b');
  });

  test('preserves a trailing "/" (directory marker)', () => {
    expect(normalizeEntryPath('a/b/')).toBe('a/b/');
  });
});

describe('isOsMetadataEntry', () => {
  test('matches the __MACOSX sidecar root', () => {
    expect(isOsMetadataEntry('__MACOSX/123/Activity_history/._Sessions.csv')).toBe(true);
  });

  test('matches .DS_Store (case-insensitive)', () => {
    expect(isOsMetadataEntry('a/.DS_Store')).toBe(true);
    expect(isOsMetadataEntry('a/b/.ds_store')).toBe(true);
  });

  test('matches Thumbs.db (case-insensitive)', () => {
    expect(isOsMetadataEntry('a/Thumbs.db')).toBe(true);
  });

  test('matches desktop.ini (case-insensitive)', () => {
    expect(isOsMetadataEntry('a/b/desktop.ini')).toBe(true);
  });

  test('does NOT match a real CSV inside a Wargaming folder', () => {
    expect(isOsMetadataEntry('123/User_Info/Account_Info.csv')).toBe(false);
  });
});

// -----------------------------------------------------------------------------
// detectRoot — single distinct first segment, only if it prefixes something
// -----------------------------------------------------------------------------

describe('detectRoot', () => {
  test('returns null for the empty list', () => {
    expect(detectRoot([])).toBeNull();
  });

  test('returns the single segment when one path is wholly inside it', () => {
    expect(detectRoot(['a/b/c'])).toBe('a');
  });

  test('returns null for a lone top-level file (not a folder root)', () => {
    expect(detectRoot(['a.txt'])).toBeNull();
  });

  test('returns the segment when a directory entry also lives beneath it', () => {
    expect(detectRoot(['a/', 'a/b/x'])).toBe('a');
  });
});

// -----------------------------------------------------------------------------
// categorize via listEntryPaths + analyzeExport — the worker path
// -----------------------------------------------------------------------------

function pathsOf(bytes: Uint8Array): string[] {
  return listEntryPaths(bytes);
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  if (typeof a === 'object' && typeof b === 'object') {
    const ka = Object.keys(a as object).sort();
    const kb = Object.keys(b as object).sort();
    if (ka.length !== kb.length) return false;
    for (let i = 0; i < ka.length; i++) {
      if (ka[i] !== kb[i]) return false;
      if (
        !deepEqual((a as Record<string, unknown>)[ka[i]!], (b as Record<string, unknown>)[kb[i]!])
      )
        return false;
    }
    return true;
  }
  return false;
}

describe('analyzeExport — happy paths via listEntryPaths', () => {
  test('buildSampleExport: ok with accountRoot 123456789 and SAMPLE_EXPECTED_COUNTS', () => {
    const outcome = analyzeExport(pathsOf(buildSampleExport()));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.result.accountRoot).toBe('123456789');
    expect(outcome.result.counts).toEqual(SAMPLE_EXPECTED_COUNTS);
  });

  test('buildSampleExport: category order is exactly SAMPLE_BADGE_ORDER and counts match SAMPLE_FILE_COUNTS', () => {
    const outcome = analyzeExport(pathsOf(buildSampleExport()));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.result.categories.map((c) => c.name)).toEqual([...SAMPLE_BADGE_ORDER]);
    for (const entry of outcome.result.categories) {
      expect(entry.fileCount).toBe(SAMPLE_FILE_COUNTS[entry.name]);
      expect(SAMPLE_FILE_COUNTS[entry.name]).toBeDefined();
    }
  });

  test('buildRenamedRootExport: ok with accountRoot RENAMED_ACCOUNT_ROOT and RENAMED_EXPECTED_COUNTS; last entry is { name: EXTRA_UNKNOWN_FOLDER, status: "unknown", fileCount: 2 }', () => {
    const outcome = analyzeExport(pathsOf(buildRenamedRootExport()));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.result.accountRoot).toBe(RENAMED_ACCOUNT_ROOT);
    expect(outcome.result.counts).toEqual(RENAMED_EXPECTED_COUNTS);
    const last = outcome.result.categories.at(-1);
    expect(last).toEqual({
      name: EXTRA_UNKNOWN_FOLDER,
      status: 'unknown',
      fileCount: 2,
    });
  });

  test('buildMacRezippedExport: deep-equal to the sample (OS metadata filtered, all 12 sample rows preserved)', () => {
    const macOutcome = analyzeExport(pathsOf(buildMacRezippedExport()));
    const sampleOutcome = analyzeExport(pathsOf(buildSampleExport()));
    expect(macOutcome.ok).toBe(true);
    expect(sampleOutcome.ok).toBe(true);
    if (!macOutcome.ok || !sampleOutcome.ok) return;
    expect(deepEqual(macOutcome.result, sampleOutcome.result)).toBe(true);
  });

  test('buildBackslashExport: deep-equal to the sample (separator normalized)', () => {
    const backOutcome = analyzeExport(pathsOf(buildBackslashExport()));
    const sampleOutcome = analyzeExport(pathsOf(buildSampleExport()));
    expect(backOutcome.ok).toBe(true);
    expect(sampleOutcome.ok).toBe(true);
    if (!backOutcome.ok || !sampleOutcome.ok) return;
    expect(deepEqual(backOutcome.result, sampleOutcome.result)).toBe(true);
  });

  test('directory entries register with fileCount 0 and do not shift other counts', () => {
    const sampleOutcome = analyzeExport(pathsOf(buildSampleExport()));
    const dirOutcome = analyzeExport(pathsOf(buildDirectoryEntriesExport()));
    expect(sampleOutcome.ok).toBe(true);
    expect(dirOutcome.ok).toBe(true);
    if (!sampleOutcome.ok || !dirOutcome.ok) return;

    const dirByName = new Map(dirOutcome.result.categories.map((c) => [c.name, c]));
    expect(dirByName.get('Bonus_codes')).toEqual({
      name: 'Bonus_codes',
      status: 'unknown',
      fileCount: 0,
    });
    expect(dirByName.get('Clans')?.fileCount).toBe(1);
    // Every other category's count is unchanged.
    for (const e of sampleOutcome.result.categories) {
      expect(dirByName.get(e.name)?.fileCount).toBe(e.fileCount);
    }
  });
});

// -----------------------------------------------------------------------------
// Pure-path edge cases (no fflate bytes — direct string lists)
// -----------------------------------------------------------------------------

describe('analyzeExport — pure-path edge cases', () => {
  test('["123/USER_INFO/a.csv"] gives one supported entry named "USER_INFO"', () => {
    const outcome = analyzeExport(['123/USER_INFO/a.csv']);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.result.accountRoot).toBe('123');
    expect(outcome.result.categories).toEqual([
      { name: 'USER_INFO', status: 'supported', fileCount: 1 },
    ]);
  });

  test('["r/clans/a.csv","r/Clans/b.csv"] gives two known-deferred entries ordered "Clans" then "clans" (raw-code-unit tie-break, locale-independent)', () => {
    const outcome = analyzeExport(['r/clans/a.csv', 'r/Clans/b.csv']);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.result.categories.map((c) => c.name)).toEqual(['Clans', 'clans']);
    for (const c of outcome.result.categories) {
      expect(c.status).toBe('known-deferred');
      expect(c.fileCount).toBe(1);
    }
  });
});

// -----------------------------------------------------------------------------
// Failure reasons — every one must produce a named, name-free outcome
// -----------------------------------------------------------------------------

describe('analyzeExport — failure reasons', () => {
  test('buildEmptyZip → empty-archive', () => {
    const outcome = analyzeExport(pathsOf(buildEmptyZip()));
    expect(outcome).toEqual({ ok: false, reason: 'empty-archive' });
  });

  test('metadata-only archive → empty-archive (entries are dropped before root detection)', () => {
    const outcome = analyzeExport(['__MACOSX/x/._a', '.DS_Store']);
    expect(outcome).toEqual({ ok: false, reason: 'empty-archive' });
  });

  test('buildMultiRootZip → no-single-root', () => {
    const outcome = analyzeExport(pathsOf(buildMultiRootZip()));
    expect(outcome).toEqual({ ok: false, reason: 'no-single-root' });
  });

  test('buildSingleFileZip → no-single-root (a lone top-level file is not a root)', () => {
    const outcome = analyzeExport(pathsOf(buildSingleFileZip()));
    expect(outcome).toEqual({ ok: false, reason: 'no-single-root' });
  });

  test('buildFilesOnlyUnderRootZip → no-category-folders', () => {
    const outcome = analyzeExport(pathsOf(buildFilesOnlyUnderRootZip()));
    expect(outcome).toEqual({ ok: false, reason: 'no-category-folders' });
  });

  test('buildNoRecognizedCategoryZip → no-recognized-category', () => {
    const outcome = analyzeExport(pathsOf(buildNoRecognizedCategoryZip()));
    expect(outcome).toEqual({ ok: false, reason: 'no-recognized-category' });
  });
});

// -----------------------------------------------------------------------------
// classifyExport — back-compat: same as analyzeExport on ok, null otherwise
// -----------------------------------------------------------------------------

describe('classifyExport — back-compat wrapper (01-01 compatibility)', () => {
  test('returns the same ClassifyResult as analyzeExport for success cases', () => {
    const sample = classifyExport(pathsOf(buildSampleExport()));
    const outcome = analyzeExport(pathsOf(buildSampleExport()));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(sample).toEqual(outcome.result);
  });

  test('returns null for every failure case', () => {
    expect(classifyExport(pathsOf(buildEmptyZip()))).toBeNull();
    expect(classifyExport(pathsOf(buildMultiRootZip()))).toBeNull();
    expect(classifyExport(pathsOf(buildSingleFileZip()))).toBeNull();
    expect(classifyExport(pathsOf(buildFilesOnlyUnderRootZip()))).toBeNull();
    expect(classifyExport(pathsOf(buildNoRecognizedCategoryZip()))).toBeNull();
  });
});

// -----------------------------------------------------------------------------
// categoryFoldersUnder — direct, with the same prepare hardening
// -----------------------------------------------------------------------------

describe('categoryFoldersUnder — pure preparation', () => {
  test('drops metadata entries before counting', () => {
    const m = categoryFoldersUnder('123', [
      '123/User_Info/a.csv',
      '__MACOSX/123/User_Info/._a',
      '123/.DS_Store',
    ]);
    expect(m.get('User_Info')).toBe(1);
  });

  test('directory entries add 0 (the category still appears)', () => {
    const m = categoryFoldersUnder('123', ['123/Bonus_codes/']);
    expect(m.get('Bonus_codes')).toBe(0);
  });
});

// -----------------------------------------------------------------------------
// resolveCsvFileCategory — per-entry name → { category, sourceFile } (02-01)
// -----------------------------------------------------------------------------
//
// Why this block exists (02-01-PLAN Task 3, Behavior Test 5 + new classify
// cases from the action block):
//   The ingest worker must inflate ONLY the CSV entries that belong to a
//   recognized category (D-01, D-02, IMPORT-01). It uses
//   resolveCsvFileCategory to map each entry name to the category folder
//   it belongs under. The mapping must agree with analyzeExport's own
//   category resolution — otherwise the per-category row counts in
//   `db.meta.categories` would silently diverge from the row counts the
//   worker actually wrote.
//
// The five testable invariants per the plan's action block:
//   1. A normal `${root}/Activity_history/Sessions.csv` path resolves
//      to { category: 'Activity_history', sourceFile: 'Sessions.csv' }.
//   2. A rootless export (root === '') keeps the leading category
//      folder as the first segment.
//   3. An OS-metadata entry is rejected (returns null).
//   4. A non-csv file is rejected (returns null).
//   5. A file under an unrecognized category is rejected (returns null).
// -----------------------------------------------------------------------------

describe('resolveCsvFileCategory — per-entry mapping', () => {
  const RECOGNIZED = new Set<string>([
    'Activity_history',
    'User_Info',
    'Clans',
    'Bonus_codes', // also acceptable as "unknown" status but still a real folder
  ]);

  test('a normal `${root}/Activity_history/Sessions.csv` resolves to that category and source file', () => {
    expect(resolveCsvFileCategory('123/Activity_history/Sessions.csv', '123', RECOGNIZED)).toEqual({
      category: 'Activity_history',
      sourceFile: 'Sessions.csv',
    });
  });

  test('a rootless-export path (`root === ""`) keeps the leading category as the first segment', () => {
    expect(resolveCsvFileCategory('Activity_history/Sessions.csv', '', RECOGNIZED)).toEqual({
      category: 'Activity_history',
      sourceFile: 'Sessions.csv',
    });
  });

  test('an OS-metadata entry is rejected (returns null)', () => {
    expect(
      resolveCsvFileCategory('__MACOSX/123/Activity_history/._Sessions.csv', '123', RECOGNIZED),
    ).toBeNull();
    expect(resolveCsvFileCategory('123/Activity_history/.DS_Store', '123', RECOGNIZED)).toBeNull();
  });

  test('a non-csv file is rejected (returns null)', () => {
    expect(resolveCsvFileCategory('123/Activity_history/notes.txt', '123', RECOGNIZED)).toBeNull();
  });

  test('a file under an unrecognized category is rejected (returns null)', () => {
    expect(resolveCsvFileCategory('123/Mystery_folder/Sessions.csv', '123', RECOGNIZED)).toBeNull();
  });

  test('a wrapper-folder path (`${wrapper}/${root}/${category}/${file}.csv`) resolves to the inner category and source file', () => {
    // Mirrors the real 2021 Wargaming export shape
    // (e.g. `1234567_2021-10-12/1234567/Activity_history/file.csv`) —
    // analyzeExport's wrapper-retry returns root === '1234567' here,
    // and the CSVs sit one wrapper folder deeper than `${root}/`.
    expect(
      resolveCsvFileCategory(
        '1234567_2021-10-12/1234567/Activity_history/Sessions.csv',
        '1234567',
        RECOGNIZED,
      ),
    ).toEqual({ category: 'Activity_history', sourceFile: 'Sessions.csv' });
    expect(
      resolveCsvFileCategory(
        'WrapperName/1234567/User_Info/Account_Info.csv',
        '1234567',
        RECOGNIZED,
      ),
    ).toEqual({ category: 'User_Info', sourceFile: 'Account_Info.csv' });
  });

  test('a path that does not contain `${root}/` anywhere is rejected (returns null)', () => {
    expect(
      resolveCsvFileCategory('wrongroot/Activity_history/Sessions.csv', '1234567', RECOGNIZED),
    ).toBeNull();
  });
});

// -----------------------------------------------------------------------------
// Depth-tolerant detection — G-01-20 (wrapper folder + rootless re-zip)
// -----------------------------------------------------------------------------
//
// Why this file has this block (01-06-PLAN Task 1):
//   A real export wrapped in an extra top-level folder, or re-zipped with
//   its category folders directly at the top level (no account-ID folder),
//   must classify correctly — at least as gracefully as the already-
//   supported renamed-root case. The fix is confined to
//   src/lib/worker/classify.ts: a bounded retry past one unrecognized
//   wrapper level, plus a top-level-segment fallback for the rootless
//   shape. Every fixture here is built from the existing sample's row
//   data, just re-rooted — no fabricated values.

describe('analyzeExport — depth-tolerant detection (G-01-20)', () => {
  test('buildWrapperExport: classifies ok, accountRoot is the inner SAMPLE_ACCOUNT_ROOT, deep-equal to the sample result', () => {
    const wrapped = analyzeExport(pathsOf(buildWrapperExport()));
    const sample = analyzeExport(pathsOf(buildSampleExport()));
    expect(wrapped.ok).toBe(true);
    expect(sample.ok).toBe(true);
    if (!wrapped.ok || !sample.ok) return;
    expect(wrapped.result.accountRoot).toBe('123456789');
    // The wrapper folder name itself MUST NOT appear in accountRoot.
    expect(wrapped.result.accountRoot).not.toBe(WRAPPER_FOLDER_NAME);
    expect(wrapped.result.accountRoot).not.toContain(WRAPPER_FOLDER_NAME);
    expect(deepEqual(wrapped.result, sample.result)).toBe(true);
  });

  test('buildWrapperExport: counts are SAMPLE_EXPECTED_COUNTS and category names are SAMPLE_BADGE_ORDER', () => {
    const outcome = analyzeExport(pathsOf(buildWrapperExport()));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.result.counts).toEqual(SAMPLE_EXPECTED_COUNTS);
    expect(outcome.result.categories.map((c) => c.name)).toEqual([...SAMPLE_BADGE_ORDER]);
  });

  test('buildRootlessExport: classifies ok with accountRoot "" (no account-ID folder existed), same counts as sample', () => {
    const outcome = analyzeExport(pathsOf(buildRootlessExport()));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.result.accountRoot).toBe('');
    expect(outcome.result.counts).toEqual(SAMPLE_EXPECTED_COUNTS);
    expect(outcome.result.categories.map((c) => c.name)).toEqual([...SAMPLE_BADGE_ORDER]);
  });

  test('debug-session literal wrapper shape: ["WrapperName/1234567/Activity_history/a.csv"] classifies ok with accountRoot "1234567"', () => {
    const outcome = analyzeExport(['WrapperName/1234567/Activity_history/a.csv']);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.result.accountRoot).toBe('1234567');
    expect(outcome.result.categories).toEqual([
      { name: 'Activity_history', status: 'supported', fileCount: 1 },
    ]);
  });

  test('debug-session literal rootless shape: ["Activity_history/a.csv","Payment_history/b.csv"] classifies ok with accountRoot ""', () => {
    const outcome = analyzeExport(['Activity_history/a.csv', 'Payment_history/b.csv']);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.result.accountRoot).toBe('');
    expect(outcome.result.categories.map((c) => c.name)).toEqual([
      'Activity_history',
      'Payment_history',
    ]);
    for (const c of outcome.result.categories) {
      expect(c.status).toBe('supported');
      expect(c.fileCount).toBe(1);
    }
  });

  test('ambiguous wrapper with TWO distinct unrecognized children still fails with no-recognized-category (the fix never silently guesses)', () => {
    const outcome = analyzeExport(['w/x/Activity_history/a.csv', 'w/y/Payment_history/b.csv']);
    expect(outcome).toEqual({ ok: false, reason: 'no-recognized-category' });
  });

  test('every pre-existing failure fixture keeps its exact pre-fix reason (depth-tolerant retry is additive only)', () => {
    expect(analyzeExport(pathsOf(buildEmptyZip()))).toEqual({
      ok: false,
      reason: 'empty-archive',
    });
    expect(analyzeExport(pathsOf(buildMultiRootZip()))).toEqual({
      ok: false,
      reason: 'no-single-root',
    });
    expect(analyzeExport(pathsOf(buildSingleFileZip()))).toEqual({
      ok: false,
      reason: 'no-single-root',
    });
    expect(analyzeExport(pathsOf(buildFilesOnlyUnderRootZip()))).toEqual({
      ok: false,
      reason: 'no-category-folders',
    });
    expect(analyzeExport(pathsOf(buildNoRecognizedCategoryZip()))).toEqual({
      ok: false,
      reason: 'no-recognized-category',
    });
  });
});

// -----------------------------------------------------------------------------
// Priority inversion + empty-root guard — CR-01 / WR-06 / WR-03 (01-07)
// -----------------------------------------------------------------------------
//
// Why this block exists (01-07-PLAN Task 1, closing the advisory findings
// carried by 01-VERIFICATION.md against the depth-tolerant path 01-06 added):
//
//   CR-01 (correctness) — a wrapper folder that sits DIRECTLY above the
//     recognized categories (`personal_data_export/Activity_history/foo.csv`,
//     the account-id wrapper dropped on re-zip) is surfaced as `accountRoot`,
//     so the UI would show a folder name where an account id belongs. The
//     wrapper is transparent: the answer is `accountRoot === ''`.
//   WR-06 (correctness) — the rootless read used to run only when
//     `detectRoot()` returned null, so a wrapper retry that exhausted first
//     could pre-empt it. Rootless-first removes that reachability gap.
//   WR-03 (robustness) — `categoryFoldersUnder('', paths)` concatenated
//     `'/'` onto the empty root and matched nothing, silently returning an
//     empty Map. It must delegate to the prefix-agnostic internal read.
//
// The three priority-inversion invariants below are regression guards, not
// RED tests: they pass both before and after the fix. The wrapper-around-
// account shape MUST keep resolving to the inner account folder — the
// inversion must never guess between the two wrapper shapes.
// -----------------------------------------------------------------------------

describe('analyzeExport — priority inversion + empty-root guard (CR-01 / WR-06 / WR-03)', () => {
  test('CR-01: ["personal_data_export/Activity_history/foo.csv"] classifies ok with accountRoot "" (the wrapper folder is transparent, not an account id)', () => {
    const outcome = analyzeExport(['personal_data_export/Activity_history/foo.csv']);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.result.accountRoot).toBe('');
    expect(outcome.result.categories).toEqual([
      { name: 'Activity_history', status: 'supported', fileCount: 1 },
    ]);
    expect(outcome.result.counts).toEqual({ supported: 1, 'known-deferred': 0, unknown: 0 });
  });

  // The regression guard for the regression guard. The test above pins the
  // LABEL, but `accountRoot` is not only displayed — the ingest worker
  // feeds it straight to `resolveCsvFileCategory` as the prefix used to
  // decide which zip entries to inflate (IMPORT-01). So `''` is only a
  // valid accountRoot if the consumer can still find the categories
  // through it. This test pipes the CR-01 shape through the exact filter
  // `ingest.worker.ts` runs, and asserts files actually inflate.
  //
  // Without this, `accountRoot: ''` for the wrapper-above-categories shape
  // silently resolves the category to segment 0 — the wrapper itself —
  // rejects every entry, and the user gets a "successful" import of an
  // entirely empty dashboard instead of their data.
  test('CR-01 downstream: the wrapper-above-categories shape still inflates through resolveCsvFileCategory with accountRoot ""', () => {
    const paths = ['personal_data_export/Activity_history/foo.csv'];
    const outcome = analyzeExport(paths);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    const recognized = new Set(outcome.result.categories.map((c) => c.name));
    // This is verbatim the `unzipSync` filter in ingest.worker.ts.
    const inflated = paths.filter(
      (p) => resolveCsvFileCategory(p, outcome.result.accountRoot, recognized) !== null,
    );

    expect(inflated).toEqual(paths);
    expect(
      resolveCsvFileCategory('personal_data_export/Activity_history/foo.csv', '', recognized),
    ).toEqual({
      category: 'Activity_history',
      sourceFile: 'foo.csv',
    });
  });

  // The same consumer agreement, for a wrapper buried deeper. The
  // accountRoot stays '' (the wrapper is transparent) but the categories
  // are not at the top level, so the consumer must still reach them.
  test('CR-01 downstream: a deeper wrapper chain also inflates with accountRoot ""', () => {
    const paths = ['Downloads/personal_data_export/Activity_history/foo.csv'];
    const outcome = analyzeExport(paths);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    const recognized = new Set(outcome.result.categories.map((c) => c.name));
    expect(
      paths.filter(
        (p) => resolveCsvFileCategory(p, outcome.result.accountRoot, recognized) !== null,
      ),
    ).toEqual(paths);
  });

  test('WR-03: categoryFoldersUnder("", ["Activity_history/a.csv"]) counts the top-level category instead of returning an empty Map', () => {
    const m = categoryFoldersUnder('', ['Activity_history/a.csv']);
    expect(m.size).toBe(1);
    expect(m.get('Activity_history')).toBe(1);
  });

  test('priority-inversion invariant: the wrapper-around-account shape still resolves accountRoot "1234567"', () => {
    const outcome = analyzeExport(['WrapperName/1234567/Activity_history/a.csv']);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.result.accountRoot).toBe('1234567');
    expect(outcome.result.categories).toEqual([
      { name: 'Activity_history', status: 'supported', fileCount: 1 },
    ]);
  });

  test('priority-inversion invariant: the rootless shape still resolves accountRoot ""', () => {
    const outcome = analyzeExport(['Activity_history/a.csv', 'Payment_history/b.csv']);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.result.accountRoot).toBe('');
    expect(outcome.result.categories.map((c) => c.name)).toEqual([
      'Activity_history',
      'Payment_history',
    ]);
  });

  test('priority-inversion invariant: the ambiguous-wrapper shape still fails with no-recognized-category (rootless-first never starts classifying it)', () => {
    const outcome = analyzeExport(['w/x/Activity_history/a.csv', 'w/y/Payment_history/b.csv']);
    expect(outcome).toEqual({ ok: false, reason: 'no-recognized-category' });
  });

  test('every pre-existing failure fixture keeps its exact pre-fix reason (the priority inversion is additive only)', () => {
    expect(analyzeExport(pathsOf(buildEmptyZip()))).toEqual({
      ok: false,
      reason: 'empty-archive',
    });
    expect(analyzeExport(pathsOf(buildMultiRootZip()))).toEqual({
      ok: false,
      reason: 'no-single-root',
    });
    expect(analyzeExport(pathsOf(buildSingleFileZip()))).toEqual({
      ok: false,
      reason: 'no-single-root',
    });
    expect(analyzeExport(pathsOf(buildFilesOnlyUnderRootZip()))).toEqual({
      ok: false,
      reason: 'no-category-folders',
    });
    expect(analyzeExport(pathsOf(buildNoRecognizedCategoryZip()))).toEqual({
      ok: false,
      reason: 'no-recognized-category',
    });
  });
});
