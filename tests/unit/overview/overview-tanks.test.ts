import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildTankTiles,
  sumVehicleBattleSeconds,
} from '../../../src/lib/features/overview/overview-tanks.ts';
import {
  createVehicleLookup,
  type VehicleTableRow,
} from '../../../src/lib/features/overview/overview-lookup.ts';
import type { OverviewFileInput } from '../../../src/lib/features/overview/overview-aggregate.ts';
import type {
  OverviewReadyTile,
  OverviewTile,
} from '../../../src/lib/features/overview/overview-shared.ts';
import type { AccountRowGroup } from '../../../src/lib/worker/csv-columns.ts';
import {
  OV_ROOT_A,
  OV_ROOT_B,
  OV_SYNTHETIC_TABLE,
  OV_TAGS,
} from '../../fixtures/overview-fixtures.ts';

// =============================================================================
// The Tanks group (13-07 Task 2, D-04, D-09, D-17, T-13-20, T-13-22)
// =============================================================================
//
// WHAT THIS PINS
//   - the four tiles reproduce the hand-derived oracle: 900 of 1,500 battles
//     for the most-played tank (a share of 0.6), a fleet of 4, China at 0.6,
//     a class split of 900/410/150/40 with a coverage of 1,460 of 1,500 and
//     the heavy tank the favourite;
//   - the SAME rows against an EMPTY table give the tag-derived names, an
//     unknown class everywhere and NO class tile at all — the second world,
//     reachable without touching the committed table (D-09);
//   - the garage-only row is not a tank that was played: it is in neither the
//     fleet nor the class split nor the top five (RESEARCH Pitfall 8);
//   - account B spells its battle count `GAMES_PLAYED` and its rows still sum
//     into the same tanks (CR-01, T-13-20);
//   - a name of `__proto__` or `constructor` is an ordinary name (T-13-22).
//
// Every figure is the fixture archive's own, and every tank tag is invented.
// =============================================================================

/** The synthetic table of three rows, in the application's tuple shape. */
const TABLE: readonly VehicleTableRow[] = OV_SYNTHETIC_TABLE.map(
  (row) => [row[0], row[1], row[2], row[3], row[4]] as VehicleTableRow,
);

/** The lookup over the synthetic table, and the empty one. */
const lookup = createVehicleLookup(TABLE);
const emptyLookup = createVehicleLookup([]);

/**
 * Root A's vehicle rows.
 *
 * The last row is the garage-only tank: no battles at all. It is the row an
 * aggregator must EXCLUDE from the fleet, the class split and the coverage
 * figure.
 */
const ROWS_A = [
  { VEHICLE_NAME: OV_TAGS.one, BATTLES_COUNT: '700', BATTLE_LIFE_TIME_SEC: '600000' },
  { VEHICLE_NAME: OV_TAGS.two, BATTLES_COUNT: '350', BATTLE_LIFE_TIME_SEC: '220000' },
  { VEHICLE_NAME: OV_TAGS.three, BATTLES_COUNT: '150', BATTLE_LIFE_TIME_SEC: '44000' },
  { VEHICLE_NAME: OV_TAGS.garage, BATTLES_COUNT: '0', BATTLE_LIFE_TIME_SEC: '0' },
];

/**
 * Root B's vehicle rows.
 *
 * The battle count is spelled `GAMES_PLAYED` here — the whole point of the
 * two-account archive — and the first tank is root A's first tank, so a
 * per-account reading that forgot to group would report two tanks.
 */
const ROWS_B = [
  { VEHICLE_NAME: OV_TAGS.one, GAMES_PLAYED: '200', BATTLE_LIFE_TIME_SEC: '200000' },
  { VEHICLE_NAME: OV_TAGS.two, GAMES_PLAYED: '60', BATTLE_LIFE_TIME_SEC: '40000' },
  { VEHICLE_NAME: OV_TAGS.four, GAMES_PLAYED: '40', BATTLE_LIFE_TIME_SEC: '19200' },
];

/** The two account groups, in the archive's order. */
function groups(): AccountRowGroup[] {
  return [
    { account: OV_ROOT_A, rows: ROWS_A },
    { account: OV_ROOT_B, rows: ROWS_B },
  ];
}

/** The file input for the two accounts. */
function input(seen = true, rows = groups()): OverviewFileInput {
  return { groups: rows, seen };
}

/** One tile of a built set, by id. */
function tileOf(tiles: OverviewTile[], id: string): OverviewTile {
  const found = tiles.find((tile) => tile.id === id);
  if (!found) throw new Error(`no tile ${id}`);
  return found;
}

