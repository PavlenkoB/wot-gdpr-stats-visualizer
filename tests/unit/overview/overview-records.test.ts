import { describe, expect, it } from 'vitest';

import { readAccountStats } from '../../../src/lib/features/overview/overview-account-stats.ts';
import {
  buildOverviewView,
  type OverviewFileInput,
  type OverviewInputs,
} from '../../../src/lib/features/overview/overview-aggregate.ts';
import { buildRecordTiles } from '../../../src/lib/features/overview/overview-records.ts';
import {
  createVehicleLookup,
  type VehicleTableRow,
} from '../../../src/lib/features/overview/overview-lookup.ts';
import {
  OVERVIEW_TILE_IDS,
  type OverviewReadyTile,
  type OverviewTile,
} from '../../../src/lib/features/overview/overview-shared.ts';
import type { PlaytimeAggregates } from '../../../src/lib/core/types/worker-messages.ts';
import type { AccountRowGroup } from '../../../src/lib/worker/csv-columns.ts';
import {
  OV_CANARIES,
  OV_IDS,
  OV_NAME_CANARY,
  OV_ROOT_A,
  OV_ROOT_B,
  OV_SYNTHETIC_TABLE,
  OV_TAGS,
} from '../../fixtures/overview-fixtures.ts';

// =============================================================================
// The Records group (13-07 Task 3, D-04, D-09, D-19, T-13-21)
// =============================================================================
//
// WHAT THIS PINS
//   - a record is the MAXIMUM across the accounts, never the sum: the damage
//     record is 6,100 from the second account, and 11,300 — the sum — is
//     demonstrably not what the tile says (D-19);
//   - the record's tank is the one the account HOLDING the maximum names, and
//     a tie keeps the earlier account;
//   - a tank id the table does not carry, and the export's own `0`, both read
//     "vehicle not recorded" (D-09);
//   - a zero is a real record and is shown as 0; an absent one names the
//     source, and a COLUMN-level absence names the column;
//   - the whole answer carries none of the archive's planted canaries.
//
// Every figure is the fixture archive's own; every tank id is invented.
// =============================================================================

/** The synthetic table of three rows, in the application's tuple shape. */
const TABLE: readonly VehicleTableRow[] = OV_SYNTHETIC_TABLE.map(
  (row) => [row[0], row[1], row[2], row[3], row[4]] as VehicleTableRow,
);

const lookup = createVehicleLookup(TABLE);

// -----------------------------------------------------------------------------
// The archive
// -----------------------------------------------------------------------------

/** The oracle's account A row. */
const ROW_A = {
  NAME: OV_NAME_CANARY,
  BATTLES_COUNT: '1200',
  WINS_COUNT: '660',
  BATTLE_LIFE_TIME: '864000',
  DAMAGE_MAX: '5200',
  XP_MAX: '2100',
  FRAGS_MAX: '7',
  MAX_DAMAGE_VEHICLE: OV_IDS.one,
  MAX_XP_VEHICLE: OV_IDS.two,
  MAX_FRAGS_VEHICLE: OV_IDS.one,
  SNIPER_SERIES_MAX: '9',
} as const;

/**
 * The oracle's account B row.
 *
 * Its damage record (6,100) beats account A's (5,200) and it names a third
 * tank; its XP record (1,900) loses to account A's (2,100); its frags record
 * is 8 with the export's `0` as the tank id; and its series is `\N`.
 */
const ROW_B = {
  NAME: OV_NAME_CANARY,
  GAMES_PLAYED: '300',
  WINS_COUNT: '120',
  BATTLE_LIFE_TIME: '259200',
  DAMAGE_MAX: '6100',
  XP_MAX: '1900',
  FRAGS_MAX: '8',
  MAX_DAMAGE_VEHICLE: OV_IDS.three,
  MAX_XP_VEHICLE: OV_IDS.four,
  MAX_FRAGS_VEHICLE: '0',
  SNIPER_SERIES_MAX: '\\N',
} as const;

