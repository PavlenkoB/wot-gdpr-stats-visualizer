import { describe, expect, test } from 'vitest';
import { unzipSync } from 'fflate';
import {
  SAMPLE_FILE_COUNTS,
  buildBackslashExport,
  buildEmptyZip,
  buildInflateTrapExport,
  buildNotAZipBytes,
  buildSampleExport,
  buildTruncatedExport,
} from '../fixtures/export-fixtures.ts';
import { listEntryPaths } from '../../src/lib/worker/zip-paths.ts';

/**
 * How many entries `buildSampleExport()` must enumerate: the sum of every
 * category's file count.
 *
 * DERIVED, never typed. This file held the literal 14, then 12 before that,
 * and each time the sample grew a folder a fixed number had to be found and
 * corrected by hand (05-03 hit it once already). `SAMPLE_FILE_COUNTS` is the
 * per-category contract the badge and the e2e summaries already read, so the
 * entry count follows the same source — and the lister is still doing the
 * real work, because a category count that disagreed with the archive would
 * now fail here rather than pass quietly.
 */
const SAMPLE_ENTRY_COUNT = Object.values(SAMPLE_FILE_COUNTS).reduce((a, b) => a + b, 0);

// =============================================================================
// listEntryPaths — path-only zip enumeration
// =============================================================================
//
// Why this file exists (01-03-PLAN Task 1, RED then GREEN):
//   `src/lib/worker/zip-paths.ts` exists so the worker can enumerate a
//   zip's entries WITHOUT inflating any of them. Two empirical facts
//   lock the safety story:
//     A2 (RESEARCH): fflate throws "invalid zip data" on corrupt bytes,
//         so a malformed archive cannot slip past as a "successful"
//         empty listing.
//     01-01 T-01-04 hand-off: a zip whose deflate stream is corrupt
//         must still enumerate, while a full `unzipSync` on the same
//         bytes throws. Proves the lister never inflated the file.
//
// tests/ is OUTSIDE src/, so importing `unzipSync` from fflate here is
// permitted by 01-02's no-restricted-imports rule (which excludes
// src/lib/worker/**) and does NOT trip the worker-boundary rule.
// =============================================================================

describe('listEntryPaths — happy path', () => {
  test('buildSampleExport yields every name in the sample file-count contract, including the supported-csv names', () => {
    const names = listEntryPaths(buildSampleExport());
    // The claim is the EXACT set of names: the lister must enumerate the
    // archive WITHOUT inflating anything, so every entry has to be there.
    // The count comes from SAMPLE_FILE_COUNTS rather than a literal, so a
    // sample that gains a file fails here only if the archive and the
    // contract genuinely disagree.
    expect(names).toHaveLength(SAMPLE_ENTRY_COUNT);
    expect(names).toContain('123456789/User_Info/Account_Info.csv');
    expect(names).toContain('123456789/Payment_history/Orders.csv');
    expect(names).toContain('123456789/Financial_data/Virtual_Currencies_Operations.csv');
    // 05-06: the real per-title vehicle file name is enumerated, and none
    // of the invented `*_stats.csv` names it replaced survives.
    expect(names).toContain('123456789/Player_statistics/WOT_Vehicle_Statistics.csv');
    expect(names).toContain('123456789/Player_statistics/WOWP_20_Plane_Statistics.csv');
    expect(names.some((n) => n.endsWith('/WOT_stats.csv'))).toBe(false);
  });

  test("backslashed keys come back VERBATIM (normalization is classify's job, not the lister's)", () => {
    const names = listEntryPaths(buildBackslashExport());
    expect(names).toContain('123456789\\User_Info\\Account_Info.csv');
  });
});

describe('listEntryPaths — corrupt bytes throw (RESEARCH A2, locked)', () => {
  test('zero bytes throw an Error whose message matches /invalid zip data/', () => {
    expect(() => listEntryPaths(new Uint8Array(0))).toThrowError(/invalid zip data/);
  });

  test('plain English bytes throw an Error whose message matches /invalid zip data/', () => {
    expect(() => listEntryPaths(buildNotAZipBytes())).toThrowError(/invalid zip data/);
  });

  test('a zip truncated to 60% of its length throws an Error whose message matches /invalid zip data/', () => {
    expect(() => listEntryPaths(buildTruncatedExport())).toThrowError(/invalid zip data/);
  });
});

describe('listEntryPaths — valid empty zip does NOT throw', () => {
  test('buildEmptyZip returns [] without throwing', () => {
    expect(() => listEntryPaths(buildEmptyZip())).not.toThrow();
    expect(listEntryPaths(buildEmptyZip())).toEqual([]);
  });
});

describe('listEntryPaths — never inflates entry data (zip-bomb immunity)', () => {
  test('buildInflateTrapExport enumerates every sample name, while a full unzipSync on the same bytes throws', () => {
    const bytes = buildInflateTrapExport();

    // Control: a full unzip must throw, proving the trap bytes really
    // are corrupt. If this assertion fails, buildInflateTrapExport has
    // silently become a no-op and the entire trap is invalidated.
    expect(() => unzipSync(bytes)).toThrow();

    // The lister must still report every entry by name. The trap builder
    // appends the whole sample, so the count is the same contract.
    const names = listEntryPaths(bytes);
    expect(names).toHaveLength(SAMPLE_ENTRY_COUNT);
    expect(names).toContain('123456789/User_Info/Account_Info.csv');
    expect(names).toContain('123456789/Payment_history/Orders.csv');
  });
});
