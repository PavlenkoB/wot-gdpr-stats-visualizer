import { describe, expect, test } from 'vitest';
import {
  EXTRA_UNKNOWN_FOLDER,
  RENAMED_ACCOUNT_ROOT,
  RENAMED_EXPECTED_COUNTS,
  SAMPLE_BADGE_ORDER,
  SAMPLE_EXPECTED_COUNTS,
  SAMPLE_FILE_COUNTS,
  WRAPPER_FOLDER_NAME,
  buildAmbiguousRootExport,
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
} from '../../fixtures/export-fixtures.ts';
import {
  analyzeExport,
  categoryFoldersUnder,
  classifyExport,
  detectRoot,
  isOsMetadataEntry,
  normalizeEntryPath,
  resolveCsvFileCategory,
  resolveCsvFileOwner,
} from '../../../src/lib/worker/classify.ts';
import { listEntryPaths } from '../../../src/lib/worker/zip-paths.ts';
import { classifyFolder } from '../../../src/lib/worker/categories.ts';
import {
  MA_LONG_ROOT,
  MA_README_FILES,
  MA_ROOT_RU,
  MA_ROOTS_CODE_UNIT_ORDER,
  buildCaseCollisionRootsExport,
  buildCaseVariantUserInfoAcrossRootsExport,
  buildDuplicateNicknameExport,
  buildHostileRootNamesExport,
  buildLongRootNameExport,
  buildLongTextAccountsExport,
  buildManyRootsExport,
  buildNoActivityAccountsExport,
  buildOneAccountExport,
  buildRealShapeThreeAccountExport,
  buildStrayFolderExport,
  buildTiedYearsExport,
  buildTopLevelCategoryBesideRootsExport,
  buildTwoAccountExport,
  buildWrappedTwoAccountExport,
  buildWrappedTwoAccountWithLooseFileExport,
} from '../../fixtures/multi-account-fixtures.ts';

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

  test('buildMultiRootZip → ok with two roots (Phase 9 flips the v1.0 rejection on purpose, D-01)', () => {
    // Phase 9 flips this on purpose. v1.0 read two top-level account folders as
    // `no-single-root` and showed the generic banner; the user's own export has
    // three of them. The name is kept because this builder is the minimal
    // two-root shape every other assertion below still uses.
    const outcome = analyzeExport(pathsOf(buildMultiRootZip()));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.roots.map((r) => r.root)).toEqual(['123456789', '987654321']);
    expect(outcome.result.accounts).toHaveLength(2);
    expect(outcome.result.accountRoot).toBe('123456789');
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

  test('returns null for every failure case, and a result for the multi-root archive Phase 9 accepts', () => {
    expect(classifyExport(pathsOf(buildEmptyZip()))).toBeNull();
    expect(classifyExport(pathsOf(buildSingleFileZip()))).toBeNull();
    expect(classifyExport(pathsOf(buildFilesOnlyUnderRootZip()))).toBeNull();
    expect(classifyExport(pathsOf(buildNoRecognizedCategoryZip()))).toBeNull();
    // Phase 9, D-01: two sibling account roots are an account set, not a
    // failure, so the back-compat wrapper returns a result here for the first
    // time. The four nulls above still are the whole failure surface.
    expect(classifyExport(pathsOf(buildMultiRootZip()))).not.toBeNull();
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

describe('Device_info is a supported category (quick 261012-bog)', () => {
  test('classifyFolder is supported for every spelling of Device_info', () => {
    expect(classifyFolder('Device_info')).toBe('supported');
    expect(classifyFolder('device_info')).toBe('supported');
    expect(classifyFolder('DEVICE_INFO')).toBe('supported');
  });

  test('a lookalike folder is still unknown', () => {
    expect(classifyFolder('Device_infos')).toBe('unknown');
    expect(classifyFolder('Devices')).toBe('unknown');
  });

  test('analyzeExport puts Device_info in the supported group, second by lower-case order', () => {
    const outcome = analyzeExport([
      '123456789/Activity_history/Sessions.csv',
      '123456789/Device_info/WOT_Device_Info.csv',
      '123456789/Device_info/WOTB_Device_Info.csv',
      '123456789/Device_info/WOT_Assistant_Device_Info.csv',
      '123456789/User_Info/Account_Info.csv',
      '123456789/Bans/Bans.csv',
    ]);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const names = outcome.result.categories.map((c) => c.name);
    expect(names).toEqual(['Activity_history', 'Device_info', 'User_Info', 'Bans']);
    const device = outcome.result.categories.find((c) => c.name === 'Device_info');
    expect(device?.status).toBe('supported');
    expect(device?.fileCount).toBe(3);
  });

  test('resolveCsvFileCategory resolves a real Device_info file name to that category', () => {
    const recognized = new Set<string>(['Device_info']);
    expect(
      resolveCsvFileCategory('123/Device_info/WOT_Device_Info.csv', '123', recognized),
    ).toEqual({ category: 'Device_info', sourceFile: 'WOT_Device_Info.csv' });
  });
});

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
    // Phase 9 flips this one on purpose (D-01): a two-account archive is no
    // longer a failure, so it is asserted HERE rather than among the reasons.
    expect(analyzeExport(pathsOf(buildMultiRootZip())).ok).toBe(true);
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
    // Phase 9 flips this one on purpose (D-01): a two-account archive is no
    // longer a failure, so it is asserted HERE rather than among the reasons.
    expect(analyzeExport(pathsOf(buildMultiRootZip())).ok).toBe(true);
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

// =============================================================================
// CR-01 / W-1 (plan 01-11): an ambiguous root fails closed
// =============================================================================
//
// 01-07 put the rootless read first, so `123/User_Info/...` +
// `123/Activity_history/...` beside a recognized `Clans/` was read as
// "rootless, with `123` an unknown category" and the real account folder's
// Account_Info was parsed under category '123' (no strip, LOGIN persisted).
// The rootless read is only allowed to claim "there is no account folder"
// when no unknown top-level folder holds a recognized category beneath it.
//
// The ambiguity read is applied ONLY where the resolved root would be ''.
// A real account root is never examined (the residual below), because under
// a real root an unknown folder holding a category-named subfolder is
// ordinary nested data; plan 01-13's header-based strip protects that shape.
// =============================================================================

describe('analyzeExport — ambiguous root fails closed (CR-01 / W-1, plan 01-11)', () => {
  test('the review repro fails with ambiguous-root, never ok with accountRoot ""', () => {
    expect(
      analyzeExport([
        '123/User_Info/Account_Info.csv',
        '123/Activity_history/a.csv',
        'Clans/b.csv',
      ]),
    ).toEqual({ ok: false, reason: 'ambiguous-root' });
  });

  test('the repro fixture bytes classify exactly like the literal paths (the worker test ingests these bytes)', () => {
    expect(analyzeExport(pathsOf(buildAmbiguousRootExport()))).toEqual({
      ok: false,
      reason: 'ambiguous-root',
    });
  });

  test('transparent-wrapper strategy: an unknown folder beside the categories holding User_Info is ambiguous', () => {
    expect(
      analyzeExport([
        'personal_data_export/Activity_history/a.csv',
        'personal_data_export/123/User_Info/x.csv',
      ]),
    ).toEqual({ ok: false, reason: 'ambiguous-root' });
  });

  test('a recognized folder two levels beneath an unknown top-level folder is ambiguous', () => {
    expect(
      analyzeExport(['Activity_history/a.csv', 'Wrapper/123/User_Info/Account_Info.csv']),
    ).toEqual({ ok: false, reason: 'ambiguous-root' });
  });

  test('boundary: a recognized folder at directory depth 4 beneath the unknown folder is examined', () => {
    // The Activity_history sibling is what routes the archive to the rootless
    // read; without it the single-child descent resolves it to accountRoot
    // 'c' for the wrong reason.
    expect(analyzeExport(['Activity_history/a.csv', 'T/a/b/c/Clans/x.csv'])).toEqual({
      ok: false,
      reason: 'ambiguous-root',
    });
  });

  test('boundary: a recognized folder at directory depth 5 is not examined and the archive classifies ok', () => {
    const outcome = analyzeExport(['Activity_history/a.csv', 'T/a/b/c/d/Clans/x.csv']);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.result.accountRoot).toBe('');
    expect(outcome.result.categories).toEqual([
      { name: 'Activity_history', status: 'supported', fileCount: 1 },
      { name: 'T', status: 'unknown', fileCount: 1 },
    ]);
  });

  test('a directory entry alone is enough to make the unknown folder a root candidate', () => {
    expect(analyzeExport(['Activity_history/a.csv', 'Wrapper/123/User_Info/'])).toEqual({
      ok: false,
      reason: 'ambiguous-root',
    });
  });

  test('classification is case-insensitive: a lower-case user_info beneath the unknown folder is ambiguous', () => {
    expect(
      analyzeExport(['Activity_history/a.csv', 'Wrapper/123/user_info/Account_Info.csv']),
    ).toEqual({ ok: false, reason: 'ambiguous-root' });
  });

  test('RESEARCH Pitfall 1 preserved: an unknown folder with NO recognized category beneath it stays an unknown entry', () => {
    const outcome = analyzeExport(['Activity_history/a.csv', 'Misc/x.csv']);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.result.accountRoot).toBe('');
    expect(outcome.result.categories).toEqual([
      { name: 'Activity_history', status: 'supported', fileCount: 1 },
      { name: 'Misc', status: 'unknown', fileCount: 1 },
    ]);
  });

  test('residual (T-01-45): a REAL account root is never examined, so an unknown folder holding User_Info beneath it is accepted', () => {
    // Deliberately NOT rejected here. The privacy guarantee for this shape
    // is carried by plan 01-13 (strip keyed on the header name); this pin
    // makes the residual visible so it is not mistaken for a gap.
    const outcome = analyzeExport([
      '123/Activity_history/a.csv',
      '123/Weird/User_Info/Account_Info.csv',
    ]);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.result.accountRoot).toBe('123');
    expect(outcome.result.categories).toEqual([
      { name: 'Activity_history', status: 'supported', fileCount: 1 },
      { name: 'Weird', status: 'unknown', fileCount: 1 },
    ]);
  });

  test('invariant: the wrapper-around-account shape still resolves accountRoot "1234567"', () => {
    const outcome = analyzeExport(['WrapperName/1234567/Activity_history/a.csv']);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.result.accountRoot).toBe('1234567');
  });

  test('invariant: the rootless shape and the transparent wrapper still resolve accountRoot ""', () => {
    const rootless = analyzeExport(['Activity_history/a.csv', 'Payment_history/b.csv']);
    expect(rootless.ok).toBe(true);
    if (rootless.ok) expect(rootless.result.accountRoot).toBe('');

    const wrapped = analyzeExport(['personal_data_export/Activity_history/foo.csv']);
    expect(wrapped.ok).toBe(true);
    if (wrapped.ok) expect(wrapped.result.accountRoot).toBe('');
  });

  test('invariant: the ambiguous-wrapper shape keeps no-recognized-category (not the new reason)', () => {
    expect(analyzeExport(['w/x/Activity_history/a.csv', 'w/y/Payment_history/b.csv'])).toEqual({
      ok: false,
      reason: 'no-recognized-category',
    });
  });

  test('invariant: the sample, wrapper and rootless fixtures and every failure fixture keep their exact outcome', () => {
    for (const bytes of [buildSampleExport(), buildWrapperExport(), buildRootlessExport()]) {
      expect(analyzeExport(pathsOf(bytes)).ok).toBe(true);
    }
    expect(analyzeExport(pathsOf(buildEmptyZip()))).toEqual({
      ok: false,
      reason: 'empty-archive',
    });
    // Phase 9 flips this one on purpose (D-01): a two-account archive is no
    // longer a failure, so it is asserted HERE rather than among the reasons.
    expect(analyzeExport(pathsOf(buildMultiRootZip())).ok).toBe(true);
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

describe('analyzeExport — a recognized folder with no CSV data is rejected (windows #3)', () => {
  test('a rootless zip whose recognized folder holds only a non-CSV file fails with no-csv-data', () => {
    expect(analyzeExport(['Payment_history/invoice.pdf'])).toEqual({
      ok: false,
      reason: 'no-csv-data',
    });
  });

  test('the same shape under an account root also fails', () => {
    expect(analyzeExport(['123/Payment_history/invoice.pdf', '123/Activity_history/'])).toEqual({
      ok: false,
      reason: 'no-csv-data',
    });
  });

  test('the extension match is case-insensitive and one CSV anywhere is enough', () => {
    expect(analyzeExport(['Payment_history/INVOICE.CSV']).ok).toBe(true);
    expect(analyzeExport(['123/Activity_history/a.csv', '123/Payment_history/x.pdf']).ok).toBe(
      true,
    );
  });

  test('a real-shape export is unaffected', () => {
    expect(analyzeExport(pathsOf(buildSampleExport())).ok).toBe(true);
  });
});

// =============================================================================
// Phase 9 tracer: several account roots
// =============================================================================
//
// Why this block exists (09-01-PLAN Task 1):
//   v1.0 rejected the user's own three-account export as `no-single-root`,
//   because `detectRoot` accepts exactly one distinct first segment. Phase 9
//   replaces that with an N-root resolver (D-01..D-05) plus a per-file owner
//   (D-06). The rule is the fail-closed gate that keeps a `User_Info` folder
//   under a parent the classifier did not recognise as an account root from
//   skipping the LOGIN / BIRTH_DATE strip, so it is the most expensive thing
//   in the phase to get wrong and to change later.
//
//   These five tests drive the REAL shape end to end, from zip bytes to a
//   per-file owner: three account folders at the top level with no wrapper,
//   beside two loose Readme PDFs (D-05), each with directory entries and
//   repeating the same file names as the real archive does.
//
//   The cost bounds (`MAX_ACCOUNT_ROOTS`, `MAX_ROOT_NAME_LENGTH`) and every
//   reject rule live in the "Phase 9 accept matrix" / "Phase 9 reject matrix"
//   describes below, in 09-01 Task 2.
// =============================================================================

describe('Phase 9 tracer: several account roots', () => {
  /** The real-shape archive's entry names, once, for every test here. */
  function realShapeEntries(reversed = false): string[] {
    return listEntryPaths(buildRealShapeThreeAccountExport({ reversed }));
  }

  test('the real-shape three-account zip classifies ok into three attributed accounts', () => {
    const outcome = analyzeExport(realShapeEntries());
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    expect(outcome.roots.map((r) => r.root)).toEqual([...MA_ROOTS_CODE_UNIT_ORDER]);
    expect(outcome.result.accounts?.map((a) => a.root)).toEqual([...MA_ROOTS_CODE_UNIT_ORDER]);
    // Pre-parse: the classifier never reads a cell, so identity and years are
    // empty and only the folder names are known. D-16 ordering is applied by
    // the worker (plan 09-02), because years exist only after parsing.
    for (const account of outcome.result.accounts ?? []) {
      expect(account.identity).toBeNull();
      expect(account.games).toEqual([]);
      expect(account.firstYear).toBeNull();
      expect(account.lastYear).toBeNull();
    }
    // The legacy single-account field stays the FIRST root in code-unit order.
    expect(outcome.result.accountRoot).toBe(MA_ROOTS_CODE_UNIT_ORDER[0]);
  });

  test('merged categories hold each folder name once, with the roots counts summed', () => {
    const outcome = analyzeExport(realShapeEntries());
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    const names = outcome.result.categories.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);

    for (const category of outcome.result.categories) {
      const sum = outcome.roots
        .map((r) => r.categories.find((c) => c.name === category.name)?.fileCount ?? 0)
        .reduce((a, b) => a + b, 0);
      expect(category.fileCount, `merged count for ${category.name}`).toBe(sum);
      expect(category.fileCount, `${category.name} counts no loose file`).toBeGreaterThan(0);
    }

    // The two loose PDFs and every directory entry contribute no file: the
    // file counts above are exactly the roots' own category counts.
    const resolvedCsvs = realShapeEntries().filter((p) => p.toLowerCase().endsWith('.csv'));
    const totalFiles = outcome.result.categories.reduce((a, c) => a + c.fileCount, 0);
    expect(totalFiles).toBe(resolvedCsvs.length);
  });

  test('every CSV entry resolves to its own root, category and source file', () => {
    const entries = realShapeEntries();
    const outcome = analyzeExport(entries);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    const recognized = new Set(outcome.result.categories.map((c) => c.name));
    const roots = new Set(MA_ROOTS_CODE_UNIT_ORDER);
    const perCategory = new Map<string, number>();

    for (const entry of entries) {
      const owner = resolveCsvFileOwner(entry, roots, recognized);
      if (!entry.toLowerCase().endsWith('.csv') || entry.endsWith('/')) {
        // Loose PDFs and directory entries are never inflated (D-05).
        expect(owner, `${entry} must not resolve`).toBeNull();
        continue;
      }
      const segments = entry.split('/');
      expect(owner, `${entry} must resolve`).not.toBeNull();
      expect(owner?.root).toBe(segments[0]);
      expect(owner?.category).toBe(segments[1]);
      expect(owner?.sourceFile).toBe(segments.slice(2).join('/'));
      perCategory.set(owner!.category, (perCategory.get(owner!.category) ?? 0) + 1);
    }

    // D-06: the inflate filter and the category counts cannot diverge.
    for (const category of outcome.result.categories) {
      expect(perCategory.get(category.name) ?? 0, `rows for ${category.name}`).toBe(
        category.fileCount,
      );
    }
  });

  test('entry order in the zip does not change the outcome', () => {
    const forward = analyzeExport(realShapeEntries(false));
    const reversed = analyzeExport(realShapeEntries(true));
    expect(forward.ok).toBe(true);
    expect(reversed.ok).toBe(true);
    if (!forward.ok || !reversed.ok) return;
    expect(deepEqual(reversed, forward)).toBe(true);
  });

  test('the one-root archive is one account and agrees with the one-root resolver', () => {
    const entries = listEntryPaths(buildOneAccountExport());
    const outcome = analyzeExport(entries);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    expect(outcome.roots).toHaveLength(1);
    expect(outcome.result.accounts).toHaveLength(1);
    const root = outcome.roots[0]!.root;
    expect(root).toBe(outcome.result.accountRoot);

    const recognized = new Set(outcome.result.categories.map((c) => c.name));
    for (const entry of entries) {
      const owner = resolveCsvFileOwner(entry, new Set([root]), recognized);
      const one = resolveCsvFileCategory(entry, root, recognized);
      expect(owner?.category).toBe(one?.category);
      expect(owner?.sourceFile).toBe(one?.sourceFile);
    }

    // The same shared file names appear in every root, so the repeat is real.
    expect(entries.filter((p) => p.endsWith('WOTB_Vehicle_Statistics.csv'))).toHaveLength(1);
  });

  test('the real-shape archive carries the loose Readme PDFs beside the roots', () => {
    const entries = realShapeEntries();
    for (const name of MA_README_FILES) expect(entries).toContain(name);
    // …and the archive still classifies, which is the whole point of D-05.
    expect(analyzeExport(entries).ok).toBe(true);
  });
});

// =============================================================================
// Phase 9 accept / reject / agreement matrices (09-01 Task 2)
// =============================================================================
//
// The Phase 9 classifier changes ONE assumption the whole pipeline shared: that
// an export has exactly one account folder. Widening acceptance is therefore
// the highest-risk edit in the phase, and every widened rule below is paired
// with the rule that must still reject, because the root rule is the fail-closed
// gate that keeps a `User_Info` folder under a parent the classifier did not
// recognise as an account root from skipping the LOGIN / BIRTH_DATE strip.
//
//   D-01  a top-level folder is an account root when it DIRECTLY holds a
//         recognised category; the name is never checked
//   D-02  a stray unknown FOLDER beside roots fails (no-single-root)
//   D-03  `personal_data_export/` stays transparent for N roots; any OTHER
//         wrapper above roots keeps failing
//   D-04  a recognised category at the top level beside roots fails
//         (ambiguous-root) — it cannot be attributed to an account
//   D-05  loose top-level FILES are ignored entirely, never read and never
//         counted toward the stray-folder rule
//   D-06  `resolveCsvFileOwner` and the per-category counts cannot diverge
//
// Three shapes keep their reason ON PURPOSE, and no test below "fixes" them:
//   - a lone top-level file, a zip of loose files, and a single root with no
//     category folders are ZERO-root shapes, so the unchanged v1.0 chain names
//     them (D-05 is applied inside the N-root resolver, never in `prepare()`);
//   - an arbitrary wrapper above several roots keeps `no-recognized-category`
//     (D-03: only Wargaming's own wrapper is transparent, and the reason is
//     never shown to the user — one generic banner either way);
//   - `personal_data_export/` sitting directly above recognised categories stays
//     `accountRoot: ''`, because that shape has no account-folder layer at all.
// =============================================================================

describe('Phase 9 accept matrix', () => {
  test('two roots at the top level classify ok, listed in code-unit order', () => {
    const outcome = analyzeExport(pathsOf(buildTwoAccountExport()));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    // EU and NA, in code-unit order: '1000000003' < '500000001'.
    expect(outcome.roots.map((r) => r.root)).toEqual(['1000000003', '500000001']);
    expect(outcome.result.accounts).toHaveLength(2);
    expect(outcome.result.accountRoot).toBe('1000000003');
  });

  test('three roots at the top level with two loose PDFs beside them classify ok (D-05)', () => {
    const outcome = analyzeExport(pathsOf(buildRealShapeThreeAccountExport()));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.roots).toHaveLength(3);
  });

  test('two roots under personal_data_export classify ok, and the wrapper is never the root (D-03)', () => {
    const outcome = analyzeExport(pathsOf(buildWrappedTwoAccountExport()));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.roots.map((r) => r.root)).toEqual(['1000000003', '500000001']);
    expect(outcome.result.accountRoot).toBe('1000000003');
    expect(outcome.result.accountRoot).not.toContain('personal_data_export');
  });

  test('a loose file under personal_data_export beside two roots is ignored (D-03 flagged assumption)', () => {
    expect(analyzeExport(pathsOf(buildWrappedTwoAccountWithLooseFileExport())).ok).toBe(true);
  });

  test('one root plus a loose Readme beside it classifies ok (D-05; v1.0 rejected it)', () => {
    const paths = [...pathsOf(buildOneAccountExport()), 'Readme_en.pdf'];
    const outcome = analyzeExport(paths);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.roots).toHaveLength(1);
    // The PDF is not filed as a category either.
    expect(outcome.result.categories.map((c) => c.name)).not.toContain('Readme_en.pdf');
  });

  test('a root with no User_Info folder still imports, identified by its id', () => {
    const outcome = analyzeExport(pathsOf(buildRealShapeThreeAccountExport()));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const ru = outcome.roots.find((r) => r.root === MA_ROOT_RU);
    expect(ru).toBeDefined();
    expect(ru?.categories.map((c) => c.name)).not.toContain('User_Info');
    expect(outcome.result.accounts?.find((a) => a.root === MA_ROOT_RU)?.identity).toBeNull();
  });

  test('two roots spelling User_Info differently both import, as two entries', () => {
    const outcome = analyzeExport(pathsOf(buildCaseVariantUserInfoAcrossRootsExport()));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const names = outcome.result.categories.map((c) => c.name);
    expect(names).toContain('User_Info');
    expect(names).toContain('user_info');
  });

  test('roots named __proto__ and constructor classify and resolve correctly (T-09-04)', () => {
    const outcome = analyzeExport(pathsOf(buildHostileRootNamesExport()));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.roots.map((r) => r.root)).toEqual(['__proto__', 'constructor']);
    const recognized = new Set(outcome.result.categories.map((c) => c.name));
    const roots = new Set(outcome.roots.map((r) => r.root));
    expect(
      resolveCsvFileOwner('constructor/User_Info/Account_Info.csv', roots, recognized)?.root,
    ).toBe('constructor');
    expect(
      resolveCsvFileOwner('__proto__/User_Info/Account_Info.csv', roots, recognized)?.root,
    ).toBe('__proto__');
  });

  test('32 roots are accepted and 33 are not (D-20 cap)', () => {
    const atCap = analyzeExport(pathsOf(buildManyRootsExport(32)));
    expect(atCap.ok).toBe(true);
    if (atCap.ok) expect(atCap.roots).toHaveLength(32);
    expect(analyzeExport(pathsOf(buildManyRootsExport(33)))).toEqual({
      ok: false,
      reason: 'too-many-roots',
    });
  });

  test('a 128-character root name is accepted and 129 is not (D-20 bound)', () => {
    expect(analyzeExport(pathsOf(buildLongRootNameExport(128))).ok).toBe(true);
    expect(analyzeExport(pathsOf(buildLongRootNameExport(129)))).toEqual({
      ok: false,
      reason: 'root-name-too-long',
    });
  });

  test('the same root-name bound holds under the transparent wrapper', () => {
    expect(analyzeExport(pathsOf(buildLongRootNameExport(128, { wrapped: true }))).ok).toBe(true);
    expect(analyzeExport(pathsOf(buildLongRootNameExport(129, { wrapped: true })))).toEqual({
      ok: false,
      reason: 'root-name-too-long',
    });
  });

  test('two roots sharing one nickname still classify (only the id tells them apart)', () => {
    const outcome = analyzeExport(pathsOf(buildDuplicateNicknameExport()));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.roots.map((r) => r.root)).toEqual(['100', '200']);
  });

  test('tied first-activity years and a no-activity account all classify', () => {
    expect(analyzeExport(pathsOf(buildTiedYearsExport())).ok).toBe(true);
    expect(analyzeExport(pathsOf(buildNoActivityAccountsExport())).ok).toBe(true);
  });

  test('a twenty-digit root carrying a forty-character nickname classifies', () => {
    const outcome = analyzeExport(pathsOf(buildLongTextAccountsExport()));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.roots.map((r) => r.root)).toEqual(['1000000002', MA_LONG_ROOT]);
  });
});

