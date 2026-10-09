import { describe, expect, test } from 'vitest';
import {
  DEFAULT_PANE,
  PANE_IDS,
  PHONE_MAX_WIDTH_PX,
  PHONE_MEDIA_QUERY,
  SIDE_BY_SIDE_MEDIA_QUERY,
  SIDE_BY_SIDE_MIN_WIDTH_PX,
  PANE_SECTION,
  datasetStamp,
  paneEntries,
  resolvePhoneView,
  resolveSelection,
  stepSelection,
  type PaneEntry,
  type PaneId,
} from '../../../src/lib/shell/selection-state.ts';
import {
  ACCOUNT_ROW_SUMMARY,
  OVERVIEW_ROW_SUMMARY,
  PANE_TITLES,
  ROW_HEADLINE_NONE,
  UNKNOWN_VALUE,
  UNSUPPORTED_NONE_DETECTED,
  formatFolderCount,
  formatRowCount,
  formatRowSummary,
  formatSectionStatus,
} from '../../../src/lib/ui-copy.ts';
import type {
  AccountIdentity,
  CategoryEntry,
  CategoryStatus,
  ClassifyResult,
} from '../../../src/lib/core/types/worker-messages.ts';

// =============================================================================
// selection-state - the pane model (08-01-PLAN Task 1)
// =============================================================================
//
// The list pane, the Overview grid and the detail pane all read the pane rows
// this module derives, so these tests are the one place that proves a row says
// the same thing the nav status ladder says. Pure, DOM-free, runs under Node.
// The helper below is copied from dashboard-status.test.ts (test files do not
// import each other).
// =============================================================================

type EntrySpec = [
  name: string,
  status: CategoryStatus,
  fileCount: number,
  rowCount?: number,
  skippedRowCount?: number,
];

function resultOf(
  entries: EntrySpec[],
  extra: { importedAt?: string; identity?: AccountIdentity | null } = {},
): ClassifyResult {
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
  return { accountRoot: '123456789', categories, counts, ...extra };
}

const FULL_SUPPORTED: EntrySpec[] = [
  ['Activity_history', 'supported', 2, 1204],
  ['Player_statistics', 'supported', 3, 8123],
  ['Financial_data', 'supported', 2, 17],
  ['Payment_history', 'supported', 1, 12],
  ['User_Info', 'supported', 1, 1],
];

const SAMPLE: EntrySpec[] = [
  ...FULL_SUPPORTED,
  ['Chat_history', 'known-deferred', 1, 40],
  ['Bans', 'unknown', 1, 0],
];

const IDENTITY: AccountIdentity = { nickname: 'Tanker', region: '30', createdAt: '2015-03-11' };

/** Look one row up by pane id, failing loudly instead of returning undefined. */
function rowOf(entries: PaneEntry[], id: PaneId): PaneEntry {
  const entry = entries.find((candidate) => candidate.id === id);
  if (entry === undefined) throw new Error(`no row for ${id}`);
  return entry;
}

describe('the pane vocabulary', () => {
  test('PANE_IDS is the eight ids in the fixed order', () => {
    expect([...PANE_IDS]).toEqual([
      'overview',
      'playtime',
      'login-history',
      'vehicles',
      'finance',
      'payments',
      'account',
      'not-yet-supported',
    ]);
  });

  test('every id has a title and a section mapping', () => {
    for (const id of PANE_IDS) {
      expect(PANE_TITLES[id]).toBeTypeOf('string');
      expect(PANE_TITLES[id]).not.toBe('');
      expect(id in PANE_SECTION).toBe(true);
    }
    expect(PANE_SECTION).toEqual({
      overview: null,
      playtime: 'activity-history',
      'login-history': 'activity-history',
      vehicles: 'player-statistics',
      finance: 'financial-data',
      payments: 'payment-history',
      account: 'user-info',
      'not-yet-supported': 'not-yet-supported',
    });
  });

  test('the default pane is Overview', () => {
    expect(DEFAULT_PANE).toBe('overview');
  });
});

