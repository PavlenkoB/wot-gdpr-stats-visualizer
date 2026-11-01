import { describe, expect, test } from 'vitest';
import {
  DEFAULT_PANE,
  OPTIONAL_PANE_IDS,
  PANE_IDS,
  PANE_ORDER,
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
import { SAMPLE_UNKNOWN_FOLDER } from '../../fixtures/export-fixtures.ts';
import {
  ACCOUNT_ROW_MULTI_SUMMARY,
  ACCOUNT_ROW_SUMMARY,
  OVERVIEW_ROW_SUMMARY,
  PANE_TITLES,
  ROW_HEADLINE_NONE,
  UNKNOWN_VALUE,
  UNSUPPORTED_NONE_DETECTED,
  formatAccountCount,
  formatFolderCount,
  formatHeatRowSummary,
  formatPerksRowSummary,
  formatTimelineRowSummary,
  formatRowCount,
  formatRowSummary,
  formatSectionStatus,
  formatWowsStorageRowSummary,
} from '../../../src/lib/ui-copy.ts';
import type {
  AccountIdentity,
  AccountSummary,
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
  extra: {
    importedAt?: string;
    identity?: AccountIdentity | null;
    accounts?: AccountSummary[];
    rootCount?: number;
  } = {},
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
  ['Device_info', 'supported', 3, 15],
  ['User_Info', 'supported', 1, 1],
];

const SAMPLE: EntrySpec[] = [
  ...FULL_SUPPORTED,
  ['Chat_history', 'known-deferred', 1, 40],
  [SAMPLE_UNKNOWN_FOLDER, 'unknown', 1, 0],
];

const IDENTITY: AccountIdentity = { nickname: 'Tanker', region: '30', createdAt: '2015-03-11' };

/** Look one row up by pane id, failing loudly instead of returning undefined. */
function rowOf(entries: PaneEntry[], id: PaneId): PaneEntry {
  const entry = entries.find((candidate) => candidate.id === id);
  if (entry === undefined) throw new Error(`no row for ${id}`);
  return entry;
}

describe('the pane vocabulary', () => {
  test('PANE_IDS is the nine ids in the fixed order', () => {
    expect([...PANE_IDS]).toEqual([
      'overview',
      'playtime',
      'login-history',
      'vehicles',
      'finance',
      'payments',
      'device-info',
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
      'device-info': 'device-info',
      account: 'user-info',
      'not-yet-supported': 'not-yet-supported',
      // The optional panes read no single folder: a HEAT or Warships pane is
      // built from files spread across the export (A3), and the Perks pane's
      // four cards live in four different folders (12-02), and the Account
      // timeline's five files live in three (12-11).
      heat: null,
      'warships-storage': null,
      perks: null,
      'account-timeline': null,
    });
  });

  test('the default pane is Overview', () => {
    expect(DEFAULT_PANE).toBe('overview');
  });
});

describe('paneEntries', () => {
  test('a null result gives nine muted rows, Overview included', () => {
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
    // The Device info row: one derivation, `{n} rows` and `Device_info · {n} files`.
    expect(rowOf(entries, 'device-info').headline).toBe(formatRowCount(15));
    expect(rowOf(entries, 'device-info').summary).toBe(formatRowSummary('Device_info', 3));
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

// =============================================================================
// Phase 9, plan 09-05 — the Account row for two or more accounts (D-13)
// =============================================================================
//
// The single-account row says "30 / Location code and creation date", and both
// halves of that are FALSE of a dataset holding several accounts: no single
// location code is the dataset's, and no single creation date is. The multi
// row names the count and describes what the header actually lists instead.
//
// Three account shapes are used on purpose, and the differences between them
// are the point: ISO vs dotted vs absent `createdAt`, distinct regions, one
// account with no identity at all. A nickname is planted in every one of them,
// because the row must not read it — the nickname's only home is the header's
// own per-account row (v1.0 D-21, T-09-20).
// =============================================================================

/** One account summary, with every field overridable so a shape can be hostile. */
function accountOf(
  root: string,
  identity: AccountSummary['identity'],
  overrides: Partial<AccountSummary> = {},
): AccountSummary {
  return { root, identity, games: ['WOT'], firstYear: 2015, lastYear: 2026, ...overrides };
}

const TWO_ACCOUNTS: AccountSummary[] = [
  accountOf('2000002', null, { firstYear: null, lastYear: null }),
  accountOf('500000001', {
    nickname: 'EU Tanker',
    region: 'EU',
    createdAt: '2018-02-14 18:00:00',
  }),
];

const THREE_ACCOUNTS: AccountSummary[] = [
  ...TWO_ACCOUNTS,
  accountOf('1000000003', {
    nickname: 'NA Commander',
    region: 'NA',
    createdAt: '2021-05-10 15:00:00',
  }),
];

describe('paneEntries: the Account row with two or more accounts', () => {
  test('three accounts: the headline is the count and the summary names what the header lists', () => {
    const entries = paneEntries(
      resultOf(SAMPLE, { importedAt: 'a', identity: IDENTITY, accounts: THREE_ACCOUNTS }),
    );
    const account = rowOf(entries, 'account');
    expect(account.headline).toBe(formatAccountCount(3));
    expect(account.headline).toBe('3 accounts');
    expect(account.summary).toBe(ACCOUNT_ROW_MULTI_SUMMARY);
  });

  test('two accounts is already the multi wording — the threshold is two, not three', () => {
    const entries = paneEntries(
      resultOf(SAMPLE, { importedAt: 'a', identity: IDENTITY, accounts: TWO_ACCOUNTS }),
    );
    expect(rowOf(entries, 'account').headline).toBe(formatAccountCount(2));
    expect(rowOf(entries, 'account').summary).toBe(ACCOUNT_ROW_MULTI_SUMMARY);
  });

  test('an EMPTY accounts list is not multi — it is the v1.0 shape, byte for byte', () => {
    // `accountCountOf` answers one for an empty list, deliberately: a
    // hand-built result that predates the field must render exactly as v1.0.
    const entries = paneEntries(
      resultOf(SAMPLE, { importedAt: 'a', identity: IDENTITY, accounts: [] }),
    );
    expect(rowOf(entries, 'account').headline).toBe('30');
    expect(rowOf(entries, 'account').summary).toBe(ACCOUNT_ROW_SUMMARY);
  });

  test('one account is unchanged, headline and summary alike', () => {
    const entries = paneEntries(
      resultOf(SAMPLE, { importedAt: 'a', identity: IDENTITY, accounts: [TWO_ACCOUNTS[1]!] }),
    );
    expect(rowOf(entries, 'account').headline).toBe('30');
    expect(rowOf(entries, 'account').summary).toBe(ACCOUNT_ROW_SUMMARY);
  });

  test("no single account's REGION is presented as the dataset's region", () => {
    const entries = paneEntries(
      resultOf(SAMPLE, { importedAt: 'a', identity: IDENTITY, accounts: THREE_ACCOUNTS }),
    );
    const account = rowOf(entries, 'account');
    expect(account.headline).not.toBe('EU');
    expect(account.headline).not.toBe('NA');
    // The legacy `identity.region` is '30' on this fixture and must not surface
    // either, for the same reason: it is ONE account's field.
    expect(account.headline).not.toBe('30');
  });

  test('no nickname is read into the row, however the accounts are named', () => {
    const entries = paneEntries(
      resultOf(SAMPLE, { importedAt: 'a', identity: IDENTITY, accounts: THREE_ACCOUNTS }),
    );
    const rendered = JSON.stringify(rowOf(entries, 'account'));
    expect(rendered).not.toContain('EU Tanker');
    expect(rendered).not.toContain('NA Commander');
  });

  // Plan 13-13: the cases of the retired Overview Account card that were about
  // the ROW (09-11, the root-count rule) now live here, on the row they describe.
  describe('under the root-count rule (09-11)', () => {
    const PUBLISHED_EU = accountOf('500000001', {
      nickname: 'EU Tanker',
      region: 'EU',
      createdAt: '2018-02-14 18:00:00',
    });
    const rootRow = (extra: Parameters<typeof resultOf>[1]) =>
      rowOf(
        paneEntries(resultOf(SAMPLE, { importedAt: 'a', identity: IDENTITY, ...extra })),
        'account',
      );

    test('rootCount 2 beside one account: the multi row, never the legacy region', () => {
      const row = rootRow({ accounts: [PUBLISHED_EU], rootCount: 2 });
      expect(row.headline).toBe(formatAccountCount(1));
      expect(row.headline).not.toBe(IDENTITY.region);
      expect(row.summary).toBe(ACCOUNT_ROW_MULTI_SUMMARY);
    });

    test('rootCount 2 and an empty published list: zero accounts', () => {
      const row = rootRow({ accounts: [], rootCount: 2 });
      expect(row.headline).toBe(formatAccountCount(0));
      expect(row.summary).toBe(ACCOUNT_ROW_MULTI_SUMMARY);
    });

    test('rootCount 1 beside one account keeps the v1.0 wording', () => {
      const row = rootRow({ accounts: [PUBLISHED_EU], rootCount: 1 });
      expect(row.headline).toBe('30');
      expect(row.summary).toBe(ACCOUNT_ROW_SUMMARY);
    });

    test('no rootCount beside one account keeps the v1.0 wording', () => {
      const row = rootRow({ accounts: [PUBLISHED_EU] });
      expect(row.headline).toBe('30');
      expect(row.summary).toBe(ACCOUNT_ROW_SUMMARY);
    });
  });

  test('an UNAVAILABLE Account row keeps the muted wording, multi or not', () => {
    const entries = paneEntries(
      resultOf(
        SAMPLE.filter(([name]) => name !== 'User_Info'),
        { importedAt: 'a', accounts: THREE_ACCOUNTS },
      ),
    );
    const account = rowOf(entries, 'account');
    expect(account.muted).toBe(true);
    expect(account.reason).toBe('no-export');
    expect(account.headline).toBe(ROW_HEADLINE_NONE);
    expect(account.summary).toBe(formatSectionStatus('no-export', 'User_Info'));
  });

  test('every other row is unchanged by the account count', () => {
    // The same dataset read with and without an account list must differ in the
    // Account row and NOWHERE else — the caption work must not have moved a
    // row count, a summary or a muted state.
    const single = paneEntries(resultOf(SAMPLE, { importedAt: 'a', identity: IDENTITY }));
    const multi = paneEntries(
      resultOf(SAMPLE, { importedAt: 'a', identity: IDENTITY, accounts: THREE_ACCOUNTS }),
    );
    for (const id of PANE_IDS) {
      if (id === 'account') continue;
      expect(rowOf(multi, id), `${id} is unchanged by the account count`).toEqual(
        rowOf(single, id),
      );
    }
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
  // The number must match the sticky-list `min-width` block in src/styles/shell.css: the
  // stylesheet and the focus choreography are two readers of one breakpoint.
  test('is the 900px sticky-list breakpoint', () => {
    expect(SIDE_BY_SIDE_MIN_WIDTH_PX).toBe(900);
    expect(SIDE_BY_SIDE_MEDIA_QUERY).toBe('(min-width: 900px)');
  });
});

// =============================================================================
// Phase 11, plan 11-05 — the two OPTIONAL panes (D-01, D-03; UI-SPEC Surface 2)
// =============================================================================
//
// `PANE_IDS` stays the nine always-present panes: about seven e2e specs and
// several unit suites iterate it, so growing it would break every loop for a
// pane most exports do not have. The two new-game panes are ADDED AROUND it —
// `OPTIONAL_PANE_IDS` for the ids, `PANE_ORDER` for where they sit, and a
// `paneEntries` that emits a row only when the worker reported that pane.
//
// The first test below is the compatibility contract in one assertion: a result
// with no `newDataPanes` must produce byte-identical output to v1.0, whatever
// the shape of the result.
// =============================================================================

/** `SAMPLE` with the pane facts a worker would publish for a real import. */
function withPanes(
  panes: NonNullable<ClassifyResult['newDataPanes']>,
  extra: Parameters<typeof resultOf>[1] = {},
): ClassifyResult {
  return {
    ...resultOf(SAMPLE, { importedAt: 'a', identity: IDENTITY, ...extra }),
    newDataPanes: panes,
  };
}

describe('the optional pane vocabulary', () => {
  test('OPTIONAL_PANE_IDS is the shared new-data contract, in the order the panes were added', () => {
    expect([...OPTIONAL_PANE_IDS]).toEqual([
      'heat',
      'warships-storage',
      'perks',
      'account-timeline',
    ]);
  });

  test('PANE_ORDER is the thirteen panes, with Account timeline directly above Account', () => {
    // The order is EXPLICIT (12-02, 12-RESEARCH Pitfall 6): the two game-data
    // panes sit directly after Vehicles, and the Perks row sits with the money
    // rows, so the optional ids are not a spread of one tuple any more.
    expect([...PANE_ORDER]).toEqual([
      'overview',
      'playtime',
      'login-history',
      'vehicles',
      'heat',
      'warships-storage',
      'finance',
      'payments',
      'perks',
      'device-info',
      'account-timeline',
      'account',
      'not-yet-supported',
    ]);
    expect(PANE_ORDER).toHaveLength(13);
  });

  test('PANE_IDS still holds exactly the nine always-present panes', () => {
    // The compatibility contract, stated as a count: the seven specs that loop
    // `PANE_IDS` must keep clicking rows that exist.
    expect(PANE_IDS).toHaveLength(9);
    for (const id of OPTIONAL_PANE_IDS) expect(PANE_IDS).not.toContain(id);
    for (const id of PANE_ORDER)
      expect(PANE_ORDER.filter((candidate) => candidate === id)).toHaveLength(1);
  });

  test('every optional pane has a title and no single section folder', () => {
    for (const id of OPTIONAL_PANE_IDS) {
      expect(PANE_TITLES[id], `${id} has a title`).toBeTypeOf('string');
      expect(PANE_TITLES[id]).not.toBe('');
      expect(PANE_SECTION[id], `${id} reads no single folder`).toBeNull();
    }
  });
});

describe('paneEntries: the two optional panes', () => {
  test('a result with no newDataPanes renders exactly the nine v1.0 rows', () => {
    const shapes: [string, ClassifyResult][] = [
      ['sample', resultOf(SAMPLE, { importedAt: 'a', identity: IDENTITY })],
      [
        'one account',
        resultOf(SAMPLE, { importedAt: 'a', identity: IDENTITY, accounts: [TWO_ACCOUNTS[1]!] }),
      ],
      [
        'three accounts',
        resultOf(SAMPLE, { importedAt: 'a', identity: IDENTITY, accounts: THREE_ACCOUNTS }),
      ],
      ['pre-parse (no field)', resultOf(SAMPLE, { importedAt: 'a' })],
    ];
    for (const [name, result] of shapes) {
      expect(
        paneEntries(result).map((entry) => entry.id),
        name,
      ).toEqual([...PANE_IDS]);
      expect(paneEntries({ ...result, newDataPanes: undefined })).toEqual(paneEntries(result));
    }
    expect(paneEntries(null).map((entry) => entry.id)).toEqual([...PANE_IDS]);
  });

  test('an empty newDataPanes object renders the nine rows, byte for byte', () => {
    const plain = resultOf(SAMPLE, { importedAt: 'a', identity: IDENTITY });
    expect(paneEntries(withPanes({}))).toEqual(paneEntries(plain));
  });

  test('a HEAT pane adds one row directly after Vehicles, with its own headline and summary', () => {
    const entries = paneEntries(withPanes({ heat: { fileCount: 4, rowCount: 12 } }));
    expect(entries.map((entry) => entry.id)).toHaveLength(10);
    const heat = rowOf(entries, 'heat');
    expect(entries[entries.indexOf(heat) - 1]?.id).toBe('vehicles');
    expect(heat).toEqual({
      id: 'heat',
      muted: false,
      reason: null,
      headline: '12 rows',
      summary: 'Battle types, stats, storage · 4 files',
    });
    expect(heat.summary).toBe(formatHeatRowSummary(4));
    expect(heat.headline).toBe(formatRowCount(12));
  });

  test('a present-but-empty Warships pane renders MUTED with the no-rows wording', () => {
    const entries = paneEntries(withPanes({ 'warships-storage': { fileCount: 2, rowCount: 0 } }));
    expect(entries.map((entry) => entry.id)).toHaveLength(10);
    expect(rowOf(entries, 'warships-storage')).toEqual({
      id: 'warships-storage',
      muted: true,
      reason: 'empty',
      headline: ROW_HEADLINE_NONE,
      summary: 'This export contains no rows for Warships crews & storage',
    });
  });

  test('a Perks pane renders between Payments and Device info, with its OWN summary', () => {
    const entries = paneEntries(withPanes({ perks: { fileCount: 1, rowCount: 3 } }));
    const perks = rowOf(entries, 'perks');
    // The documented position (12-UI-SPEC Recorded Choice 1): Perks sits with
    // the money rows, and Device info follows it.
    expect(entries[entries.indexOf(perks) - 1]?.id).toBe('payments');
    expect(entries[entries.indexOf(perks) + 1]?.id).toBe('device-info');
    expect(perks).toEqual({
      id: 'perks',
      muted: false,
      reason: null,
      headline: '3 rows',
      summary: 'Subscriptions, coupons, codes, surveys · 1 file',
    });
    expect(perks.summary).toBe(formatPerksRowSummary(1));
    expect(perks.headline).toBe(formatRowCount(3));
  });

  test('a present-but-empty Perks pane renders MUTED with the no-rows wording', () => {
    const entries = paneEntries(withPanes({ perks: { fileCount: 1, rowCount: 0 } }));
    expect(rowOf(entries, 'perks')).toEqual({
      id: 'perks',
      muted: true,
      reason: 'empty',
      headline: ROW_HEADLINE_NONE,
      summary: 'This export contains no rows for Perks',
    });
  });

  test('an Account timeline pane renders directly above Account, with its OWN summary', () => {
    const entries = paneEntries(withPanes({ 'account-timeline': { fileCount: 2, rowCount: 7 } }));
    const timeline = rowOf(entries, 'account-timeline');
    // UI-SPEC Recorded Choice 1: below Device info, directly above Account.
    expect(entries[entries.indexOf(timeline) - 1]?.id).toBe('device-info');
    expect(entries[entries.indexOf(timeline) + 1]?.id).toBe('account');
    expect(timeline).toEqual({
      id: 'account-timeline',
      muted: false,
      reason: null,
      headline: '7 rows',
      summary: 'Names, services, bans, third parties · 2 files',
    });
    expect(timeline.summary).toBe(formatTimelineRowSummary(2));
    expect(timeline.headline).toBe(formatRowCount(7));
  });

  test('an Account timeline row is absent without facts', () => {
    const entries = paneEntries(withPanes({ heat: { fileCount: 4, rowCount: 12 } }));
    expect(entries.map((entry) => entry.id)).not.toContain('account-timeline');
  });

  test('a present-but-empty Account timeline pane renders MUTED with the no-rows wording', () => {
    const entries = paneEntries(withPanes({ 'account-timeline': { fileCount: 3, rowCount: 0 } }));
    expect(rowOf(entries, 'account-timeline')).toEqual({
      id: 'account-timeline',
      muted: true,
      reason: 'empty',
      headline: ROW_HEADLINE_NONE,
      summary: 'This export contains no rows for Account timeline',
    });
  });

  test('each optional pane produces its OWN summary, and never another pane’s', () => {
    // The exhaustive switch (12-RESEARCH Pitfall 5): a two-way ternary would
    // have given the third optional pane the Warships summary without a word
    // of complaint, so each id is checked against the OTHER ids' texts.
    const entries = paneEntries(
      withPanes({
        heat: { fileCount: 4, rowCount: 12 },
        'warships-storage': { fileCount: 2, rowCount: 31 },
        perks: { fileCount: 1, rowCount: 3 },
        'account-timeline': { fileCount: 1, rowCount: 3 },
      }),
    );
    const summaries = OPTIONAL_PANE_IDS.map((id) => rowOf(entries, id).summary);
    // Four rows, four different summaries.
    expect(new Set(summaries).size).toBe(4);
    expect(rowOf(entries, 'heat').summary).toBe(formatHeatRowSummary(4));
    expect(rowOf(entries, 'warships-storage').summary).toBe(formatWowsStorageRowSummary(2));
    expect(rowOf(entries, 'perks').summary).toBe(formatPerksRowSummary(1));
    expect(rowOf(entries, 'account-timeline').summary).toBe(formatTimelineRowSummary(1));
    // And no pane's summary is another pane's.
    expect(rowOf(entries, 'account-timeline').summary).not.toBe(formatPerksRowSummary(1));
    expect(rowOf(entries, 'perks').summary).not.toBe(formatWowsStorageRowSummary(1));
    expect(rowOf(entries, 'perks').summary).not.toBe(formatHeatRowSummary(1));
  });

  test('both panes present: Vehicles, HEAT, Warships crews & storage, Finance', () => {
    const entries = paneEntries(
      withPanes({
        heat: { fileCount: 4, rowCount: 12 },
        'warships-storage': { fileCount: 2, rowCount: 31 },
      }),
    );
    expect(entries.map((entry) => entry.id)).toEqual([
      'overview',
      'playtime',
      'login-history',
      'vehicles',
      'heat',
      'warships-storage',
      'finance',
      'payments',
      'device-info',
      'account',
      'not-yet-supported',
    ]);
    expect(rowOf(entries, 'warships-storage').summary).toBe(formatWowsStorageRowSummary(2));
    expect(rowOf(entries, 'warships-storage').headline).toBe(formatRowCount(31));
  });

  test('an absent optional pane is never a muted no-export row', () => {
    const entries = paneEntries(withPanes({ heat: { fileCount: 4, rowCount: 12 } }));
    // Absence means ABSENT, which is what keeps it out of the "N not in this
    // export" chip (D-01: shown only when the export holds HEAT data).
    expect(entries.some((entry) => entry.id === 'warships-storage')).toBe(false);
    expect(
      entries.filter((entry) => entry.reason === 'no-export').map((entry) => entry.id),
    ).not.toContain('heat');
  });

  test('a null result renders no optional row at all', () => {
    expect(paneEntries(null).map((entry) => entry.id)).toEqual([...PANE_IDS]);
  });
});

describe('stepSelection over the RENDERED order', () => {
  // The rows a result with ONLY a HEAT pane renders: the optional pane the
  // result does not carry is not on screen, so a keyboard step must skip it.
  const RENDERED_WITH_HEAT = PANE_ORDER.filter((id) => id !== 'warships-storage' && id !== 'perks');

  test('the default order is still the nine panes', () => {
    expect(stepSelection('vehicles', 1)).toBe('finance');
  });

  test('stepping a rendered list follows what is on screen', () => {
    expect(stepSelection('vehicles', 1, RENDERED_WITH_HEAT)).toBe('heat');
    expect(stepSelection('heat', 1, RENDERED_WITH_HEAT)).toBe('finance');
    expect(stepSelection('heat', -1, RENDERED_WITH_HEAT)).toBe('vehicles');
  });

  test('it is still clamped, not wrapped', () => {
    expect(stepSelection('account', 1, RENDERED_WITH_HEAT)).toBe('not-yet-supported');
    expect(stepSelection('not-yet-supported', 1, RENDERED_WITH_HEAT)).toBe('not-yet-supported');
    expect(stepSelection('overview', -1, RENDERED_WITH_HEAT)).toBe('overview');
  });

  test('a current id absent from the given order is returned unchanged', () => {
    // The selection can name a pane a NEW dataset does not carry, until the
    // stamp rule falls back to Overview (D-04). Stepping must not guess.
    expect(stepSelection('warships-storage', 1, RENDERED_WITH_HEAT)).toBe('warships-storage');
  });
});