/** The two account groups, in the archive's order. */
function groups(): AccountRowGroup[] {
  return [
    { account: OV_ROOT_A, rows: [ROW_A] },
    { account: OV_ROOT_B, rows: [ROW_B] },
  ];
}

/** The account-statistics file input for the two accounts. */
function input(seen = true, rows = groups()): OverviewFileInput {
  return { groups: rows, seen };
}

/** The READY tile of a built set, by id. */
function readyOf(tiles: OverviewTile[], id: string): Extract<OverviewReadyTile, { id: 'dmg' }> {
  const found = tiles.find((tile) => tile.id === id);
  if (found === undefined) throw new Error(`no tile ${id}`);
  if (found.status !== 'ok') throw new Error(`expected a ready ${id} tile`);
  return found as Extract<OverviewReadyTile, { id: 'dmg' }>;
}

/** The absent tile of a built set, by id. */
function absentOf(tiles: OverviewTile[], id: string): Extract<OverviewTile, { status: 'absent' }> {
  const found = tiles.find((tile) => tile.id === id);
  if (found === undefined) throw new Error(`no tile ${id}`);
  if (found.status !== 'absent') throw new Error(`expected an absent ${id} tile`);
  return found;
}

// -----------------------------------------------------------------------------
// The records
// -----------------------------------------------------------------------------

describe('buildRecordTiles: the maximum across the accounts (D-19)', () => {
  const tiles = buildRecordTiles(readAccountStats(input()), lookup);

  it('answers the four tiles in catalogue order', () => {
    expect(tiles.map((tile) => tile.id)).toEqual(['dmg', 'xp', 'kills', 'snip']);
  });

  it('takes the damage record from the account that holds the maximum', () => {
    expect(readyOf(tiles, 'dmg')).toMatchObject({
      status: 'ok',
      value: 6100,
      tankName: 'Synth Three',
    });
  });

  it("does not SUM the two accounts' damage records", () => {
    // 5,200 + 6,100 would be a figure no single battle ever reached.
    expect(readyOf(tiles, 'dmg').value).not.toBe(11300);
  });

  it('takes the XP record from the account that holds the maximum', () => {
    expect(readyOf(tiles, 'xp')).toMatchObject({
      status: 'ok',
      value: 2100,
      tankName: 'Synth Two',
    });
  });

  it('reads the kills record, whose tank the export did not record', () => {
    // The account that holds the maximum (8) names the id `0`, which is the
    // export's "not recorded" spelling.
    expect(readyOf(tiles, 'kills')).toMatchObject({ status: 'ok', value: 8, tankName: null });
  });

  it('takes the series from the account that has one', () => {
    // Account B's series is `\N`; account A's 9 is the record.
    expect(readyOf(tiles, 'snip')).toMatchObject({ status: 'ok', value: 9 });
  });

  it('keeps the earlier account when two hold the same figure', () => {
    const tied: AccountRowGroup[] = [
      {
        account: OV_ROOT_A,
        rows: [{ ...ROW_A, DAMAGE_MAX: '5000', MAX_DAMAGE_VEHICLE: OV_IDS.one }],
      },
      {
        account: OV_ROOT_B,
        rows: [{ ...ROW_B, DAMAGE_MAX: '5000', MAX_DAMAGE_VEHICLE: OV_IDS.three }],
      },
    ];
    const tiedTiles = buildRecordTiles(readAccountStats(input(true, tied)), lookup);
    expect(readyOf(tiedTiles, 'dmg')).toMatchObject({ value: 5000, tankName: 'Synth One' });
  });

  it('reads a tank the table does not carry as no tank at all', () => {
    const onlyB: AccountRowGroup[] = [{ account: OV_ROOT_B, rows: [ROW_B] }];
    const tilesB = buildRecordTiles(readAccountStats(input(true, onlyB)), lookup);
    // Account B's XP record names tank 990004, which the table lacks.
    expect(readyOf(tilesB, 'xp')).toMatchObject({ value: 1900, tankName: null });
  });

  it('works for a single-account dataset', () => {
    const onlyA: AccountRowGroup[] = [{ account: OV_ROOT_A, rows: [ROW_A] }];
    const tilesA = buildRecordTiles(readAccountStats(input(true, onlyA)), lookup);
    expect(readyOf(tilesA, 'dmg')).toMatchObject({ value: 5200, tankName: 'Synth One' });
    expect(readyOf(tilesA, 'xp')).toMatchObject({ value: 2100, tankName: 'Synth Two' });
    expect(readyOf(tilesA, 'kills')).toMatchObject({ value: 7, tankName: 'Synth One' });
    expect(readyOf(tilesA, 'snip')).toMatchObject({ value: 9 });
  });

  it('shows a zero as a real record', () => {
    const scoreless: AccountRowGroup[] = [
      {
        account: OV_ROOT_A,
        rows: [{ ...ROW_A, FRAGS_MAX: '0', MAX_FRAGS_VEHICLE: '\\N' }],
      },
    ];
    const tilesZero = buildRecordTiles(readAccountStats(input(true, scoreless)), lookup);
    expect(readyOf(tilesZero, 'kills')).toMatchObject({ status: 'ok', value: 0, tankName: null });
  });
});