describe('Phase 9 reject matrix', () => {
  test('a stray unknown folder beside two roots fails with no-single-root (D-02)', () => {
    expect(analyzeExport(pathsOf(buildStrayFolderExport()))).toEqual({
      ok: false,
      reason: 'no-single-root',
    });
  });

  test('a stray folder nested one level deeper beside two roots also fails (D-02)', () => {
    expect(analyzeExport(pathsOf(buildStrayFolderExport({ nested: true })))).toEqual({
      ok: false,
      reason: 'no-single-root',
    });
  });

  test('a recognised category at the top level beside two roots fails with ambiguous-root (D-04)', () => {
    expect(analyzeExport(pathsOf(buildTopLevelCategoryBesideRootsExport()))).toEqual({
      ok: false,
      reason: 'ambiguous-root',
    });
  });

  test('the stray-folder shape under personal_data_export fails the same way (D-02, D-03)', () => {
    expect(
      analyzeExport([
        'personal_data_export/123/User_Info/Account_Info.csv',
        'personal_data_export/Misc/x.csv',
      ]),
    ).toEqual({ ok: false, reason: 'no-single-root' });
  });

  test('the top-level-category shape under personal_data_export fails with ambiguous-root (D-04)', () => {
    expect(
      analyzeExport([
        'personal_data_export/123/User_Info/Account_Info.csv',
        'personal_data_export/Activity_history/a.csv',
      ]),
    ).toEqual({ ok: false, reason: 'ambiguous-root' });
  });

  test('two roots whose names differ only in case fail with ambiguous-root (T-09-03)', () => {
    expect(analyzeExport(pathsOf(buildCaseCollisionRootsExport()))).toEqual({
      ok: false,
      reason: 'ambiguous-root',
    });
  });

  test('a SINGLE root whose name is 129 characters fails with root-name-too-long (D-20 narrowing)', () => {
    // The test title states the narrowing on purpose: v1.0 accepted a single
    // root with an arbitrarily long folder name. The bound holds for one root
    // too, because that name is stamped onto every stored row (D-07).
    expect(analyzeExport(pathsOf(buildLongRootNameExport(129)))).toEqual({
      ok: false,
      reason: 'root-name-too-long',
    });
  });

  test('an unknown wrapper above two roots keeps no-recognized-category (D-03 regression)', () => {
    // An arbitrary wrapper is NOT a container of account roots: its candidates
    // hold other unknown folders, never a recognised category directly.
    expect(
      analyzeExport(['2026-10-14/123/User_Info/a.csv', '2026-10-14/456/User_Info/b.csv']),
    ).toEqual({ ok: false, reason: 'no-recognized-category' });
    expect(analyzeExport(['w/x/Activity_history/a.csv', 'w/y/Payment_history/b.csv'])).toEqual({
      ok: false,
      reason: 'no-recognized-category',
    });
  });

  test('roots with no CSV beneath them fail with no-csv-data', () => {
    expect(analyzeExport(['123/User_Info/', '123/Activity_history/'])).toEqual({
      ok: false,
      reason: 'no-csv-data',
    });
  });

  test('a zip holding only loose files fails with no-single-root (zero roots, D-05)', () => {
    expect(analyzeExport(['Readme_en.pdf', 'Readme_ru.pdf'])).toEqual({
      ok: false,
      reason: 'no-single-root',
    });
  });

  test('an empty archive still fails with empty-archive', () => {
    expect(analyzeExport(pathsOf(buildEmptyZip()))).toEqual({
      ok: false,
      reason: 'empty-archive',
    });
  });

  test('every v1.0 zero-root reason is still produced for its own shape', () => {
    // Inventory rows 2 to 5, 8, 10 to 17 and 19: none of them declares an
    // account root, so the N-root resolver returns null and the unchanged v1.0
    // chain names each one exactly as before.
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
    expect(analyzeExport(['Activity_history/a.csv', 'Payment_history/b.csv']).ok).toBe(true);
    expect(analyzeExport(['personal_data_export/Activity_history/foo.csv']).ok).toBe(true);
    expect(
      analyzeExport([
        '123/User_Info/Account_Info.csv',
        '123/Activity_history/a.csv',
        'Clans/b.csv',
      ]),
    ).toEqual({ ok: false, reason: 'ambiguous-root' });
    const rootless = analyzeExport(['Activity_history/a.csv', 'Misc/x.csv']);
    expect(rootless.ok).toBe(true);
    if (rootless.ok) expect(rootless.result.accountRoot).toBe('');
  });

  test('3,000 root-shaped folders fail as too-many-roots after one linear pass (T-09-02)', () => {
    const paths = pathsOf(buildManyRootsExport(3000));
    const started = performance.now();
    expect(analyzeExport(paths)).toEqual({ ok: false, reason: 'too-many-roots' });
    // A per-candidate re-scan of every entry would be 9,000,000 path walks and
    // blow this guard; the resolver must decide from its single pass.
    expect(performance.now() - started).toBeLessThan(2000);
  });

  test('3,000 stray folders beside one root fail as a stray after one linear pass (T-09-02)', () => {
    const paths = pathsOf(buildManyRootsExport(3000, { recognised: false, withRoot: true }));
    const started = performance.now();
    expect(analyzeExport(paths)).toEqual({ ok: false, reason: 'no-single-root' });
    expect(performance.now() - started).toBeLessThan(2000);
  });
});