/** The READY most-played-tank tile of a built set. */
function tankOf(tiles: OverviewTile[]): Extract<OverviewReadyTile, { id: 'tank' }> {
  const found = tiles.find((tile) => tile.id === 'tank');
  if (found === undefined) throw new Error('no tank tile');
  if (found.status !== 'ok') throw new Error('expected a ready tank tile');
  if (found.id !== 'tank') throw new Error('expected the tank tile');
  return found;
}

/** The READY class tile of a built set. */
function clsOf(tiles: OverviewTile[]): Extract<OverviewReadyTile, { id: 'cls' }> {
  const found = tiles.find((tile) => tile.id === 'cls');
  if (found === undefined) throw new Error('no class tile');
  if (found.status !== 'ok') throw new Error('expected a ready class tile');
  if (found.id !== 'cls') throw new Error('expected the class tile');
  return found;
}

describe('buildTankTiles: the oracle archive, with the synthetic table', () => {
  const tiles = buildTankTiles(input(), lookup);

  it('answers the four tiles in catalogue order', () => {
    expect(tiles.map((tile) => tile.id)).toEqual(['tank', 'cls', 'fleet', 'nat']);
  });

  it('names the most-played tank and gives it its share', () => {
    const tank = tankOf(tiles);
    expect(tank).toMatchObject({
      status: 'ok',
      name: 'Synth One',
      battles: 900,
      share: 0.6,
      classKey: 'heavyTank',
      tier: 8,
    });
  });

  it('lists the top five, most played first', () => {
    const tank = tankOf(tiles);
    expect(tank.top).toEqual([
      { name: 'Synth One', classKey: 'heavyTank', battles: 900 },
      { name: 'Synth Two', classKey: 'mediumTank', battles: 410 },
      { name: 'Synth Three', classKey: 'AT-SPG', battles: 150 },
      { name: 'SynthFour', classKey: 'unknown', battles: 40 },
    ]);
  });

  it('counts the fleet without the garage-only tank', () => {
    expect(tileOf(tiles, 'fleet')).toMatchObject({ status: 'ok', count: 4 });
  });

  it('names the favourite nation and its share', () => {
    expect(tileOf(tiles, 'nat')).toMatchObject({ status: 'ok', nation: 'china', share: 0.6 });
  });

  it('splits the classes and states the coverage', () => {
    const cls = clsOf(tiles);
    expect(cls).toMatchObject({
      status: 'ok',
      classKey: 'heavyTank',
      share: 0.6,
      coverage: 1460 / 1500,
    });
    expect(cls.rows).toEqual([
      { classKey: 'heavyTank', battles: 900 },
      { classKey: 'mediumTank', battles: 410 },
      { classKey: 'AT-SPG', battles: 150 },
      { classKey: 'unknown', battles: 40 },
    ]);
  });
});

describe('buildTankTiles: the same archive against an EMPTY table (D-09)', () => {
  const tiles = buildTankTiles(input(), emptyLookup);

  it('keeps the tag-derived names', () => {
    const tank = tankOf(tiles);
    expect(tank).toMatchObject({
      status: 'ok',
      name: 'SynthOne',
      battles: 900,
      share: 0.6,
      classKey: 'unknown',
      tier: null,
    });
    expect(tank.top.map((entry) => entry.name)).toEqual([
      'SynthOne',
      'SynthTwo',
      'SynthThree',
      'SynthFour',
    ]);
  });

  it('has no class tile, because no battle resolves a class', () => {
    const cls = tileOf(tiles, 'cls');
    expect(cls.status).toBe('absent');
    if (cls.status !== 'absent') throw new Error('expected an absent tile');
    expect(cls.need).toBe('vehicle-statistics');
    expect(cls.column).toBeNull();
  });

  it('still holds the fleet and the nation', () => {
    expect(tileOf(tiles, 'fleet')).toMatchObject({ status: 'ok', count: 4 });
    expect(tileOf(tiles, 'nat')).toMatchObject({ status: 'ok', nation: 'china', share: 0.6 });
  });
});

describe('buildTankTiles: the garage-only row is not a tank that was played', () => {
  const tiles = buildTankTiles(input(), lookup);

  it('keeps it out of the top list', () => {
    const tank = tankOf(tiles);
    expect(tank.top.map((entry) => entry.name)).not.toContain('SynthGarage');
  });

  it('keeps it out of the fleet', () => {
    // Four tanks have battles; the fifth row has none.
    expect(tileOf(tiles, 'fleet')).toMatchObject({ count: 4 });
  });
});