describe('buildRecordTiles: how many accounts a record was chosen from (WR-04)', () => {
  it('counts both accounts when both carry a figure', () => {
    const tiles = buildRecordTiles(readAccountStats(input()), lookup);
    expect(readyOf(tiles, 'dmg').accounts).toBe(2);
    expect(readyOf(tiles, 'xp').accounts).toBe(2);
    expect(readyOf(tiles, 'kills').accounts).toBe(2);
  });

  it('counts one account when the record is held by one of two and the other has no value', () => {
    // Account B's damage cell says "no value": only account A was compared.
    const oneValue: AccountRowGroup[] = [
      { account: OV_ROOT_A, rows: [ROW_A] },
      { account: OV_ROOT_B, rows: [{ ...ROW_B, DAMAGE_MAX: '\\N' }] },
    ];
    const tiles = buildRecordTiles(readAccountStats(input(true, oneValue)), lookup);
    expect(readyOf(tiles, 'dmg')).toMatchObject({ value: 5200, accounts: 1 });
    // The other two records still had a figure in both accounts.
    expect(readyOf(tiles, 'xp').accounts).toBe(2);
  });

  it('does not count an account folder that has no account statistics', () => {
    // The dataset has two account folders, but only account A has a
    // statistics file, so a "best of 2 accounts" claim would describe a
    // comparison that never happened. The view still says two accounts.
    const oneFolder: OverviewInputs = {
      ...inputs(),
      accountStats: input(true, [{ account: OV_ROOT_A, rows: [ROW_A] }]),
    };
    const view = buildOverviewView(oneFolder, lookup);
    expect(view.accountCount).toBe(2);
    expect(readyOf(view.tiles, 'dmg')).toMatchObject({ value: 5200, accounts: 1 });
    expect(readyOf(view.tiles, 'xp').accounts).toBe(1);
    expect(readyOf(view.tiles, 'kills').accounts).toBe(1);
  });
});

