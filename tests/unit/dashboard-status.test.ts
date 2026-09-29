import { describe, expect, test } from 'vitest';
import {
  NAV_ORDER,
  SECTIONS,
  navEntries,
  sectionCounts,
  sectionStatus,
  unsupportedBlockStatus,
  unsupportedEntries,
  unsupportedSectionStatus,
} from '../../src/lib/dashboard-status.ts';
import { NAV_STATUS_SUFFIX, SECTION_TITLES, formatSectionStatus } from '../../src/lib/ui-copy.ts';
import type {
  CategoryEntry,
  CategoryStatus,
  ClassifyResult,
} from '../../src/lib/types/worker-messages.ts';

// =============================================================================
// dashboard-status — the single status derivation (03-02-PLAN Task 1)
// =============================================================================
//
// Why this file exists:
//   The nav, the section cards and the "Not yet supported" block all
//   describe the SAME export. D-08 makes them read one function set, so
//   they cannot disagree — and DATA-04 depends on it: a folder that is
//   absent from the export must never read as "present but empty".
//
//   Everything here is pure, DOM-free and runs under Node with no jsdom
//   (the repo's Vitest setup has no DOM environment, by design). Folder
//   names are untrusted zip-entry strings: these functions compare and
//   return them, they never interpret them.
// =============================================================================

/**
 * A compact way to write one category entry. Optional counts are omitted
 * entirely (rather than passed as 0) when not given, because "absent" is a
 * real state on a pre-parse ClassifyResult and the module must treat it
 * as 0 without the test having to say so.
 */
type EntrySpec = [
  name: string,
  status: CategoryStatus,
  fileCount: number,
  rowCount?: number,
  skippedRowCount?: number,
];

/** Build a ClassifyResult from a compact entry list, with `counts` derived. */
function resultOf(entries: EntrySpec[], accountRoot = '123456789'): ClassifyResult {
  const categories: CategoryEntry[] = entries.map(
    ([name, status, fileCount, rowCount, skippedRowCount]) => ({
      name,
      status,
      fileCount,
      ...(rowCount === undefined ? {} : { rowCount }),
      ...(skippedRowCount === undefined ? {} : { skippedRowCount }),
    }),
  );
  const counts: Record<CategoryStatus, number> = { supported: 0, 'known-deferred': 0, unknown: 0 };
  for (const category of categories) counts[category.status] += 1;
  return { accountRoot, categories, counts };
}

/** The four supported folders, all populated — the "everything is fine" export. */
const FULL_SUPPORTED: EntrySpec[] = [
  ['Activity_history', 'supported', 2, 1204],
  ['Player_statistics', 'supported', 3, 8123],
  ['Payment_history', 'supported', 1, 12],
  ['User_Info', 'supported', 1, 1],
];

/** The sample shape: the four supported folders plus four others (worker order). */
const SAMPLE: EntrySpec[] = [
  ...FULL_SUPPORTED,
  ['Chat_history', 'known-deferred', 1, 40],
  ['Clans', 'known-deferred', 1, 2],
  ['Bans', 'unknown', 1, 0],
  ['Device_info', 'unknown', 2, 3],
];

// -----------------------------------------------------------------------------
// Tracer — ClassifyResult to section status to visible-text accessible name
// -----------------------------------------------------------------------------

describe('tracer: ClassifyResult to visible-text accessible name', () => {
  test('a missing Payment_history reaches the exact nav accessible name', () => {
    const result = resultOf(FULL_SUPPORTED.filter(([name]) => name !== 'Payment_history'));

    // 1. One pure status function, shared by the nav and the card (D-08).
    expect(sectionStatus('payment-history', result)).toBe('no-export');

    // 2. The card's status line (D-10).
    expect(formatSectionStatus('no-export', SECTION_TITLES['payment-history'])).toBe(
      'Not in this export',
    );

    // 3. The nav link is muted, with the reason that becomes the suffix.
    const entry = navEntries(result).find((e) => e.id === 'payment-history');
    expect(entry).toEqual({ id: 'payment-history', muted: true, reason: 'no-export' });

    // 4. Visible text + visually-hidden suffix = the accessible name (D-03).
    //    No aria-label: the link's own text IS its name.
    expect(SECTION_TITLES['payment-history'] + NAV_STATUS_SUFFIX['no-export']).toBe(
      'Payment_history, not in this export',
    );
  });
});

// -----------------------------------------------------------------------------
// Section status table
// -----------------------------------------------------------------------------