describe('paneEntries', () => {
  test('a null result gives eight muted rows, Overview included', () => {
    const entries = paneEntries(null);
    expect(entries.map((entry) => entry.id)).toEqual([...PANE_IDS]);
    for (const entry of entries) {
      expect(entry.muted).toBe(true);
      expect(entry.reason).toBe('not-loaded');
      expect(entry.summary).toBe('Drop an export to see this section');
      expect(entry.headline).toBe(entry.id === 'overview' ? '' : ROW_HEADLINE_NONE);
    }
  });

  test('the sample export mutes nothing and counts each pane', () => {
    const entries = paneEntries(resultOf(SAMPLE, { importedAt: 'a', identity: IDENTITY }));
    expect(entries.filter((entry) => entry.muted)).toEqual([]);

    expect(rowOf(entries, 'overview')).toMatchObject({
      headline: '',
      summary: OVERVIEW_ROW_SUMMARY,
    });
    // Both Activity panes read one folder, so they say the same thing.
    for (const id of ['playtime', 'login-history'] as const) {
      expect(rowOf(entries, id)).toMatchObject({
        headline: formatRowCount(1204),
        summary: formatRowSummary('Activity_history', 2),
      });
    }
    expect(rowOf(entries, 'vehicles').headline).toBe(formatRowCount(8123));
    expect(rowOf(entries, 'vehicles').summary).toBe(formatRowSummary('Player_statistics', 3));
    expect(rowOf(entries, 'finance').headline).toBe(formatRowCount(17));
    expect(rowOf(entries, 'payments').headline).toBe(formatRowCount(12));
    expect(rowOf(entries, 'payments').summary).toBe(formatRowSummary('Payment_history', 1));
    expect(rowOf(entries, 'account')).toMatchObject({
      headline: '30',
      summary: ACCOUNT_ROW_SUMMARY,
    });
    expect(rowOf(entries, 'not-yet-supported')).toMatchObject({
      headline: '2 folders',
      summary: '',
    });
  });

  test('a missing Payment_history mutes only payments, with the not-in-export wording', () => {
    const entries = paneEntries(
      resultOf(
        SAMPLE.filter(([name]) => name !== 'Payment_history'),
        { importedAt: 'a' },
      ),
    );
    expect(entries.filter((entry) => entry.muted).map((entry) => entry.id)).toEqual(['payments']);
    expect(rowOf(entries, 'payments')).toEqual({
      id: 'payments',
      muted: true,
      reason: 'no-export',
      headline: ROW_HEADLINE_NONE,
      summary: 'Not in this export',
    });
  });

  test('a zero-row Activity_history mutes BOTH Activity panes with the no-rows wording', () => {
    const entries = paneEntries(
      resultOf(
        SAMPLE.map((spec) =>
          spec[0] === 'Activity_history' ? ['Activity_history', 'supported', 1, 0] : spec,
        ),
        { importedAt: 'a' },
      ),
    );
    expect(entries.filter((entry) => entry.muted).map((entry) => entry.id)).toEqual([
      'playtime',
      'login-history',
    ]);
    for (const id of ['playtime', 'login-history'] as const) {
      expect(rowOf(entries, id).reason).toBe('empty');
      expect(rowOf(entries, id).summary).toBe('This export contains no rows for Activity_history');
    }
  });

  test('absent and present-but-empty never share a wording (DATA-04)', () => {
    const absent = rowOf(
      paneEntries(resultOf([['User_Info', 'supported', 1, 1]])),
      'finance',
    ).summary;
    const empty = rowOf(
      paneEntries(resultOf([['Financial_data', 'supported', 1, 0]])),
      'finance',
    ).summary;
    expect(absent).toBe(formatSectionStatus('no-export', 'Financial_data'));
    expect(empty).toBe(formatSectionStatus('empty', 'Financial_data'));
    expect(absent).not.toBe(empty);
  });

  test('an export with no unsupported folders mutes the footer row', () => {
    const entries = paneEntries(resultOf(FULL_SUPPORTED, { importedAt: 'a' }));
    expect(rowOf(entries, 'not-yet-supported')).toEqual({
      id: 'not-yet-supported',
      muted: true,
      reason: 'none',
      headline: ROW_HEADLINE_NONE,
      summary: UNSUPPORTED_NONE_DETECTED,
    });
    expect(entries.filter((entry) => entry.muted)).toHaveLength(1);
  });

  test('one unsupported folder reads 1 folder', () => {
    const entries = paneEntries(resultOf([...FULL_SUPPORTED, ['Clans', 'known-deferred', 1, 2]]));
    expect(rowOf(entries, 'not-yet-supported').headline).toBe(formatFolderCount(1));
    expect(formatFolderCount(1)).toBe('1 folder');
  });

  test('a blank or absent region shows Unknown', () => {
    for (const identity of [
      { nickname: 'Tanker', region: '   ', createdAt: null },
      { nickname: 'Tanker', region: null, createdAt: null },
      null,
      undefined,
    ]) {
      const entries = paneEntries(resultOf(SAMPLE, { importedAt: 'a', identity }));
      expect(rowOf(entries, 'account').headline).toBe(UNKNOWN_VALUE);
    }
  });

  test('the region is trimmed and returned as plain text', () => {
    const hostile = '<b>30</b>';
    const entries = paneEntries(
      resultOf(SAMPLE, {
        importedAt: 'a',
        identity: { nickname: null, region: ` ${hostile} `, createdAt: null },
      }),
    );
    expect(rowOf(entries, 'account').headline).toBe(hostile);
  });

  test('a hostile zip-entry name never reaches a summary; the canonical folder does', () => {
    const entries = paneEntries(
      resultOf([
        ['USER_INFO', 'supported', 1, 1],
        ['Activity_history', 'supported', 1, 5],
      ]),
    );
    expect(rowOf(entries, 'playtime').summary).toBe('Activity_history · 1 file');
    expect(JSON.stringify(entries)).not.toContain('USER_INFO');
  });
});

