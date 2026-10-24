// =============================================================================
// overview-totals.test.ts — the Totals group (13-08, Task 2)
//
// WHAT THIS PROVES
//   1. THE ORACLE. The three Totals tiles of the synthetic archive carry the
//      answer key's figures: the credits in-flow as an exact micro-unit
//      string, the battles and wins summed across the two account folders
//      with the guarded win rate, and the order COUNT.
//   2. THE TWO PANES AGREE. The credits tile is the Finance builder's own
//      number, compared against the builder's output computed in this test —
//      not against a literal.
//   3. THE NAMED ABSENCES. A currency log with only withdrawals, a log with
//      only gold, and each omit option answer the way the key says.
//   4. THE GUARD. Twenty-nine battles have no win rate and thirty do; a
//      missing wins column gives no wins and no rate.
//   5. ORDERS READ NOTHING. A Proxy-wrapped order row records every property
//      the tile reads, and the answer is none of them; the JSON of every
//      Totals tile carries none of the planted canaries.
//
// Every expected figure lives in `tests/helpers/overview-oracle.ts`, which
// imports NOTHING and states the arithmetic beside each number.
// =============================================================================

import { describe, expect, it } from 'vitest';
import { buildCurrency } from '../../../src/lib/features/finance/finance-aggregate.ts';
import {
  readAccountStats,
  type AccountStatsColumns,
  type AccountStatsRead,
  type AccountStatsRow,
} from '../../../src/lib/features/overview/overview-account-stats.ts';
import type { OverviewFileInput } from '../../../src/lib/features/overview/overview-aggregate.ts';
import { buildTotalsTiles } from '../../../src/lib/features/overview/overview-totals.ts';
import type { OverviewTile } from '../../../src/lib/features/overview/overview-shared.ts';
import { MIN_BATTLES_PLAIN_RATE } from '../../../src/lib/features/overview/overview-shared.ts';
import { OV_EXPECTED } from '../../helpers/overview-oracle.ts';
import { overviewInputsFromArchive } from '../../helpers/overview-inputs.ts';
import {
  OV_CANARIES,
  OV_ORDER_AMOUNT_CANARY,
  buildOverviewInsightExport,
} from '../../fixtures/overview-fixtures.ts';

// -----------------------------------------------------------------------------
// The helpers
// -----------------------------------------------------------------------------

/** The tile of an id, ready. Throws when the tile is absent. */
function ready(tiles: readonly OverviewTile[], id: string): Record<string, unknown> {
  const tile = tiles.find((entry) => entry.id === id);
  if (tile === undefined) throw new Error(`no tile ${id}`);
  if (tile.status !== 'ok') throw new Error(`expected a ready ${id} tile`);
  return tile as unknown as Record<string, unknown>;
}

/** The tile of an id, absent. Throws when the tile is ready. */
function absent(tiles: readonly OverviewTile[], id: string): Record<string, unknown> {
  const tile = tiles.find((entry) => entry.id === id);
  if (tile === undefined) throw new Error(`no tile ${id}`);
  if (tile.status !== 'absent') throw new Error(`expected an absent ${id} tile`);
  return tile as unknown as Record<string, unknown>;
}

/** One account-statistics row, with everything the Totals group reads. */
function rowOf(partial: Partial<AccountStatsRow>): AccountStatsRow {
  return {
    account: 'test-account',
    battles: null,
    wins: null,
    battleSeconds: null,
    damageMax: null,
    xpMax: null,
    fragsMax: null,
    sniperSeries: null,
    damageMaxTank: null,
    xpMaxTank: null,
    fragsMaxTank: null,
    ...partial,
  };
}

/** One account-statistics read, with the columns it resolved. */
function statsOf(
  rows: readonly AccountStatsRow[],
  columns: Partial<AccountStatsColumns> = {},
): AccountStatsRead {
  return {
    present: true,
    rows: [...rows],
    columns: {
      battles: false,
      wins: false,
      battleSeconds: false,
      damageMax: false,
      xpMax: false,
      fragsMax: false,
      sniperSeries: false,
      ...columns,
    },
  };
}

/** One currency-operations file, built by hand. */
function currencyOf(rows: readonly Record<string, string>[], seen = true): OverviewFileInput {
  return { groups: seen ? [{ account: 'test-account', rows }] : [], seen };
}