describe('buildTankTiles: the two accounts are read through their own keys', () => {
  it("sums account B's GAMES_PLAYED into the same tank", () => {
    const tiles = buildTankTiles(input(), lookup);
    // 700 + 200 for the first tank: one tank, not two.
    expect(tileOf(tiles, 'tank')).toMatchObject({ name: 'Synth One', battles: 900 });
    expect(tileOf(tiles, 'fleet')).toMatchObject({ count: 4 });
  });
});

describe('buildTankTiles: the ordering rules', () => {
  it('breaks a tie by name, in plain code-unit order', () => {
    const rows = [
      { VEHICLE_NAME: 'synth:Bravo', BATTLES_COUNT: '10' },
      { VEHICLE_NAME: 'synth:Alpha', BATTLES_COUNT: '10' },
    ];
    const tiles = buildTankTiles(input(true, [{ account: OV_ROOT_A, rows }]), lookup);
    const tank = tankOf(tiles);
    expect(tank.name).toBe('Alpha');
    expect(tank.top.map((entry) => entry.name)).toEqual(['Alpha', 'Bravo']);
  });

  it('cuts the top list at five', () => {
    const rows = [1, 2, 3, 4, 5, 6, 7].map((n) => ({
      VEHICLE_NAME: `synth:Tank${n}`,
      BATTLES_COUNT: String(n),
    }));
    const tiles = buildTankTiles(input(true, [{ account: OV_ROOT_A, rows }]), lookup);
    const tank = tankOf(tiles);
    expect(tank.top).toHaveLength(5);
    expect(tank.top[0]?.name).toBe('Tank7');
    expect(tank.top[4]?.name).toBe('Tank3');
  });
});

describe('buildTankTiles: hostile names are ordinary names (T-13-22)', () => {
  it.each(['__proto__', 'constructor'])('sums a tank named %s like any other', (name) => {
    const rows = [{ VEHICLE_NAME: name, BATTLES_COUNT: '12' }];
    const tiles = buildTankTiles(input(true, [{ account: OV_ROOT_A, rows }]), lookup);
    expect(tileOf(tiles, 'tank')).toMatchObject({ status: 'ok', name, battles: 12, share: 1 });
    expect(tileOf(tiles, 'fleet')).toMatchObject({ count: 1 });
  });
});

describe('buildTankTiles: the edges of the data', () => {
  it('counts a name with no nation in the total but names no nation', () => {
    const rows = [
      { VEHICLE_NAME: 'NoColonTank', BATTLES_COUNT: '10' },
      { VEHICLE_NAME: OV_TAGS.one, BATTLES_COUNT: '10' },
    ];
    const tiles = buildTankTiles(input(true, [{ account: OV_ROOT_A, rows }]), lookup);
    // The total is 20, so the leader holds a share of one half.
    expect(tileOf(tiles, 'tank')).toMatchObject({ share: 0.5 });
    // The nation tally only counts the prefixed key.
    expect(tileOf(tiles, 'nat')).toMatchObject({ status: 'ok', nation: 'china', share: 0.5 });
  });

  it('has no nation tile when no name carries a prefix', () => {
    const rows = [{ VEHICLE_NAME: 'NoColonTank', BATTLES_COUNT: '10' }];
    const tiles = buildTankTiles(input(true, [{ account: OV_ROOT_A, rows }]), lookup);
    const nat = tileOf(tiles, 'nat');
    expect(nat.status).toBe('absent');
    if (nat.status !== 'absent') throw new Error('expected an absent tile');
    expect(nat.need).toBe('vehicle-statistics');
  });

  it('skips a blank name', () => {
    const rows = [
      { VEHICLE_NAME: '   ', BATTLES_COUNT: '10' },
      { VEHICLE_NAME: OV_TAGS.one, BATTLES_COUNT: '10' },
    ];
    const tiles = buildTankTiles(input(true, [{ account: OV_ROOT_A, rows }]), lookup);
    expect(tileOf(tiles, 'fleet')).toMatchObject({ count: 1 });
  });

  it('skips a row whose battle count is not a number', () => {
    const rows = [
      { VEHICLE_NAME: OV_TAGS.one, BATTLES_COUNT: 'N/A' },
      { VEHICLE_NAME: OV_TAGS.two, BATTLES_COUNT: '10' },
    ];
    const tiles = buildTankTiles(input(true, [{ account: OV_ROOT_A, rows }]), lookup);
    expect(tileOf(tiles, 'fleet')).toMatchObject({ count: 1 });
    expect(tileOf(tiles, 'tank')).toMatchObject({ name: 'Synth Two', battles: 10, share: 1 });
  });

  it('skips a row whose battle count is zero', () => {
    const rows = [
      { VEHICLE_NAME: OV_TAGS.one, BATTLES_COUNT: '0' },
      { VEHICLE_NAME: OV_TAGS.two, BATTLES_COUNT: '10' },
    ];
    const tiles = buildTankTiles(input(true, [{ account: OV_ROOT_A, rows }]), lookup);
    expect(tileOf(tiles, 'fleet')).toMatchObject({ count: 1 });
  });
});