describe('resolveSelection', () => {
  const loaded = resultOf(SAMPLE, { importedAt: '2026-10-01T00:00:00.000Z' });

  test('datasetStamp is the import time, or null', () => {
    expect(datasetStamp(loaded)).toBe('2026-10-01T00:00:00.000Z');
    expect(datasetStamp(null)).toBeNull();
    expect(datasetStamp(resultOf(SAMPLE))).toBeNull();
  });

  test('a matching stamp keeps the choice', () => {
    expect(resolveSelection({ pane: 'vehicles', stamp: '2026-10-01T00:00:00.000Z' }, loaded)).toBe(
      'vehicles',
    );
  });

  test('a stale stamp lands on Overview (replace, first import)', () => {
    expect(resolveSelection({ pane: 'vehicles', stamp: 'older' }, loaded)).toBe('overview');
    expect(resolveSelection({ pane: 'vehicles', stamp: null }, loaded)).toBe('overview');
  });

  test('a null result lands on Overview (clear)', () => {
    expect(resolveSelection({ pane: 'vehicles', stamp: 'x' }, null)).toBe('overview');
  });

  test('a user click on a muted pane is not vetoed', () => {
    const noPayments = resultOf(
      SAMPLE.filter(([name]) => name !== 'Payment_history'),
      { importedAt: 'a' },
    );
    expect(resolveSelection({ pane: 'payments', stamp: 'a' }, noPayments)).toBe('payments');
  });
});

describe('stepSelection', () => {
  test.each([
    ['overview', 1, 'playtime'],
    ['playtime', -1, 'overview'],
    ['login-history', 1, 'vehicles'],
    ['account', 1, 'not-yet-supported'],
    ['not-yet-supported', -1, 'account'],
  ] as const)('%s step %i is %s', (current, direction, expected) => {
    expect(stepSelection(current, direction)).toBe(expected);
  });

  test('clamps at both ends and does not wrap', () => {
    expect(stepSelection('not-yet-supported', 1)).toBe('not-yet-supported');
    expect(stepSelection('overview', -1)).toBe('overview');
  });

  test('walking forward reaches every pane, muted ones included', () => {
    const visited: PaneId[] = ['overview'];
    for (let i = 0; i < PANE_IDS.length; i += 1) {
      const last = visited[visited.length - 1] as PaneId;
      const next = stepSelection(last, 1);
      if (next !== last) visited.push(next);
    }
    expect(visited).toEqual([...PANE_IDS]);
  });
});

describe('resolvePhoneView', () => {
  const loaded = resultOf(SAMPLE, { importedAt: 'a' });

  test('a null result shows the detail screen, where the drop target lives', () => {
    expect(resolvePhoneView({ view: 'list', stamp: null }, null)).toBe('detail');
    expect(resolvePhoneView({ view: 'list', stamp: 'a' }, null)).toBe('detail');
  });

  test('a stale stamp returns to the list', () => {
    expect(resolvePhoneView({ view: 'detail', stamp: 'older' }, loaded)).toBe('list');
  });

  test('a matching stamp keeps the stored view', () => {
    expect(resolvePhoneView({ view: 'detail', stamp: 'a' }, loaded)).toBe('detail');
    expect(resolvePhoneView({ view: 'list', stamp: 'a' }, loaded)).toBe('list');
  });
});

describe('the phone query', () => {
  test('is the one 480px width, not a second breakpoint', () => {
    expect(PHONE_MAX_WIDTH_PX).toBe(480);
    expect(PHONE_MEDIA_QUERY).toBe('(max-width: 480px)');
  });
});

describe('the side-by-side query', () => {
  // The number must match the sticky-list `min-width` block in src/app.css: the
  // stylesheet and the focus choreography are two readers of one breakpoint.
  test('is the 900px sticky-list breakpoint', () => {
    expect(SIDE_BY_SIDE_MIN_WIDTH_PX).toBe(900);
    expect(SIDE_BY_SIDE_MEDIA_QUERY).toBe('(min-width: 900px)');
  });
});