describe('buildRecordTiles: the absent states', () => {
  it('is absent with no column when the file was not in the export', () => {
    const tiles = buildRecordTiles(readAccountStats(input(false)), lookup);
    for (const tile of tiles) {
      expect(tile.status, tile.id).toBe('absent');
      const absent = absentOf(tiles, tile.id);
      expect(absent.need, tile.id).toBe('account-statistics');
      expect(absent.column, tile.id).toBeNull();
    }
  });

  it('names the missing column when the file carries no record column', () => {
    // A battles-only file: the counts resolve, the records do not.
    const battlesOnly: AccountRowGroup[] = [
      {
        account: OV_ROOT_A,
        rows: [
          {
            NAME: OV_NAME_CANARY,
            BATTLES_COUNT: '1200',
            WINS_COUNT: '660',
            BATTLE_LIFE_TIME: '864000',
          },
        ],
      },
    ];
    const read = readAccountStats(input(true, battlesOnly));
    // The file is present and readable; only the record columns are missing.
    expect(read.present).toBe(true);
    expect(read.columns.battles).toBe(true);
    expect(read.columns.damageMax).toBe(false);

    const tiles = buildRecordTiles(read, lookup);
    expect(absentOf(tiles, 'dmg')).toMatchObject({
      need: 'account-statistics',
      column: 'DAMAGE_MAX',
    });
    expect(absentOf(tiles, 'xp')).toMatchObject({ column: 'XP_MAX' });
    expect(absentOf(tiles, 'kills')).toMatchObject({ column: 'FRAGS_MAX' });
    expect(absentOf(tiles, 'snip')).toMatchObject({ column: 'SNIPER_SERIES_MAX' });
  });

  it('is absent when the column is there but every account says no value', () => {
    const noValues: AccountRowGroup[] = [
      {
        account: OV_ROOT_A,
        rows: [{ ...ROW_A, DAMAGE_MAX: '\\N', MAX_DAMAGE_VEHICLE: '\\N' }],
      },
      {
        account: OV_ROOT_B,
        rows: [{ ...ROW_B, DAMAGE_MAX: '\\N', MAX_DAMAGE_VEHICLE: '\\N' }],
      },
    ];
    const tiles = buildRecordTiles(readAccountStats(input(true, noValues)), lookup);
    // The column IS in the export, so the tile names no missing column.
    expect(absentOf(tiles, 'dmg')).toMatchObject({ need: 'account-statistics', column: null });
    // The other records still read.
    expect(readyOf(tiles, 'xp')).toMatchObject({ value: 2100 });
  });
});

describe('the records carry no planted value', () => {
  it("serialises to JSON without any of the archive's canaries", () => {
    const tiles = buildRecordTiles(readAccountStats(input()), lookup);
    const text = JSON.stringify(tiles);
    expect(() => JSON.parse(text)).not.toThrow();
    for (const canary of OV_CANARIES) {
      expect(text, canary).not.toContain(canary);
    }
  });
});

// -----------------------------------------------------------------------------
// The aggregate
// -----------------------------------------------------------------------------

/** The vehicle-statistics rows of the archive, root A first. */
const VEHICLE_ROWS_A = [
  { VEHICLE_NAME: OV_TAGS.one, BATTLES_COUNT: '700', BATTLE_LIFE_TIME_SEC: '600000' },
  { VEHICLE_NAME: OV_TAGS.two, BATTLES_COUNT: '350', BATTLE_LIFE_TIME_SEC: '220000' },
  { VEHICLE_NAME: OV_TAGS.three, BATTLES_COUNT: '150', BATTLE_LIFE_TIME_SEC: '44000' },
  { VEHICLE_NAME: OV_TAGS.garage, BATTLES_COUNT: '0', BATTLE_LIFE_TIME_SEC: '0' },
];

const VEHICLE_ROWS_B = [
  { VEHICLE_NAME: OV_TAGS.one, GAMES_PLAYED: '200', BATTLE_LIFE_TIME_SEC: '200000' },
  { VEHICLE_NAME: OV_TAGS.two, GAMES_PLAYED: '60', BATTLE_LIFE_TIME_SEC: '40000' },
  { VEHICLE_NAME: OV_TAGS.four, GAMES_PLAYED: '40', BATTLE_LIFE_TIME_SEC: '19200' },
];

/**
 * A minimal playtime aggregate: two days, one session's worth of seconds.
 *
 * It exists so the aggregate-level test can say that the Logged in tile is
 * UNCHANGED by this plan — the tile was real before and is real now, with the
 * same figures.
 */
function playtime(): PlaytimeAggregates {
  const slice = {
    seconds: 7200,
    sessions: 2,
    excluded: 0,
    dayIndex: [18322, 18323],
    daySeconds: [3600, 3600],
    daySessions: [1, 1],
    hourOverlap: new Array<number>(168).fill(0),
    hourStart: new Array<number>(168).fill(0),
    bins: new Array<number>(12).fill(0),
  };
  return {
    v: 1,
    sessionsFileSeen: true,
    splitColumn: null,
    values: [],
    all: slice,
    byValue: [],
  };
}