describe('buildTankTiles: the absent states', () => {
  it('is absent with no column when the file was not in the export', () => {
    const tiles = buildTankTiles(input(false), lookup);
    for (const tile of tiles) {
      expect(tile.status, tile.id).toBe('absent');
      if (tile.status !== 'absent') throw new Error('expected an absent tile');
      expect(tile.need, tile.id).toBe('vehicle-statistics');
      expect(tile.column, tile.id).toBeNull();
    }
  });

  it('is absent with no column when the file holds a header but no row', () => {
    const tiles = buildTankTiles(input(true, [{ account: OV_ROOT_A, rows: [] }]), lookup);
    expect(tiles.every((tile) => tile.status === 'absent')).toBe(true);
    expect(tileOf(tiles, 'tank')).toMatchObject({ status: 'absent', column: null });
  });

  it('names the battle-count column when no account resolved it', () => {
    const rows = [{ VEHICLE_NAME: OV_TAGS.one, WINS_COUNT: '3' }];
    const tiles = buildTankTiles(input(true, [{ account: OV_ROOT_A, rows }]), lookup);
    for (const tile of tiles) {
      expect(tile.status, tile.id).toBe('absent');
      if (tile.status !== 'absent') throw new Error('expected an absent tile');
      expect(tile.need, tile.id).toBe('vehicle-statistics');
      expect(tile.column, tile.id).toBe('BATTLES_COUNT');
    }
  });

  it('is absent with no column when the file names no battle at all', () => {
    const rows = [
      { VEHICLE_NAME: OV_TAGS.one, BATTLES_COUNT: '0' },
      { VEHICLE_NAME: OV_TAGS.two, BATTLES_COUNT: '0' },
    ];
    const tiles = buildTankTiles(input(true, [{ account: OV_ROOT_A, rows }]), lookup);
    expect(tileOf(tiles, 'tank')).toMatchObject({ status: 'absent', column: null });
  });
});

describe('sumVehicleBattleSeconds: the per-vehicle battle time', () => {
  it('sums the column over both accounts', () => {
    // 864,000 + 259,200 = 1,123,200 s, which is exactly thirteen days.
    expect(sumVehicleBattleSeconds(input())).toBe(1123200);
  });

  it('is null when no account carries the column', () => {
    const rows = [{ VEHICLE_NAME: OV_TAGS.one, BATTLES_COUNT: '10' }];
    expect(sumVehicleBattleSeconds(input(true, [{ account: OV_ROOT_A, rows }]))).toBeNull();
  });

  it('is null when the file holds no row', () => {
    expect(sumVehicleBattleSeconds(input(true, [{ account: OV_ROOT_A, rows: [] }]))).toBeNull();
  });
});

describe('the output is plain data', () => {
  it('serialises to JSON and carries no markup of its own', () => {
    const tiles = buildTankTiles(input(), lookup);
    const text = JSON.stringify(tiles);
    expect(() => JSON.parse(text)).not.toThrow();
    expect(text).not.toContain('<');
    expect(text).not.toContain('>');
  });
});

describe('the module never reaches the tank table', () => {
  it('imports no table module and no persistence layer', () => {
    const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
    const source = readFileSync(
      path.join(repoRoot, 'src/lib/features/overview/overview-tanks.ts'),
      'utf8',
    );
    const imports = source
      .split('\n')
      .filter((line) => line.startsWith('import'))
      .map((line) => line.match(/from\s+'([^']+)'/)?.[1] ?? '');
    expect(imports.some((specifier) => specifier.includes('vehicle-table'))).toBe(false);
    expect(imports.some((specifier) => specifier.includes('worker/db'))).toBe(false);
  });
});