describe('sectionStatus', () => {
  test('a null result is not-loaded for all four sections and for the block', () => {
    for (const { id } of SECTIONS) {
      expect(sectionStatus(id, null)).toBe('not-loaded');
    }
    expect(unsupportedBlockStatus(null)).toBe('not-loaded');
    expect(unsupportedEntries(null)).toEqual([]);
    expect(navEntries(null)).toHaveLength(5);
  });

  test('a header-only entry (rowCount 0) is empty', () => {
    const result = resultOf([['Payment_history', 'supported', 1, 0]]);
    expect(sectionStatus('payment-history', result)).toBe('empty');
  });

  test('a directory-only entry (fileCount 0, rowCount absent) is empty', () => {
    const result = resultOf([['Payment_history', 'supported', 0]]);
    expect(sectionStatus('payment-history', result)).toBe('empty');
  });

  test('an only-skipped entry is empty and still reports the skipped count', () => {
    const result = resultOf([['Payment_history', 'supported', 1, 0, 3]]);
    expect(sectionStatus('payment-history', result)).toBe('empty');
    // The diagnostics survive the status decision: the card can still show
    // the skip tag, so a user is not told "no rows" without being told
    // "3 rows were skipped" (RESEARCH Open Question 2).
    expect(sectionCounts('Payment_history', result)).toEqual({
      fileCount: 1,
      rowCount: 0,
      skippedRowCount: 3,
    });
  });

  test('rowCount above zero is pending', () => {
    const result = resultOf([['Payment_history', 'supported', 1, 12]]);
    expect(sectionStatus('payment-history', result)).toBe('pending');
  });

  test('ready only when the section id is in the built set', () => {
    const result = resultOf([['Payment_history', 'supported', 1, 12]]);
    expect(sectionStatus('payment-history', result, new Set(['payment-history']))).toBe('ready');
    expect(sectionStatus('payment-history', result, new Set(['user-info']))).toBe('pending');
  });

  test("an entry named 'user_info' gives user-info pending, not no-export", () => {
    // classifyFolder is case-insensitive, so a section that matched on the
    // exact string alone would show "Not in this export" while rows were
    // sitting in IndexedDB (RESEARCH Pitfall 1).
    const result = resultOf([['user_info', 'supported', 1, 1]]);
    expect(sectionStatus('user-info', result)).toBe('pending');
  });

  test('User_Info (2 rows) plus user_info (3 rows) sums to 5 rows and adds both file counts', () => {
    const result = resultOf([
      ['User_Info', 'supported', 1, 2],
      ['user_info', 'supported', 4, 3],
    ]);
    expect(sectionStatus('user-info', result)).toBe('pending');
    expect(sectionCounts('User_Info', result)).toEqual({
      fileCount: 5,
      rowCount: 5,
      skippedRowCount: 0,
    });
  });

  test('a present Chat_history never affects any section', () => {
    const result = resultOf([...FULL_SUPPORTED, ['Chat_history', 'known-deferred', 1, 40]]);
    for (const { id, folder } of SECTIONS) {
      expect(sectionCounts(folder, result)).not.toBeNull();
      expect(sectionStatus(id, result)).toBe('pending');
    }
    // Only the block changes.
    expect(unsupportedBlockStatus(result)).toBe('has-items');
  });

  test('section order is the D-02 order whatever order the result lists categories in', () => {
    // SUPPORTED in categories.ts is Activity, Player, User_Info, Payment —
    // a different order. The result below is deliberately shuffled again.
    const result = resultOf([...SAMPLE].reverse());
    expect(navEntries(result).map((e) => e.id)).toEqual([
      'activity-history',
      'player-statistics',
      'payment-history',
      'user-info',
      'not-yet-supported',
    ]);
    expect(NAV_ORDER).toEqual([
      'activity-history',
      'player-statistics',
      'payment-history',
      'user-info',
      'not-yet-supported',
    ]);
  });

  test('absent and present-but-empty stay distinct in both status and wording', () => {
    // The plan prohibition for DATA-04: "missing" must never be shown as
    // "present but empty", and vice versa.
    const absent = resultOf([['Payment_history', 'supported', 1, 5]]);
    const empty = resultOf([['Payment_history', 'supported', 1, 0]]);

    expect(sectionStatus('payment-history', absent)).toBe('pending');
    expect(sectionStatus('payment-history', empty)).toBe('empty');
    expect(formatSectionStatus('no-export', 'Payment_history')).toBe('Not in this export');
    expect(formatSectionStatus('empty', 'Payment_history')).toBe(
      'This export contains no rows for Payment_history',
    );
  });

  test('sectionCounts returns null for a null result and for an unmatched folder', () => {
    const result = resultOf([['Chat_history', 'known-deferred', 1, 40]]);
    expect(sectionCounts('Payment_history', null)).toBeNull();
    // A non-supported entry is not a section: it must not be matched even
    // when its name equals a supported folder's name in another casing.
    expect(sectionCounts('Payment_history', result)).toBeNull();
    expect(sectionCounts('User_Info', resultOf([['User_Info', 'supported', 2, 7, 1]]))).toEqual({
      fileCount: 2,
      rowCount: 7,
      skippedRowCount: 1,
    });
  });
});