/** One currency operation row, with the columns the Finance builder reads. */
function currencyRow(
  code: string,
  type: string,
  amount: string,
  created = '2020-03-02 09:00:00',
): Record<string, string> {
  return {
    CREATED: created,
    CURRENCY_CODE: code,
    CURRENCY_TITLE: 'Credits',
    AMOUNT: amount,
    TYPE: type,
    ORDER: 'order-reference',
  };
}

/** The Totals tiles of the synthetic archive. */
function tilesOf(options: Parameters<typeof buildOverviewInsightExport>[0] = {}) {
  const inputs = overviewInputsFromArchive(buildOverviewInsightExport(options));
  return {
    inputs,
    tiles: buildTotalsTiles({
      stats: readStatsOf(inputs.accountStats),
      currency: inputs.currency,
      orders: inputs.orders,
    }),
  };
}

/** The account-statistics read of a file input, through the production reader. */
function readStatsOf(input: OverviewFileInput): AccountStatsRead {
  return readAccountStats(input);
}

// -----------------------------------------------------------------------------
// 1. The oracle
// -----------------------------------------------------------------------------

describe('the Totals group of the synthetic archive', () => {
  const { tiles } = tilesOf();

  it('reads Credits earned as the exact micro-unit string', () => {
    expect(ready(tiles, 'cred').units).toBe(OV_EXPECTED.money.creditsInFlowMicro);
  });

  it('reads Battles as the sum across the account folders, with the guarded rate', () => {
    const bat = ready(tiles, 'bat');
    expect(bat.battles).toBe(OV_EXPECTED.stats.battles);
    expect(bat.wins).toBe(OV_EXPECTED.stats.wins);
    expect(bat.winRate).toBe(OV_EXPECTED.stats.winRate);
  });

  it('reads Orders as a count', () => {
    expect(ready(tiles, 'ord').count).toBe(OV_EXPECTED.money.orders);
  });
});

// -----------------------------------------------------------------------------
// 2. The two panes agree
// -----------------------------------------------------------------------------

describe('the Credits tile and the Finance pane', () => {
  it('is the Finance builder’s own number for the credits currency', () => {
    const { inputs, tiles } = tilesOf();

    // The comparison is against the BUILDER, computed here over the same
    // groups — not against a literal, so the two panes cannot drift apart.
    const view = buildCurrency(inputs.currency.groups, inputs.currency.seen);
    if (view.status !== 'ready') throw new Error('expected a ready currency view');
    const entry = [...view.charts, ...view.others].find((currency) =>
      (currency.code ?? '').toLowerCase().endsWith('credits'),
    );
    if (entry === undefined) throw new Error('the archive has no credits currency');

    expect(ready(tiles, 'cred').units).toBe(entry.inUnits);
  });

  it('leaves the withdrawal and the other currency out of the in-flow', () => {
    const { tiles } = tilesOf();
    // The archive holds a 3,000,000 withdrawal and a 100 gold deposit; the
    // in-flow is the two deposits and the one income, and nothing else.
    expect(ready(tiles, 'cred').units).toBe(OV_EXPECTED.money.creditsInFlowMicro);
    expect(Number(ready(tiles, 'cred').units)).toBe(OV_EXPECTED.money.creditsInFlow * 1e6);
  });
});

// -----------------------------------------------------------------------------
// 3. The named absences
// -----------------------------------------------------------------------------

describe('the Totals group of a dataset without its sources', () => {
  it('is absent for a currency log with only withdrawals', () => {
    const tiles = buildTotalsTiles({
      stats: statsOf([rowOf({ battles: 100 })], { battles: true }),
      currency: currencyOf([currencyRow('ru.wot.credits', 'withdrawal', '3000000.00')]),
      orders: { groups: [], seen: false },
    });

    const cred = absent(tiles, 'cred');
    expect(cred.need).toBe('currency-operations');
    expect(cred.column).toBeNull();
  });

  it('is absent for a currency log that holds only gold', () => {
    const tiles = buildTotalsTiles({
      stats: statsOf([rowOf({ battles: 100 })], { battles: true }),
      currency: currencyOf([currencyRow('ru.shared_currency.gold', 'deposit', '100.00')]),
      orders: { groups: [], seen: false },
    });

    expect(absent(tiles, 'cred').need).toBe('currency-operations');
  });

  it('is absent for each omit option, with the source it needs', () => {
    const { tiles } = tilesOf({ omit: ['currency'] });
    expect(absent(tiles, 'cred').need).toBe('currency-operations');

    const withoutOrders = tilesOf({ omit: ['orders'] });
    expect(absent(withoutOrders.tiles, 'ord').need).toBe('payment-history');

    const withoutStats = tilesOf({ omit: ['account-statistics'] });
    expect(absent(withoutStats.tiles, 'bat').need).toBe('account-statistics');
  });

  it('keeps Battles ready when only the record columns are dropped', () => {
    const { tiles } = tilesOf({ omit: ['record-columns'] });

    const bat = ready(tiles, 'bat');
    expect(bat.battles).toBe(OV_EXPECTED.stats.battles);
    expect(bat.winRate).toBe(OV_EXPECTED.stats.winRate);
  });
});

