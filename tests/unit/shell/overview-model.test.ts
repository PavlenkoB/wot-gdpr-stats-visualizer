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
  ACCOUNT_ROW_MULTI_SUMMARY,
  ACCOUNT_ROW_SUMMARY,
  formatAccountCount,
  formatCreatedDate,
  formatEarliestCreated,
  formatSectionStatus,
} from '../../../src/lib/ui-copy.ts';
import type {
  AccountIdentity,
  AccountSummary,
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
  test('is the seven data panes in list order, a subset of PANE_IDS', () => {
    expect([...OVERVIEW_CARD_IDS]).toEqual([
      'playtime',
      'login-history',
      'vehicles',
      'finance',
      'payments',
      'device-info',
      'account',
    ]);
    for (const id of OVERVIEW_CARD_IDS) expect(PANE_IDS).toContain(id);
  });
});

describe('overviewChips', () => {
  test('the sample shape has seven sections with data, none absent, and the unsupported count', () => {
    expect(overviewChips(SAMPLE())).toEqual({ withData: 7, absent: 0, unsupported: 3 });
  });

  test('a missing Payment_history is one absent section and six with data', () => {
    const result = resultOf([...without('Payment_history'), ...UNSUPPORTED]);
    expect(overviewChips(result)).toEqual({ withData: 6, absent: 1, unsupported: 3 });
  });

  test('a missing Device_info is one absent section, counted like the others', () => {
    const result = resultOf([...without('Device_info'), ...UNSUPPORTED]);
    expect(overviewChips(result)).toEqual({ withData: 6, absent: 1, unsupported: 3 });
  });

  test('a zero-row Payment_history is in neither chip (DATA-04)', () => {
    const result = resultOf([
      ...FULL_SUPPORTED.map((spec): EntrySpec =>
        spec[0] === 'Payment_history' ? [spec[0], spec[1], 1, 0] : spec,
      ),
    ]);
    expect(overviewChips(result)).toEqual({ withData: 6, absent: 0, unsupported: 0 });
  });

  test('withData + absent + empty always equals the seven card panes', () => {
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
  test('the sample gives seven available cards in list order, each equal to its list row', () => {
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
    expect(cards.filter((card) => card.available)).toHaveLength(6);
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

  test('the Device info card sits before Account and says what its row says', () => {
    const result = SAMPLE();
    const cards = overviewCards(result);
    const ids = cards.map((card) => card.id);
    expect(ids.indexOf('device-info')).toBe(ids.indexOf('account') - 1);
    const card = cards.find((entry) => entry.id === 'device-info')!;
    expect(card.title).toBe('Device info');
    expect(card.available).toBe(true);
    const row = paneEntries(result).find((entry) => entry.id === 'device-info')!;
    expect(card.headline).toBe(row.headline);
    expect(card.summary).toBe(row.summary);
  });

  test('a null result is seven unavailable cards', () => {
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

// =============================================================================
// Phase 9, plan 09-05 — the Account card for two or more accounts
// =============================================================================
//
// "Account created {date}" is a claim about ONE account, so on a dataset
// holding several it becomes "Earliest account created {date}": the MINIMUM
// across accounts, never the legacy first-account field. The card title becomes
// the account count so the Overview says the same thing the header and the list
// row say.
//
// The three account shapes carry ISO, dotted and absent creation dates, so the
// minimum is one a string comparison would get wrong (`02.03.2015` sorts after
// every ISO value) and one a `Date` round-trip could shift a day.
function accountOf(
  root: string,
  identity: AccountSummary['identity'],
  overrides: Partial<AccountSummary> = {},
): AccountSummary {
  return { root, identity, games: ['WOT'], firstYear: 2015, lastYear: 2026, ...overrides };
}

const THREE_ACCOUNTS: AccountSummary[] = [
  accountOf('2000002', null, { firstYear: null, lastYear: null }),
  accountOf('500000001', {
    nickname: 'EU Tanker',
    region: 'EU',
    createdAt: '2018-02-14 18:00:00',
  }),
  // The dotted shape, and the earliest of the three — a lexicographic
  // comparison would pick 2018-02-14 instead and name the wrong day.
  accountOf('1000000003', {
    nickname: 'NA Commander',
    region: 'NA',
    createdAt: '02.03.2015 09:00:00',
  }),
];

const MULTI = (): ClassifyResult =>
  resultOf([...FULL_SUPPORTED, ...UNSUPPORTED], {
    importedAt: 'stamp-1',
    identity: IDENTITY,
    accounts: THREE_ACCOUNTS,
  });

describe('overviewCards: the Account card with two or more accounts', () => {
  test('three accounts: the title is the count and the summary is the EARLIEST date', () => {
    const account = overviewCards(MULTI()).find((card) => card.id === 'account')!;
    expect(account.available).toBe(true);
    expect(account.title).toBe('3 accounts');
    expect(account.summary).toBe('Earliest account created 02.03.2015');
    // And the summary is the formatter's, not a literal built here.
    expect(account.summary).toBe(formatEarliestCreated('02.03.2015'));
  });

  test('the minimum is the earliest, not the legacy identity and not the first account', () => {
    // `IDENTITY.createdAt` on this fixture is 2015-03-11 and the FIRST account
    // has no identity at all, so a model that read either of those would name a
    // different day than the third account's dotted date.
    const account = overviewCards(MULTI()).find((card) => card.id === 'account')!;
    expect(account.summary).not.toContain('2015-03-11');
    expect(account.summary).not.toContain(IDENTITY_CREATED_LABEL);
  });

  test('two accounts is already multi, and one is byte-identical to v1.0', () => {
    const two = overviewCards(
      resultOf([...FULL_SUPPORTED, ...UNSUPPORTED], {
        importedAt: 'stamp-1',
        identity: IDENTITY,
        accounts: THREE_ACCOUNTS.slice(0, 2),
      }),
    ).find((card) => card.id === 'account')!;
    expect(two.title).toBe('2 accounts');
    expect(two.summary).toBe('Earliest account created 2018-02-14');

    const one = overviewCards(
      resultOf([...FULL_SUPPORTED, ...UNSUPPORTED], {
        importedAt: 'stamp-1',
        identity: IDENTITY,
        accounts: [THREE_ACCOUNTS[1]!],
      }),
    ).find((card) => card.id === 'account')!;
    expect(one.title).toBe(PANE_TITLES.account);
    expect(one.summary).toBe(`${IDENTITY_CREATED_LABEL} 2015-03-11`);
  });

  test("no account's creation date is shown as THE export's date", () => {
    const account = overviewCards(MULTI()).find((card) => card.id === 'account')!;
    expect(account.summary).not.toContain('2018-02-14');
    expect(account.summary).not.toContain('2021-05-10');
  });

  test('no nickname and no per-account region reaches the card', () => {
    const account = overviewCards(MULTI()).find((card) => card.id === 'account')!;
    const rendered = JSON.stringify(account);
    expect(rendered).not.toContain('EU Tanker');
    expect(rendered).not.toContain('NA Commander');
    expect(rendered).not.toContain('Tanker');
    expect(account.headline).not.toBe('EU');
    expect(account.headline).not.toBe('NA');
  });

  test('a multi dataset whose dates all fail to parse says the date is unknown', () => {
    // The unknown sentence rather than a guess: a card that named a day nobody
    // wrote would be a statement about the user's own account the data does not
    // support.
    const unparseable = [
      accountOf('2000002', { nickname: 'A', region: 'EU', createdAt: 'not a date' }),
      accountOf('500000001', { nickname: 'B', region: 'NA', createdAt: null }),
    ];
    const account = overviewCards(
      resultOf([...FULL_SUPPORTED, ...UNSUPPORTED], {
        importedAt: 'stamp-1',
        identity: IDENTITY,
        accounts: unparseable,
      }),
    ).find((card) => card.id === 'account')!;
    expect(account.summary).toBe('Earliest account creation date unknown');
    expect(account.summary).toBe(formatEarliestCreated(null));
  });

  test('an UNAVAILABLE account card keeps the row wording, multi or not', () => {
    const account = overviewCards(
      resultOf(
        without('User_Info').map((spec): EntrySpec => spec),
        { accounts: THREE_ACCOUNTS },
      ),
    ).find((card) => card.id === 'account')!;
    expect(account.available).toBe(false);
    expect(account.summary).toBe('Not in this export');
    expect(account.summary).not.toContain('Earliest');
  });

  test('every other card is unchanged by the account count', () => {
    const single = overviewCards(SAMPLE());
    const multi = overviewCards(MULTI());
    for (const id of OVERVIEW_CARD_IDS) {
      if (id === 'account') continue;
      expect(
        multi.find((card) => card.id === id),
        `${id} is unchanged`,
      ).toEqual(single.find((card) => card.id === id));
    }
  });
});

// =============================================================================
// Phase 9, plan 09-11 — the Account row and card follow the root count
// =============================================================================
//
// An archive of two folders of which one stores nothing publishes ONE account
// beside `rootCount: 2`. The legacy `identity` is the first folder's, so the
// row headline (a location code) and the card summary ("Account created ...")
// must not present it as the export's. The legacy identity here is region `CA`
// created 2015-03-11, while the one published account is created 2018-02-14, so
// a card that read the wrong field shows the wrong date instead of passing by
// coincidence.
describe('the Account row and card under the root-count rule (09-11)', () => {
  const PUBLISHED_EU = accountOf('500000001', {
    nickname: 'EU Tanker',
    region: 'EU',
    createdAt: '2018-02-14 18:00:00',
  });
  const entries = [...FULL_SUPPORTED, ...UNSUPPORTED];
  const rowOf = (result: ClassifyResult) =>
    paneEntries(result).find((entry) => entry.id === 'account')!;
  const cardOf = (result: ClassifyResult) =>
    overviewCards(result).find((card) => card.id === 'account')!;

  test('rootCount 2 beside one account: the row is the multi row, never the region', () => {
    const result = resultOf(entries, {
      importedAt: 'stamp-1',
      identity: IDENTITY,
      accounts: [PUBLISHED_EU],
      rootCount: 2,
    });
    const row = rowOf(result);
    expect(row.headline).toBe(formatAccountCount(1));
    expect(row.headline).not.toBe(IDENTITY.region);
    expect(row.summary).toBe(ACCOUNT_ROW_MULTI_SUMMARY);
  });

  test('rootCount 2 beside one account: the card names the earliest date, not the legacy one', () => {
    const result = resultOf(entries, {
      importedAt: 'stamp-1',
      identity: IDENTITY,
      accounts: [PUBLISHED_EU],
      rootCount: 2,
    });
    const card = cardOf(result);
    expect(card.title).toBe(formatAccountCount(1));
    expect(card.summary).toBe(formatEarliestCreated('2018-02-14'));
    expect(card.summary).not.toContain('2015-03-11');
    expect(card.summary).not.toContain(IDENTITY_CREATED_LABEL);
  });

  test('rootCount 2 and an empty published list: zero accounts, unknown date', () => {
    const result = resultOf(entries, {
      importedAt: 'stamp-1',
      identity: IDENTITY,
      accounts: [],
      rootCount: 2,
    });
    expect(rowOf(result).headline).toBe(formatAccountCount(0));
    const card = cardOf(result);
    expect(card.title).toBe(formatAccountCount(0));
    expect(card.summary).toBe(formatEarliestCreated(null));
  });

  test('rootCount 1 beside one account keeps the v1.0 wording', () => {
    const result = resultOf(entries, {
      importedAt: 'stamp-1',
      identity: IDENTITY,
      accounts: [PUBLISHED_EU],
      rootCount: 1,
    });
    expect(rowOf(result).headline).toBe('CA');
    expect(rowOf(result).summary).toBe(ACCOUNT_ROW_SUMMARY);
    expect(cardOf(result).title).toBe(PANE_TITLES.account);
    expect(cardOf(result).summary).toBe(
      `${IDENTITY_CREATED_LABEL} ${formatCreatedDate('2015-03-11 08:30:00')}`,
    );
  });

  test('no rootCount beside one account keeps the v1.0 wording', () => {
    const result = resultOf(entries, {
      importedAt: 'stamp-1',
      identity: IDENTITY,
      accounts: [PUBLISHED_EU],
    });
    expect(rowOf(result).headline).toBe('CA');
    expect(cardOf(result).title).toBe(PANE_TITLES.account);
  });

  test('no rootCount beside two or three accounts keeps the existing multi wording', () => {
    const three = cardOf(MULTI());
    expect(three.title).toBe('3 accounts');
    expect(rowOf(MULTI()).headline).toBe('3 accounts');
    const two = resultOf(entries, {
      importedAt: 'stamp-1',
      identity: IDENTITY,
      accounts: THREE_ACCOUNTS.slice(0, 2),
    });
    expect(rowOf(two).headline).toBe('2 accounts');
    expect(cardOf(two).title).toBe('2 accounts');
  });
});

// =============================================================================
// Phase 11, plan 11-05 — the two OPTIONAL cards (D-01, D-03; UI-SPEC Surface 6)
// =============================================================================
//
// An Overview card is a FILTER over `paneEntries`, so an optional pane gets one
// exactly when it gets a list row. The two states D-09 tells apart are both
// here and neither is "not in this export": an absent pane has NO card at all,
// and a present-but-empty one has an unavailable card whose reason is `empty`.
// That is what keeps an absent pane out of the "N not in this export" chip.
describe('overviewCards: the optional new-game panes', () => {
  /** `SAMPLE()` plus the pane facts a worker publishes for a real import. */
  function withPanes(panes: NonNullable<ClassifyResult['newDataPanes']>): ClassifyResult {
    return { ...SAMPLE(), newDataPanes: panes };
  }

  test('a result without newDataPanes gives exactly the seven v1.0 cards', () => {
    expect(overviewCards(SAMPLE()).map((card) => card.id)).toEqual([...OVERVIEW_CARD_IDS]);
    expect(overviewCards(withPanes({}))).toEqual(overviewCards(SAMPLE()));
    expect(overviewChips(SAMPLE())).toEqual({ withData: 7, absent: 0, unsupported: 3 });
    expect(overviewChips(withPanes({}))).toEqual(overviewChips(SAMPLE()));
  });

  test('both panes present: nine cards, the new ones after Vehicles and before Finance', () => {
    const cards = overviewCards(
      withPanes({
        heat: { fileCount: 4, rowCount: 12 },
        'warships-storage': { fileCount: 2, rowCount: 31 },
      }),
    );
    expect(cards.map((card) => card.id)).toEqual([
      'playtime',
      'login-history',
      'vehicles',
      'heat',
      'warships-storage',
      'finance',
      'payments',
      'device-info',
      'account',
    ]);
    expect(cards).toHaveLength(9);
  });

  test('a present optional card is available, and says what its list row says', () => {
    const result = withPanes({ heat: { fileCount: 4, rowCount: 12 } });
    const heat = overviewCards(result).find((card) => card.id === 'heat')!;
    expect(heat.title).toBe(PANE_TITLES.heat);
    expect(heat.title).toBe('HEAT');
    expect(heat.available).toBe(true);
    expect(heat.reason).toBeNull();
    expect(heat.headline).toBe('12 rows');
    expect(heat.summary).toBe('Battle types, stats, storage · 4 files');
    // The Overview never rewords a row (D-08), so the two are equal objects.
    const row = paneEntries(result).find((entry) => entry.id === 'heat')!;
    expect(heat.headline).toBe(row.headline);
    expect(heat.summary).toBe(row.summary);
  });

  test('a present-but-empty optional card is unavailable with reason empty', () => {
    const cards = overviewCards(withPanes({ 'warships-storage': { fileCount: 2, rowCount: 0 } }));
    const storage = cards.find((card) => card.id === 'warships-storage')!;
    expect(storage.available).toBe(false);
    expect(storage.reason).toBe('empty');
    expect(storage.headline).toBe(ROW_HEADLINE_NONE);
    expect(storage.summary).toBe('This export contains no rows for Warships crews & storage');
  });

  test('an absent optional pane has no card and is in neither chip (A2)', () => {
    const withHeat = withPanes({ heat: { fileCount: 4, rowCount: 12 } });
    const cards = overviewCards(withHeat);
    expect(cards.some((card) => card.id === 'warships-storage')).toBe(false);
    // One more section with data, and NOTHING added to the absent count.
    expect(overviewChips(withHeat)).toEqual({ withData: 8, absent: 0, unsupported: 3 });
  });

  test('a present-but-empty optional pane is in neither chip (DATA-04)', () => {
    const empty = withPanes({ heat: { fileCount: 4, rowCount: 0 } });
    expect(overviewChips(empty)).toEqual({ withData: 7, absent: 0, unsupported: 3 });
    expect(overviewCards(empty).find((card) => card.id === 'heat')!.reason).toBe('empty');
  });

  test('withData + absent + empty counts the CARDS that exist, optional ones included', () => {
    const result = withPanes({
      heat: { fileCount: 4, rowCount: 12 },
      'warships-storage': { fileCount: 2, rowCount: 0 },
    });
    const chips = overviewChips(result);
    const empty = overviewCards(result).filter((card) => card.reason === 'empty').length;
    expect(chips.withData + chips.absent + empty).toBe(overviewCards(result).length);
    expect(empty).toBe(1);
  });
});