// -----------------------------------------------------------------------------
// Unsupported block
// -----------------------------------------------------------------------------

describe('unsupported block', () => {
  test('the list keeps the given order and contains no supported entry', () => {
    const result = resultOf(SAMPLE);
    expect(unsupportedEntries(result).map((c) => c.name)).toEqual([
      'Chat_history',
      'Clans',
      'Bans',
      'Device_info',
    ]);
    for (const entry of unsupportedEntries(result)) {
      expect(entry.status).not.toBe('supported');
    }
  });

  test("unsupported entries 'Bans' and 'bans' both stay separate list items", () => {
    // The adjacency rule runs the other way here: supported entries that
    // differ only in case MERGE into one section, unsupported ones stay
    // separate, because merging would hide a folder that really is there.
    const result = resultOf([
      ['Bans', 'unknown', 1, 0],
      ['bans', 'unknown', 1, 0],
    ]);
    expect(unsupportedEntries(result)).toHaveLength(2);
    expect(unsupportedBlockStatus(result)).toBe('has-items');
  });

  test('zero unsupported folders gives block status none', () => {
    expect(unsupportedBlockStatus(resultOf(FULL_SUPPORTED))).toBe('none');
    expect(unsupportedEntries(resultOf(FULL_SUPPORTED))).toEqual([]);
  });

  test('one unsupported folder gives has-items with a one-item list', () => {
    const result = resultOf([...FULL_SUPPORTED, ['Clans', 'known-deferred', 1, 2]]);
    expect(unsupportedBlockStatus(result)).toBe('has-items');
    expect(unsupportedEntries(result)).toHaveLength(1);
  });

  test('unsupportedSectionStatus maps the block onto the shared section shell', () => {
    // D-07: one section component renders all five blocks, so the block
    // status is translated into the same SectionStatus vocabulary.
    expect(unsupportedSectionStatus(null)).toBe('not-loaded');
    expect(unsupportedSectionStatus(resultOf(FULL_SUPPORTED))).toBe('empty');
    expect(unsupportedSectionStatus(resultOf(SAMPLE))).toBe('ready');
  });
});

// -----------------------------------------------------------------------------
// Nav entry model
// -----------------------------------------------------------------------------

describe('navEntries', () => {
  test('a null result gives five muted entries with reason not-loaded, in NAV_ORDER', () => {
    expect(navEntries(null)).toEqual([
      { id: 'activity-history', muted: true, reason: 'not-loaded' },
      { id: 'player-statistics', muted: true, reason: 'not-loaded' },
      { id: 'payment-history', muted: true, reason: 'not-loaded' },
      { id: 'user-info', muted: true, reason: 'not-loaded' },
      { id: 'not-yet-supported', muted: true, reason: 'not-loaded' },
    ]);
  });

  test('the sample export gives five unmuted entries', () => {
    const entries = navEntries(resultOf(SAMPLE));
    expect(entries).toHaveLength(5);
    for (const entry of entries) {
      expect(entry.muted).toBe(false);
      expect(entry.reason).toBeNull();
    }
  });

  test('a missing Payment_history mutes only that link', () => {
    const entries = navEntries(resultOf(SAMPLE.filter(([name]) => name !== 'Payment_history')));
    expect(entries.find((e) => e.id === 'payment-history')).toEqual({
      id: 'payment-history',
      muted: true,
      reason: 'no-export',
    });
    expect(entries.filter((e) => e.muted)).toHaveLength(1);
  });

  test('a zero-row section mutes with reason empty', () => {
    const entries = navEntries(
      resultOf(
        SAMPLE.map((e) => (e[0] === 'Payment_history' ? ['Payment_history', e[1], e[2], 0] : e)),
      ),
    );
    expect(entries.find((e) => e.id === 'payment-history')).toEqual({
      id: 'payment-history',
      muted: true,
      reason: 'empty',
    });
  });

  test('an only-supported export mutes the last link with reason none', () => {
    const entries = navEntries(resultOf(FULL_SUPPORTED));
    expect(entries.find((e) => e.id === 'not-yet-supported')).toEqual({
      id: 'not-yet-supported',
      muted: true,
      reason: 'none',
    });
    expect(entries.filter((e) => e.muted)).toHaveLength(1);
  });
});