// -----------------------------------------------------------------------------
// 4. The small-sample guard
// -----------------------------------------------------------------------------

describe('the win rate guard', () => {
  it('gives no rate below the guard and a rate at it', () => {
    const below = buildTotalsTiles({
      stats: statsOf([rowOf({ battles: MIN_BATTLES_PLAIN_RATE - 1, wins: 10 })], {
        battles: true,
        wins: true,
      }),
      currency: { groups: [], seen: false },
      orders: { groups: [], seen: false },
    });
    expect(ready(below, 'bat').winRate).toBeNull();
    expect(ready(below, 'bat').battles).toBe(MIN_BATTLES_PLAIN_RATE - 1);

    const at = buildTotalsTiles({
      stats: statsOf([rowOf({ battles: MIN_BATTLES_PLAIN_RATE, wins: 15 })], {
        battles: true,
        wins: true,
      }),
      currency: { groups: [], seen: false },
      orders: { groups: [], seen: false },
    });
    expect(ready(at, 'bat').winRate).toBe(0.5);
  });

  it('gives no wins and no rate when the wins column is missing', () => {
    const tiles = buildTotalsTiles({
      stats: statsOf([rowOf({ battles: 1500 })], { battles: true }),
      currency: { groups: [], seen: false },
      orders: { groups: [], seen: false },
    });

    const bat = ready(tiles, 'bat');
    expect(bat.battles).toBe(1500);
    expect(bat.wins).toBeNull();
    expect(bat.winRate).toBeNull();
  });

  it('gives no wins and no rate when every wins cell says "no value"', () => {
    const tiles = buildTotalsTiles({
      stats: statsOf([rowOf({ battles: 1500, wins: null })], { battles: true, wins: true }),
      currency: { groups: [], seen: false },
      orders: { groups: [], seen: false },
    });

    expect(ready(tiles, 'bat').wins).toBeNull();
    expect(ready(tiles, 'bat').winRate).toBeNull();
  });
});

// -----------------------------------------------------------------------------
// 5. Orders read nothing
// -----------------------------------------------------------------------------

describe('the Orders tile', () => {
  it('counts a header-only file as a true zero and an unseen file as absent', () => {
    const headerOnly = buildTotalsTiles({
      stats: statsOf([], {}),
      currency: { groups: [], seen: false },
      orders: { groups: [{ account: 'test-account', rows: [] }], seen: true },
    });
    expect(ready(headerOnly, 'ord').count).toBe(0);

    const unseen = buildTotalsTiles({
      stats: statsOf([], {}),
      currency: { groups: [], seen: false },
      orders: { groups: [], seen: false },
    });
    expect(absent(unseen, 'ord').need).toBe('payment-history');
  });

  it('reads no property of any order row', () => {
    const read: string[] = [];
    const row = new Proxy(
      {
        ACTION_DT: '2020-04-11 12:00:00',
        GAME_CODE: 'WOT',
        PAYED_IN_CURR_AMT: OV_ORDER_AMOUNT_CANARY,
        ORDER_ID: 'order-reference',
      } as Record<string, string>,
      {
        get(target, property) {
          if (typeof property === 'string') read.push(property);
          return Reflect.get(target, property);
        },
      },
    );

    const tiles = buildTotalsTiles({
      stats: statsOf([], {}),
      currency: { groups: [], seen: false },
      orders: { groups: [{ account: 'test-account', rows: [row] }], seen: true },
    });

    expect(ready(tiles, 'ord').count).toBe(1);
    expect(read, 'the tile reads no property of an order row').toEqual([]);
  });

  it('carries none of the planted canaries', () => {
    const { tiles } = tilesOf();

    const json = JSON.stringify(tiles);
    for (const canary of OV_CANARIES) {
      expect(json, `the Totals tiles carry no ${canary}`).not.toContain(canary);
    }
  });
});
