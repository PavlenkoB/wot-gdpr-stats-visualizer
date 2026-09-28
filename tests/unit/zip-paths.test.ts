import { describe, expect, test } from 'vitest';
import { unzipSync } from 'fflate';
import {
  buildBackslashExport,
  buildEmptyZip,
  buildInflateTrapExport,
  buildNotAZipBytes,
  buildSampleExport,
  buildTruncatedExport,
} from '../fixtures/export-fixtures.ts';
import { listEntryPaths } from '../../src/lib/worker/zip-paths.ts';

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
  test('buildSampleExport yields 12 names, including the supported-csv names', () => {
    const names = listEntryPaths(buildSampleExport());
    expect(names).toHaveLength(12);
    expect(names).toContain('123456789/User_Info/Account_Info.csv');
    expect(names).toContain('123456789/Payment_history/Orders.csv');
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
  test('buildInflateTrapExport enumerates all 12 names, while a full unzipSync on the same bytes throws', () => {
    const bytes = buildInflateTrapExport();

    // Control: a full unzip must throw, proving the trap bytes really
    // are corrupt. If this assertion fails, buildInflateTrapExport has
    // silently become a no-op and the entire trap is invalidated.
    expect(() => unzipSync(bytes)).toThrow();

    // The lister must still report every entry by name.
    const names = listEntryPaths(bytes);
    expect(names).toHaveLength(12);
    expect(names).toContain('123456789/User_Info/Account_Info.csv');
    expect(names).toContain('123456789/Payment_history/Orders.csv');
  });
});