/** The Overview's inputs, built from the archive's rows. */
function inputs(play: PlaytimeAggregates | null = null): OverviewInputs {
  return {
    playtime: play,
    accountCount: 2,
    accountStats: input(),
    vehicleStats: {
      seen: true,
      groups: [
        { account: OV_ROOT_A, rows: VEHICLE_ROWS_A },
        { account: OV_ROOT_B, rows: VEHICLE_ROWS_B },
      ],
    },
    currency: { seen: false, groups: [] },
    orders: { seen: false, groups: [] },
  };
}

describe('buildOverviewView: the Tanks and Records groups are live', () => {
  const view = buildOverviewView(inputs(), lookup);

  it('answers sixteen tiles in catalogue order', () => {
    expect(view.tiles).toHaveLength(16);
    expect(view.tiles.map((tile) => tile.id)).toEqual([...OVERVIEW_TILE_IDS]);
  });

  it('carries the Tanks tiles the oracle states', () => {
    expect(readyOf(view.tiles, 'tank')).toMatchObject({
      name: 'Synth One',
      battles: 900,
      share: 0.6,
      classKey: 'heavyTank',
      tier: 8,
    });
    expect(readyOf(view.tiles, 'fleet')).toMatchObject({ count: 4 });
    expect(readyOf(view.tiles, 'nat')).toMatchObject({ nation: 'china', share: 0.6 });
    const cls = readyOf(view.tiles, 'cls');
    expect(cls).toMatchObject({ classKey: 'heavyTank', share: 0.6, coverage: 1460 / 1500 });
  });

  it('carries the Records tiles the oracle states', () => {
    expect(readyOf(view.tiles, 'dmg')).toMatchObject({ value: 6100, tankName: 'Synth Three' });
    expect(readyOf(view.tiles, 'xp')).toMatchObject({ value: 2100, tankName: 'Synth Two' });
    expect(readyOf(view.tiles, 'kills')).toMatchObject({ value: 8, tankName: null });
    expect(readyOf(view.tiles, 'snip')).toMatchObject({ value: 9 });
  });

  it('leaves the tiles no plan has built yet absent', () => {
    // 13-08 built the Time group and the Totals group, so what is still
    // absent here is what no plan builds yet: the four habits (this export
    // carries no session history) and the two Totals tiles whose sources are
    // missing. The Battles tile is READY — 13-08 builds it, and the account
    // statistics are right here.
    for (const id of ['hour', 'streak', 'sess', 'busy', 'cred', 'ord']) {
      expect(absentOf(view.tiles, id).need, id).toBeTruthy();
    }
    expect(readyOf(view.tiles, 'bat')).toMatchObject({ battles: 1500, wins: 780 });
  });

  it('leaves the Logged in tile as it was', () => {
    // With no session history the tile is absent, exactly as plan 13-01 left
    // it.
    expect(absentOf(view.tiles, 'logged').need).toBe('session-history');
    expect(view.firstDay).toBeNull();
    expect(view.lastDay).toBeNull();
  });

  it('keeps the Logged in tile real when there is session history', () => {
    const withTime = buildOverviewView(inputs(playtime()), lookup);
    const logged = withTime.tiles.find((tile) => tile.id === 'logged');
    if (logged === undefined || logged.status !== 'ok' || logged.id !== 'logged') {
      throw new Error('expected a ready logged tile');
    }
    expect(logged.seconds).toBe(7200);
    expect(logged.firstDay).toBe(18322);
    expect(logged.lastDay).toBe(18323);
    expect(withTime.firstDay).toBe(18322);
  });

  it('answers the same view for the same inputs', () => {
    const first = buildOverviewView(inputs(), lookup);
    const second = buildOverviewView(inputs(), lookup);
    expect(second).toEqual(first);
  });
});
