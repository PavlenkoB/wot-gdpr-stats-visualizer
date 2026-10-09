import { describe, expect, test } from 'vitest';
import {
  OVERVIEW_CARD_IDS,
  overviewCards,
  overviewChips,
} from '../../../src/lib/shell/overview-model.ts';
import { PANE_IDS, paneEntries } from '../../../src/lib/shell/selection-state.ts';
import {
  IDENTITY_CREATED_LABEL,
  PANE_TITLES,
  ROW_HEADLINE_NONE,
  formatSectionStatus,
} from '../../../src/lib/ui-copy.ts';
import type {
  AccountIdentity,
  CategoryEntry,
  CategoryStatus,
  ClassifyResult,
} from '../../../src/lib/core/types/worker-messages.ts';

// =============================================================================
// overview-model - the chips and the six cards (08-05-PLAN Task 1)
// =============================================================================
//
// Chips and cards are filters over `paneEntries`, so these tests prove the
// arithmetic and, above all, that an absent section and an empty section are
// counted differently (DATA-04). Pure, DOM-free, runs under Node. The helper is
// copied from selection-state.test.ts (test files do not import each other).
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

const UNSUPPORTED: EntrySpec[] = [
  ['Chat_history', 'known-deferred', 1, 40],
  ['Bans', 'unknown', 1, 0],
  ['Clans', 'known-deferred', 1, 3],
];

const IDENTITY: AccountIdentity = {
  nickname: 'Tanker',
  region: 'CA',
  createdAt: '2015-03-11 08:30:00',
};

const SAMPLE = (): ClassifyResult =>
  resultOf([...FULL_SUPPORTED, ...UNSUPPORTED], { importedAt: 'stamp-1', identity: IDENTITY });

function without(folder: string): EntrySpec[] {
  return FULL_SUPPORTED.filter(([name]) => name !== folder);
}

describe('OVERVIEW_CARD_IDS', () => {
  test('is the six data panes in list order, a subset of PANE_IDS', () => {
    expect([...OVERVIEW_CARD_IDS]).toEqual([
      'playtime',
      'login-history',
      'vehicles',
      'finance',
      'payments',
      'account',
    ]);
    for (const id of OVERVIEW_CARD_IDS) expect(PANE_IDS).toContain(id);
  });
});

describe('overviewChips', () => {
  test('the sample shape has six sections with data, none absent, and the unsupported count', () => {
    expect(overviewChips(SAMPLE())).toEqual({ withData: 6, absent: 0, unsupported: 3 });
  });

  test('a missing Payment_history is one absent section and five with data', () => {
    const result = resultOf([...without('Payment_history'), ...UNSUPPORTED]);
    expect(overviewChips(result)).toEqual({ withData: 5, absent: 1, unsupported: 3 });
  });

  test('a zero-row Payment_history is in neither chip (DATA-04)', () => {
    const result = resultOf([
      ...FULL_SUPPORTED.map((spec): EntrySpec =>
        spec[0] === 'Payment_history' ? [spec[0], spec[1], 1, 0] : spec,
      ),
    ]);
    expect(overviewChips(result)).toEqual({ withData: 5, absent: 0, unsupported: 0 });
  });

  test('withData + absent + empty always equals the six card panes', () => {
    const shapes: ClassifyResult[] = [
      SAMPLE(),
      resultOf(without('Payment_history')),
      resultOf(without('Activity_history')),
      resultOf([
        ['Activity_history', 'supported', 1, 0],
        ['Payment_history', 'supported', 1, 0],
        ['User_Info', 'supported', 1, 1],
      ]),
      resultOf([]),
    ];
    for (const result of shapes) {
      const chips = overviewChips(result);
      const empty = overviewCards(result).filter((card) => card.reason === 'empty').length;
      expect(chips.withData + chips.absent + empty).toBe(OVERVIEW_CARD_IDS.length);
    }
  });

  test('a null result is all zeros', () => {
    expect(overviewChips(null)).toEqual({ withData: 0, absent: 0, unsupported: 0 });
  });
});

describe('overviewCards', () => {
  test('the sample gives six available cards in list order, each equal to its list row', () => {
    const result = SAMPLE();
    const cards = overviewCards(result);
    expect(cards.map((card) => card.id)).toEqual([...OVERVIEW_CARD_IDS]);
    for (const card of cards) {
      expect(card.available).toBe(true);
      expect(card.reason).toBeNull();
      expect(card.title).toBe(PANE_TITLES[card.id]);
      const row = paneEntries(result).find((entry) => entry.id === card.id)!;
      expect(card.headline).toBe(row.headline);
    }
  });

  test('a missing Payment_history makes only the payments card unavailable', () => {
    const cards = overviewCards(resultOf([...without('Payment_history'), ...UNSUPPORTED]));
    const payments = cards.find((card) => card.id === 'payments')!;
    expect(payments.available).toBe(false);
    expect(payments.reason).toBe('no-export');
    expect(payments.headline).toBe(ROW_HEADLINE_NONE);
    expect(payments.summary).toBe('Not in this export');
    expect(cards.filter((card) => card.available)).toHaveLength(5);
  });

  test('a zero-row Payment_history says it has no rows, not that it is absent', () => {
    const cards = overviewCards(
      resultOf(
        FULL_SUPPORTED.map((spec): EntrySpec =>
          spec[0] === 'Payment_history' ? [spec[0], spec[1], 1, 0] : spec,
        ),
      ),
    );
    const payments = cards.find((card) => card.id === 'payments')!;
    expect(payments.available).toBe(false);
    expect(payments.reason).toBe('empty');
    expect(payments.summary).toBe(formatSectionStatus('empty', 'Payment_history'));
    expect(payments.summary).not.toBe('Not in this export');
  });

  test('both Activity cards go unavailable together', () => {
    const cards = overviewCards(resultOf(without('Activity_history')));
    const playtime = cards.find((card) => card.id === 'playtime')!;
    const logins = cards.find((card) => card.id === 'login-history')!;
    expect(playtime.available).toBe(false);
    expect(logins.available).toBe(false);
    expect(playtime.reason).toBe(logins.reason);
    expect(overviewChips(resultOf(without('Activity_history'))).absent).toBe(2);
  });

  test('a null result is six unavailable cards', () => {
    const cards = overviewCards(null);
    expect(cards).toHaveLength(OVERVIEW_CARD_IDS.length);
    for (const card of cards) {
      expect(card.available).toBe(false);
      expect(card.reason).toBe('not-loaded');
    }
  });

  test('the account card names the created date and the region, and never the nickname', () => {
    const account = overviewCards(SAMPLE()).find((card) => card.id === 'account')!;
    expect(account.headline).toBe('CA');
    expect(account.summary).toBe(`${IDENTITY_CREATED_LABEL} 2015-03-11`);
    expect(JSON.stringify(account)).not.toContain('Tanker');
  });

  test('an unavailable account card keeps the row wording rather than a created date', () => {
    const account = overviewCards(resultOf(without('User_Info'))).find(
      (card) => card.id === 'account',
    )!;
    expect(account.available).toBe(false);
    expect(account.summary).toBe('Not in this export');
  });
});