describe('Phase 9 agreement', () => {
  /** Every ok fixture whose entries are all CSV files. */
  const OK_ALL_CSV_FIXTURES: readonly [string, Uint8Array][] = [
    ['sample', buildSampleExport()],
    ['wrapper', buildWrapperExport()],
    ['rootless', buildRootlessExport()],
    ['one root', buildOneAccountExport()],
    ['two roots', buildTwoAccountExport()],
    ['three roots', buildRealShapeThreeAccountExport()],
    ['wrapped two roots', buildWrappedTwoAccountExport()],
  ];

  test('per-category resolutions equal the merged fileCount for every ok fixture (D-06)', () => {
    for (const [label, bytes] of OK_ALL_CSV_FIXTURES) {
      const paths = pathsOf(bytes);
      const outcome = analyzeExport(paths);
      expect(outcome.ok, `${label} must classify`).toBe(true);
      if (!outcome.ok) return;

      const recognized = new Set(outcome.result.categories.map((c) => c.name));
      const roots = new Set(outcome.roots.map((r) => r.root));
      const perCategory = new Map<string, number>();
      for (const path of paths) {
        const owner = resolveCsvFileOwner(path, roots, recognized);
        if (owner === null) continue;
        perCategory.set(owner.category, (perCategory.get(owner.category) ?? 0) + 1);
      }
      for (const category of outcome.result.categories) {
        expect(
          perCategory.get(category.name) ?? 0,
          `${label}: resolved rows for ${category.name}`,
        ).toBe(category.fileCount);
      }
    }
  });

  test('a one-root set resolves exactly what resolveCsvFileCategory resolves', () => {
    for (const [label, bytes] of OK_ALL_CSV_FIXTURES) {
      const paths = pathsOf(bytes);
      const outcome = analyzeExport(paths);
      expect(outcome.ok, `${label} must classify`).toBe(true);
      if (!outcome.ok) continue;
      const recognized = new Set(outcome.result.categories.map((c) => c.name));
      const roots = new Set(outcome.roots.map((r) => r.root));
      if (roots.size !== 1) continue;
      const [root] = [...roots];
      for (const path of paths) {
        const owner = resolveCsvFileOwner(path, roots, recognized);
        const one = resolveCsvFileCategory(path, root as string, recognized);
        expect(owner?.category, `${label}: ${path}`).toBe(one?.category);
        expect(owner?.sourceFile, `${label}: ${path}`).toBe(one?.sourceFile);
      }
    }
  });

  test('with two roots the rightmost-root fallback is off (the nested-lookalike gate)', () => {
    const recognized = new Set(['Activity_history', 'Player_statistics']);
    const twoRoots = new Set(['A', 'B']);
    // A folder named like another root, nested inside root A, belongs to A.
    expect(
      resolveCsvFileOwner('A/Activity_history/B/Player_statistics/x.csv', twoRoots, recognized),
    ).toEqual({
      root: 'A',
      category: 'Activity_history',
      sourceFile: 'B/Player_statistics/x.csv',
    });
    // With ONE root the pre-existing rightmost-root wrapper behaviour stands:
    // the last occurrence of `/B/` is the prefix that is stripped.
    expect(
      resolveCsvFileCategory('A/Activity_history/B/Player_statistics/x.csv', 'B', recognized),
    ).toEqual({
      category: 'Player_statistics',
      sourceFile: 'x.csv',
    });
  });

  test('an empty root set resolves nothing, and an OS-metadata entry never resolves', () => {
    const recognized = new Set(['User_Info']);
    expect(resolveCsvFileOwner('123/User_Info/Account_Info.csv', new Set(), recognized)).toBeNull();
    expect(
      resolveCsvFileOwner('__MACOSX/123/User_Info/._a.csv', new Set(['123']), recognized),
    ).toBeNull();
    expect(resolveCsvFileOwner('123/User_Info/', new Set(['123']), recognized)).toBeNull();
    expect(resolveCsvFileOwner('123/User_Info/notes.txt', new Set(['123']), recognized)).toBeNull();
  });
});
