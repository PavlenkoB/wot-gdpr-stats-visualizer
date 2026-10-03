// =============================================================================
// The Player_statistics fixture module (phase 05, plan 05-02, Task 1 — the
// tracer).
//
// WHY THIS FILE EXISTS
// D-04 replaces four invented `WOT_stats.csv`-style fixtures with the real
// file names and the real column names the 2021 export evidence recorded. Every
// vehicle dashboard of plans 05-05 (the builder), 05-07 (the worker round
// trip), 05-12 (the windowed table) and 05-16 (the scale spec) will read these
// rows, so the rows themselves have to be verified before any of them exists.
//
// This describe proves the three facts the whole vehicle side rests on:
//
//   1. `WOT_MAIN_HEADER` is the export's own sixteen-column header, verbatim and
//      in the export's order. Every WoT cell in the app is read by one of these
//      names, and a header list is exactly the kind of string array that rots
//      unnoticed — 05-01 already lost one commit to a mis-transcribed header.
//   2. The physical format survives: the header line is bare, every data cell is
//      double-quoted with embedded quotes doubled, lines end in a BARE CR and
//      the last line's terminator is present too.
//   3. The PRODUCTION parser `parseCsvFile` reads it back to six header-keyed
//      rows, and every vehicle id comes back BYTE FOR BYTE — including the two
//      hostile ones (`china:Ch99_<b>bold_markup` and `__proto__`). An id that
//      came back normalised, trimmed or coerced is the bug plans 05-05 and
//      05-12 have to be able to catch, so the fixture has to carry them.
//
// The fixture symbols arrive through a NAMESPACE import on purpose: a symbol
// that does not exist yet then fails ONE test with a clear message instead of
// crashing the whole file at module resolution, which is what makes a RED run
// readable.
//
// Decisions: D-04 (real-shaped Player_statistics fixtures), D-06/D-07 (the file
// set the builder reads), D-09/D-11 (special values and the nation-prefixed id
// split), D-12 (zero-battle vehicles are rows too).
// =============================================================================

import { describe, expect, it } from 'vitest';
import * as fixtures from '../../fixtures/player-stats-fixtures.ts';
import {
  oracleBattleTypeCodes,
  oracleDefaultOrder,
  oracleRatio,
  type OracleRatioValue,
  type OracleSpecial,
  type OracleVehicleRow,
} from '../../helpers/vehicle-oracle.ts';
import { parseCsvFile } from '../../../src/lib/worker/csv-parse.ts';

/**
 * The six WoT vehicle ids, by literal, in the order the fixture writes them.
 *
 * Spelled out here instead of imported so the tracer fails on the WRITER's
 * mistake and not on a shared constant that drifted with it. The fifth id is the
 * hostile one: `china:Ch99_` plus the unterminated `<b>` opener plus
 * `bold_markup` — the same probe `LONG_UNKNOWN_FOLDER` uses in the shared
 * fixtures. It only turns bold if something interpolates it as HTML, which is
 * exactly what the untrusted-string rule forbids. The sixth is the id that
 * collides with `Object.prototype`.
 */
const WOT_MAIN_VEHICLE_IDS: readonly string[] = [
  'china:Ch24_Type64',
  'usa:A12_T29',
  'germany:G32_PzV_PzIV',
  'ussr:R04_T-34',
  'china:Ch99_<b>bold_markup',
  '__proto__',
];

describe('05-02 tracer: WoT main vehicle file through the production parser', () => {
  it('names the WoT main header verbatim, in the export column order', () => {
    expect(fixtures.WOT_MAIN_HEADER).toBe(
      'VEHICLE_NAME;LAST_BATTLE_AT;BATTLES_COUNT;WINS_COUNT;DAMAGE_DEALT;FRAGS_COUNT;XP_AMOUNT;SURVIVED_BATTLES;HITS_COUNT;SHOTS_COUNT;FRAGS_MAX;XP_MAX;DAMAGE_RECEIVED;SPOTTED_COUNT;ACHIEVEMENTS;FRAGS',
    );
  });

  it('writes the physical format the payments-era export uses: bare header, quote-all cells, bare CR, trailing terminator', () => {
    const text = fixtures.renderStatsCsv(['A', 'B'], [['1', 'say "hi"']]);

    // Header bare and unquoted; every data cell quote-all; a `;` separator.
    expect(text).toBe('A;B\r"1";"say ""hi"""\r');
    // Bare CR, not CRLF and not LF — a fixture written with `\n` would pass
    // while proving nothing about the file it stands in for.
    expect(text).not.toContain('\n');
    // The terminator is on the LAST line too, so a trailing split leaves an
    // empty final element rather than a lost row.
    expect(text.endsWith('\r')).toBe(true);
  });

  it('parses the WoT main file to six rows keyed by the real header names', () => {
    const parsed = parseCsvFile(
      fixtures.PLAYER_STATS_SAMPLE_FILES['WOT_Vehicle_Statistics.csv'] ?? '',
      'Player_statistics',
      'WOT_Vehicle_Statistics.csv',
    );

    expect(parsed.skippedCount).toBe(0);
    expect(parsed.rows).toHaveLength(6);
    expect(Object.keys(parsed.rows[0]!.data)).toEqual([
      'VEHICLE_NAME',
      'LAST_BATTLE_AT',
      'BATTLES_COUNT',
      'WINS_COUNT',
      'DAMAGE_DEALT',
      'FRAGS_COUNT',
      'XP_AMOUNT',
      'SURVIVED_BATTLES',
      'HITS_COUNT',
      'SHOTS_COUNT',
      'FRAGS_MAX',
      'XP_MAX',
      'DAMAGE_RECEIVED',
      'SPOTTED_COUNT',
      'ACHIEVEMENTS',
      'FRAGS',
    ]);
  });

  it('returns every vehicle id byte for byte, hostile ones included', () => {
    const parsed = parseCsvFile(
      fixtures.PLAYER_STATS_SAMPLE_FILES['WOT_Vehicle_Statistics.csv'] ?? '',
      'Player_statistics',
      'WOT_Vehicle_Statistics.csv',
    );

    expect(parsed.rows.map((row) => row.data['VEHICLE_NAME'])).toEqual(WOT_MAIN_VEHICLE_IDS);

    // The two hostile ids, one by one, so a failure names which one broke.
    const markup = parsed.rows[4]!.data['VEHICLE_NAME'];
    expect(markup).toBe('china:Ch99_<b>bold_markup');
    expect(markup!.split(':')[0]).toBe('china');

    // `__proto__` is an OPAQUE STRING. It must survive as an own property value
    // on the row, not as a prototype mutation that silently disappears.
    const proto = parsed.rows[5]!.data['VEHICLE_NAME'];
    expect(proto).toBe('__proto__');
    expect(Object.getOwnPropertyDescriptor(parsed.rows[5]!.data, 'VEHICLE_NAME')?.value).toBe(
      '__proto__',
    );
  });

  it('keeps the zero-battle vehicle with a blank last battle and blanks the two empty columns everywhere', () => {
    const parsed = parseCsvFile(
      fixtures.PLAYER_STATS_SAMPLE_FILES['WOT_Vehicle_Statistics.csv'] ?? '',
      'Player_statistics',
      'WOT_Vehicle_Statistics.csv',
    );
    const rows = parsed.rows.map((row) => row.data);

    // D-12: a garage-only vehicle is a ROW, not a filtered-out row, and its
    // count stays visible. Its last battle is blank because it never fought.
    const zero = rows.find((row) => row['VEHICLE_NAME'] === 'ussr:R04_T-34');
    expect(zero).toBeDefined();
    expect(zero!['BATTLES_COUNT']).toBe('0');
    expect(zero!['WINS_COUNT']).toBe('0');
    expect(zero!['LAST_BATTLE_AT']).toBe('');

    // `ACHIEVEMENTS` and `FRAGS` are the only two columns the real sample leaves
    // blank, and they are blank in EVERY row — a reader must not conclude the
    // export never writes them.
    for (const row of rows) {
      expect(row['ACHIEVEMENTS']).toBe('');
      expect(row['FRAGS']).toBe('');
    }
  });
});

// =============================================================================
// Task 2: the whole real-named file set, the hand-derived numbers, and the
// independent oracle that recomputes them.
//
// Every number below is checked twice, the way plan 05-01 established: once
// against the fixture's own hand-derived key in `PLAYER_STATS_EXPECTED`, and
// once against `tests/helpers/vehicle-oracle.ts`, which imports nothing at all.
// When the two disagree, at least one of them is wrong, and Node says so in
// seconds rather than a browser spec hours later.
// =============================================================================

/**
 * The nineteen real file names, spelled out here rather than imported.
 *
 * This list IS the D-04 contract: four titles x four files, plus the three that
 * are recognised on import and never displayed. Importing it from the fixture
 * would make the test agree with whatever the fixture happened to contain,
 * which is the tautology the oracle exists to prevent.
 */
const REAL_PLAYER_STATS_FILE_NAMES: readonly string[] = [
  'WOTB_Account_Statistics.csv',
  'WOTB_Battle_Types_Statistics.csv',
  'WOTB_Vehicle_Statistics.csv',
  'WOTB_Vehicle_Statistics_by_Type.csv',
  'WOT_Account_Statistics.csv',
  'WOT_Battle_Types_Statistics.csv',
  'WOT_Fallout_Vehicle_Statistics.csv',
  'WOT_Vehicle_Statistics.csv',
  'WOT_Vehicle_Statistics_by_Type.csv',
  'WOWP_19_Account_Statistics.csv',
  'WOWP_19_Plane_Statistics.csv',
  'WOWP_20_Account_Statistics.csv',
  'WOWP_20_Plane_Statistics.csv',
  'WOWS_Account_Statistics.csv',
  'WOWS_Account_Storage.csv',
  'WOWS_Battle_Types_Statistics.csv',
  'WOWS_Crews.csv',
  'WOWS_Ship_Statistics.csv',
  'WOWS_Ship_Statistics_by_Type.csv',
];

/** The five files that carry the account nickname. */
const ACCOUNT_FILE_NAMES: readonly string[] = [
  'WOT_Account_Statistics.csv',
  'WOTB_Account_Statistics.csv',
  'WOWS_Account_Statistics.csv',
  'WOWP_19_Account_Statistics.csv',
  'WOWP_20_Account_Statistics.csv',
];

/**
 * Parse one fixture file with the PRODUCTION parser, or return no rows.
 */
function parseSample(name: string): OracleVehicleRow[] {
  const text = fixtures.PLAYER_STATS_SAMPLE_FILES[name] ?? '';
  const parsed = parseCsvFile(text, 'Player_statistics', name);
  expect(parsed.skippedCount, `${name} lost rows to a Quotes error`).toBe(0);
  return parsed.rows.map((row) => row.data);
}

/**
 * Scale the oracle's percent-shaped result back down to an absolute quantity,
 * leaving any special value alone.
 *
 * The oracle returns `(numerator / denominator) * 100` because its callers are
 * percentages, so an AVERAGE is the same ratio divided by 100 again. Keeping the
 * halving here means the test states that rule once, exactly as the oracle's
 * header documents it.
 */
function unscaled(ratio: OracleRatioValue): number | OracleSpecial {
  return typeof ratio === 'number' ? ratio / 100 : ratio;
}

/**
 * The Battle_Types summary order, recomputed HERE with a plain sort.
 *
 * The oracle has no function for this (battles descending, ties by code
 * ascending is a summary-table rule, not a row rule), so this is the second,
 * independent expression of the same answer — written in the test on purpose so
 * the answer key and this sort cannot be the same mistake twice.
 */
function summaryCodeOrder(rows: readonly OracleVehicleRow[]): string[] {
  return [...rows]
    .sort((a, b) => {
      const battlesA = Number(a['BATTLES_COUNT'] ?? '0');
      const battlesB = Number(b['BATTLES_COUNT'] ?? '0');
      if (battlesA !== battlesB) return battlesB - battlesA;
      const codeA = a['TYPE'] ?? '';
      const codeB = b['TYPE'] ?? '';
      if (codeA < codeB) return -1;
      if (codeB < codeA) return 1;
      return 0;
    })
    .map((row) => row['TYPE'] ?? '');
}

describe('05-02 file set: nineteen real-named Player_statistics files', () => {
  it('holds exactly the nineteen real file names and no invented one', () => {
    expect(Object.keys(fixtures.PLAYER_STATS_SAMPLE_FILES).sort()).toEqual([
      ...REAL_PLAYER_STATS_FILE_NAMES,
    ]);
  });

  it('parses every file to the row count the answer key records', () => {
    // Widened to a plain record for the dynamic lookup, deliberately: the file
    // name list above stays `readonly string[]` so that a name the fixture does
    // NOT have is an assertion failure rather than a compile error. That keeps
    // this test able to fail, which a type-level coupling would remove.
    const expected = fixtures.PLAYER_STATS_EXPECTED.rowCountsByFile as Readonly<
      Record<string, number>
    >;
    for (const name of REAL_PLAYER_STATS_FILE_NAMES) {
      expect(parseSample(name).length, `${name} row count`).toBe(expected[name]);
    }
  });

  it('sums the per-file row counts to the stated total of 47', () => {
    // 17 WoT + 8 Blitz + 10 Warships + 9 Warplanes + 3 recognised-not-displayed.
    const perTitle = fixtures.PLAYER_STATS_EXPECTED;
    const fromTitles = (['wot', 'blitz', 'warships', 'warplanes'] as const).reduce<number>(
      (sum, key) => sum + perTitle.titles[key].totalRows,
      perTitle.recognisedNotDisplayed.totalRows,
    );
    expect(fromTitles).toBe(47);

    // And the fixture itself must agree, row for row, rather than the key only
    // agreeing with itself.
    const parsedTotal = REAL_PLAYER_STATS_FILE_NAMES.reduce(
      (sum, name) => sum + parseSample(name).length,
      0,
    );
    expect(parsedTotal).toBe(fixtures.PLAYER_STATS_SAMPLE_ROW_COUNT);
    expect(parsedTotal).toBe(47);
  });
});

describe('05-02 battle-type codes: by_Type selects, Battle_Types summarises', () => {
  it('orders the WoT by_Type codes NUMERICALLY, which plain string order gets wrong', () => {
    const rows = parseSample('WOT_Vehicle_Statistics_by_Type.csv');

    // The fixture carries codes 1, 2 and 10, so code-unit order would answer
    // ['1', '10', '2'] and a reader that sorted strings would look right for
    // every other title and wrong only here.
    expect(oracleBattleTypeCodes(rows)).toEqual(['1', '2', '10']);
    expect([...oracleBattleTypeCodes(rows)].sort()).toEqual(['1', '10', '2']);
    expect(oracleBattleTypeCodes(rows)).toEqual(
      fixtures.PLAYER_STATS_EXPECTED.titles.wot.byTypeCodes,
    );
  });

  it('summarises the WoT Battle_Types codes by battles descending with ties by code', () => {
    const rows = parseSample('WOT_Battle_Types_Statistics.csv');

    // 80, 10, 8, then 4 and 4 for codes 11 and 13 — the tie is the point, and
    // codes 11 and 13 exist ONLY here, never in by_Type, so a summary row can be
    // present with no selectable option (RESEARCH Pitfall 10).
    expect(summaryCodeOrder(rows)).toEqual(['1', '2', '10', '11', '13']);
    expect(summaryCodeOrder(rows)).toEqual(fixtures.PLAYER_STATS_EXPECTED.titles.wot.summaryCodes);
    expect(oracleBattleTypeCodes(rows)).toEqual(['1', '2', '10', '11', '13']);
  });

  it('lists Blitz 1 and 3, Warships 1 and 2, and no codes at all for Warplanes', () => {
    expect(oracleBattleTypeCodes(parseSample('WOTB_Vehicle_Statistics_by_Type.csv'))).toEqual([
      '1',
      '3',
    ]);
    expect(oracleBattleTypeCodes(parseSample('WOWS_Ship_Statistics_by_Type.csv'))).toEqual([
      '1',
      '2',
    ]);
    expect(summaryCodeOrder(parseSample('WOTB_Battle_Types_Statistics.csv'))).toEqual(['1', '3']);
    expect(summaryCodeOrder(parseSample('WOWS_Battle_Types_Statistics.csv'))).toEqual(['1', '2']);

    const expected = fixtures.PLAYER_STATS_EXPECTED;
    expect(expected.titles.blitz.byTypeCodes).toEqual(['1', '3']);
    expect(expected.titles.warships.byTypeCodes).toEqual(['1', '2']);
    // Warplanes has no by_Type file at all, so the battle-type control must not
    // be rendered (UI-SPEC section 3).
    expect(expected.titles.warplanes.byTypeCodes).toEqual([]);
  });
});

describe('05-02 special values and the NAME canary', () => {
  it('writes the canary into exactly the five account files and nowhere else', () => {
    const canary = fixtures.STATS_NAME_CANARY;
    expect(canary).toBe('CANARY-ACCOUNT-NAME-9f3');

    for (const name of ACCOUNT_FILE_NAMES) {
      const rows = parseSample(name);
      expect(rows.length, `${name} row count`).toBe(1);
      expect(rows[0]!['NAME'], `${name} NAME`).toBe(canary);
    }

    // The canary must not have leaked into a vehicle, by_Type, Battle_Types or
    // recognised-not-displayed file. Phase 3 D-21 confines it to the identity
    // header, so if it is anywhere else it is somewhere a test will not look.
    for (const name of REAL_PLAYER_STATS_FILE_NAMES) {
      if (ACCOUNT_FILE_NAMES.includes(name)) continue;
      expect(fixtures.PLAYER_STATS_SAMPLE_FILES[name]!.includes(canary), name).toBe(false);
    }
  });

  it('writes N/A for the Blitz premium expiry and an epoch for the WoT one', () => {
    expect(parseSample('WOTB_Account_Statistics.csv')[0]!['PREMIUM_EXPIRY_TIME']).toBe('N/A');
    // Shown AS WRITTEN (D-13): a 1970 value is an export artefact, not a date to
    // reformat or a timezone to claim.
    expect(parseSample('WOT_Account_Statistics.csv')[0]!['PREMIUM_EXPIRES_AT']).toBe(
      '1970-01-01 00:00:00',
    );
    expect(parseSample('WOWS_Account_Statistics.csv')[0]!['PREMIUM_EXPIRY_TIME']).toBe(
      '2021-12-31 00:00:00',
    );
  });

  it('spells the Warplanes account battle columns the two real ways', () => {
    // RESEARCH Pitfall 9: with only `BATTLES_COUNT` the Warplanes header would
    // always read "not in export".
    const wowp19 = parseSample('WOWP_19_Account_Statistics.csv')[0]!;
    expect(wowp19['GAMES_PLAYED']).toBe('4');
    expect(wowp19['BATTLES_COUNT']).toBeUndefined();

    const wowp20 = parseSample('WOWP_20_Account_Statistics.csv')[0]!;
    expect(wowp20['BATTLES']).toBe('8');
    expect(wowp20['BATTLES_COUNT']).toBeUndefined();
    expect(wowp20['GAMES_PLAYED']).toBeUndefined();
  });

  it('writes N/D in every WOWP_19 damage cell and never as 0', () => {
    const rows = parseSample('WOWP_19_Plane_Statistics.csv');
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(row['TOTAL_DAMAGE_DEALT']).toBe('N/D');
    }

    // D-09: a special value is a distinct thing from zero, so the oracle must be
    // able to tell them apart. `oracleRatio('N/D', '4')` is 'nd', never 0.
    expect(oracleRatio(rows[1]!['TOTAL_DAMAGE_DEALT'], rows[1]!['GAMES_PLAYED'])).toBe('nd');
    expect(oracleRatio('0', '4')).toBe(0);
  });

  it('gives WOWP_20 no vehicle identifier and counts it as records plus battles', () => {
    const rows = parseSample('WOWP_20_Plane_Statistics.csv');

    // D-09: this file is never a table. There is nothing to put in the Vehicle
    // cell, so a header-keyed read has no `VEHICLE_NAME` at all.
    for (const row of rows) expect(row['VEHICLE_NAME']).toBeUndefined();

    const battles = rows.reduce((sum, row) => sum + Number(row['BATTLES'] ?? '0'), 0);
    expect(rows).toHaveLength(fixtures.PLAYER_STATS_EXPECTED.warplanes20.records);
    expect(battles).toBe(fixtures.PLAYER_STATS_EXPECTED.warplanes20.battles);
    expect(battles).toBe(8);
  });

  it('counts each Warships battle twice, so by_Type rows cannot be summed', () => {
    const ships = parseSample('WOWS_Ship_Statistics.csv');
    const byType = parseSample('WOWS_Ship_Statistics_by_Type.csv');

    const shipBattles = ships.reduce((sum, row) => sum + Number(row['BATTLES_COUNT'] ?? '0'), 0);
    const byTypeBattles = byType.reduce((sum, row) => sum + Number(row['BATTLES_COUNT'] ?? '0'), 0);

    expect(shipBattles).toBe(9);
    // Every battle sits under two of the types (D-08), so this is exactly twice.
    expect(byTypeBattles).toBe(18);
    expect(byTypeBattles).toBe(shipBattles * 2);
    // And no ship wins or damage figure exists in the main file at all.
    expect(ships[0]!['WINS']).toBeUndefined();
    expect(ships[0]!['DAMAGE_DEALT']).toBeUndefined();
  });

  it('recognises the three never-displayed files with one row each', () => {
    expect(parseSample('WOT_Fallout_Vehicle_Statistics.csv')).toHaveLength(1);
    expect(parseSample('WOWS_Crews.csv')).toHaveLength(1);
    expect(parseSample('WOWS_Account_Storage.csv')).toHaveLength(1);

    const expected = fixtures.PLAYER_STATS_EXPECTED.recognisedNotDisplayed;
    expect([...expected.files].sort()).toEqual([
      'WOT_Fallout_Vehicle_Statistics.csv',
      'WOWS_Account_Storage.csv',
      'WOWS_Crews.csv',
    ]);
  });
});

describe('05-02 vehicle oracle agrees with the hand-derived WoT numbers', () => {
  /** The six ids in FILE order, which is the order the key is written in. */
  const IDs = WOT_MAIN_VEHICLE_IDS;

  it('reproduces every hand-derived win rate, and the zero-battle dash', () => {
    const rows = parseSample('WOT_Vehicle_Statistics.csv');
    const expected = fixtures.PLAYER_STATS_EXPECTED.wotHandDerived.winRatePercent;

    for (const id of IDs) {
      const row = rows.find((candidate) => candidate['VEHICLE_NAME'] === id)!;
      const value = oracleRatio(row['WINS_COUNT'], row['BATTLES_COUNT']);
      // Exact, not `toBeCloseTo`: the answer key records the product of the
      // oracle's own arithmetic, so a change to either side fails here.
      expect(value, `${id} win rate`).toEqual(expected[id]);
    }

    // Spot-check the derivation independently of the key: 55 of 100 is 55%, and
    // the zero-battle vehicle is a dash rather than 0% (D-09).
    expect(unscaled(oracleRatio('55', '100'))).toBe(((55 / 100) * 100) / 100);
    expect(unscaled(oracleRatio('15', '40'))).toBe(0.375);
    expect(oracleRatio('0', '0')).toBe('dash');
  });

  it('reproduces every hand-derived average damage', () => {
    const rows = parseSample('WOT_Vehicle_Statistics.csv');
    const expected = fixtures.PLAYER_STATS_EXPECTED.wotHandDerived.averageDamage;

    for (const id of IDs) {
      const row = rows.find((candidate) => candidate['VEHICLE_NAME'] === id)!;
      // An average is the same ratio scaled back down, which is why the oracle
      // returns a percent-shaped number for it.
      const average = unscaled(oracleRatio(row['DAMAGE_DEALT'], row['BATTLES_COUNT']));
      expect(average, `${id} average damage`).toEqual(expected[id]);
    }

    expect(unscaled(oracleRatio('30000', '40'))).toBe(750);
    expect(unscaled(oracleRatio('9000', '12'))).toBe(750);
  });

  it('makes the percent scaling a visible float artefact instead of folklore', () => {
    // (55 / 100) * 100 is NOT 55. An answer key that recorded the mathematical
    // value would disagree with the oracle for a reason that has nothing to do
    // with the export, so the key records the product and this test says why.
    expect((55 / 100) * 100).toBe(55.00000000000001);
    expect(oracleRatio('55', '100')).toBe(55.00000000000001);
    // The two ratios that terminate are exact; the two that repeat are not.
    expect(oracleRatio('15', '40')).toBe(37.5);
    expect(oracleRatio('3', '7')).toBe(42.857142857142854);
    expect(oracleRatio('1', '3')).toBe(33.33333333333333);
  });

  it('distinguishes all four special ratio values, in the documented order', () => {
    // Absent column beats absent cell's spelling.
    expect(oracleRatio(undefined, '4')).toBe('missing');
    expect(oracleRatio('2', undefined)).toBe('missing');
    // N/D wins over N/A, blank and unparseable, on either side.
    expect(oracleRatio('N/D', '4')).toBe('nd');
    expect(oracleRatio('2', 'N/D')).toBe('nd');
    expect(oracleRatio('N/D', '0')).toBe('nd');
    // N/A, blank and garbage are all 'not available'.
    expect(oracleRatio('N/A', '4')).toBe('na');
    expect(oracleRatio('', '4')).toBe('na');
    expect(oracleRatio('four', '4')).toBe('na');
    // Only a real zero denominator is the dash, and only after the above.
    expect(oracleRatio('0', '0')).toBe('dash');
    expect(oracleRatio('5', '0')).toBe('dash');
  });

  it('keys its answer maps safely, so the __proto__ vehicle is a real key', () => {
    // An object literal cannot express this. `{'__proto__': 500}` assigns the
    // prototype instead of creating a property, a primitive there is ignored,
    // and the lookup then returns `Object.prototype` — the row silently
    // disappears from the key that is supposed to protect it. The maps are built
    // with `Object.fromEntries`, which defines own data properties.
    const trap = { __proto__: 500 } as Record<string, number>;
    expect(Object.keys(trap)).toEqual([]);
    expect(trap['__proto__']).not.toBe(500);

    const { winRatePercent, averageDamage } = fixtures.PLAYER_STATS_EXPECTED.wotHandDerived;
    expect(Object.keys(winRatePercent)).toEqual([...WOT_MAIN_VEHICLE_IDS]);
    expect(Object.keys(averageDamage)).toEqual([...WOT_MAIN_VEHICLE_IDS]);
    expect(Object.getOwnPropertyDescriptor(winRatePercent, '__proto__')?.value).toBe(
      33.33333333333333,
    );
    expect(Object.getOwnPropertyDescriptor(averageDamage, '__proto__')?.value).toBe(500);
  });

  it('orders the WoT rows by battles descending with ties by id ascending, zero-battle last', () => {
    const rows = parseSample('WOT_Vehicle_Statistics.csv');

    // 100, 40, 12, 7, 3, then the garage-only vehicle on 0 — every row is
    // returned, because D-12 keeps zero-battle vehicles visible.
    expect(oracleDefaultOrder(rows)).toEqual([
      'china:Ch24_Type64',
      'usa:A12_T29',
      'china:Ch99_<b>bold_markup',
      'germany:G32_PzV_PzIV',
      '__proto__',
      'ussr:R04_T-34',
    ]);
    expect(oracleDefaultOrder(rows)).toEqual(
      fixtures.PLAYER_STATS_EXPECTED.wotHandDerived.defaultOrderIds,
    );
    expect(oracleDefaultOrder(rows)).toHaveLength(rows.length);
  });

  it('breaks a tie on battles by id in code-unit order, never locale collation', () => {
    const tied = [
      { VEHICLE_NAME: 'b_second', BATTLES_COUNT: '5' },
      { VEHICLE_NAME: 'A_first', BATTLES_COUNT: '5' },
      { VEHICLE_NAME: 'a_third', BATTLES_COUNT: '5' },
    ];

    // Upper case sorts before lower case in code-unit order. A locale collation
    // would interleave them differently, and two viewers would then disagree.
    expect(oracleDefaultOrder(tied)).toEqual(['A_first', 'a_third', 'b_second']);
  });

  it('sorts a row whose battles cell is unreadable last, not as zero', () => {
    const rows = [
      { VEHICLE_NAME: 'aaa_zero', BATTLES_COUNT: '0' },
      { VEHICLE_NAME: 'zzz_missing', BATTLES_COUNT: undefined },
      { VEHICLE_NAME: 'mmm_nd', BATTLES_COUNT: 'N/D' },
      { VEHICLE_NAME: 'bbb_one', BATTLES_COUNT: '1' },
    ];

    // A real zero beats an unreadable cell: "no battles" is known and sorts
    // below "has fought", while `N/D` is not a count at all and sorts below
    // both (D-09: a special value never counts as 0 in a sort).
    expect(oracleDefaultOrder(rows)).toEqual(['bbb_one', 'aaa_zero', 'mmm_nd', 'zzz_missing']);
  });
});

// =============================================================================
// Task 3: the seeded 5,000-vehicle generator and its answer key.
//
// UI-SPEC section 15 states the counts that must hold on this fixture:
// at most 30 rendered `vehicle-row` elements while `aria-rowcount` equals the
// full count plus one, and the first row of the default sort has the largest
// battle count. Both are only checkable if the fixture's own answers are known
// BEFORE the table exists, which is what this describe establishes.
//
// WHY THE KEY IS THE ORACLE'S AND NOT A CLOSED FORM
// Only one figure here has a closed form: the zero-battle count, because it is
// positional — every twentieth vehicle is on zero, and 5,000 / 20 = 250. The
// largest battle count and the first row's id come out of a seeded draw, and a
// draw has no formula beyond the generator itself. So those come from
// `oracleDefaultOrder`, recomputed from the generated rows with no reference to
// the code that produced them. That is weaker than a formula and stronger than
// a snapshot: it catches a generator that drifts, without freezing today's draw
// into a number nobody can check.
// =============================================================================

describe('05-02 seeded 5,000-vehicle generator', () => {
  it('produces byte-identical output for the same seed', () => {
    const spec = fixtures.VEHICLE_SCALE_5K_SPEC;
    const first = fixtures.generateVehicleMainCsv(spec);
    const second = fixtures.generateVehicleMainCsv(spec);

    // A fixture that "usually" reproduces is worse than none: it turns a later
    // failure into an unexplained product bug. This is the determinism contract
    // every seeded generator in this repo makes.
    expect(first).toBe(second);
    expect(first.length).toBeGreaterThan(0);
  });

  it('produces a different file for a different seed, so the seed is really the input', () => {
    const base = fixtures.VEHICLE_SCALE_5K_SPEC;
    const other = fixtures.generateVehicleMainCsv({ ...base, seed: base.seed + 1 });
    expect(other).not.toBe(fixtures.generateVehicleMainCsv(base));
  });

  it('writes exactly spec.count rows under the real WoT header', () => {
    // A small spec first: this is the cheap check that `count` is honoured and
    // not hard-wired to five thousand.
    for (const count of [1, 7, 250]) {
      const text = fixtures.generateVehicleMainCsv({ seed: 12345, count });
      const lines = text.split('\r');
      // The trailing terminator leaves an empty final element.
      expect(lines.filter((line) => line !== '').length, `count ${count}`).toBe(count + 1);
      expect(lines[0]).toBe(fixtures.WOT_MAIN_HEADER);
    }

    const big = fixtures.generateVehicleMainCsv(fixtures.VEHICLE_SCALE_5K_SPEC);
    expect(big.split('\r').filter((line) => line !== '').length).toBe(5001);
  });

  it('parses to 5,000 rows through the production parser with 5,000 distinct ids', () => {
    const spec = fixtures.VEHICLE_SCALE_5K_SPEC;
    const parsed = parseCsvFile(
      fixtures.generateVehicleMainCsv(spec),
      'Player_statistics',
      'WOT_Vehicle_Statistics.csv',
    );

    expect(parsed.skippedCount).toBe(0);
    expect(parsed.rows).toHaveLength(spec.count);
    // Every row is keyed by the real sixteen-column header, so the builder under
    // test reads the generated fixture through exactly the same names as the
    // hand one.
    expect(Object.keys(parsed.rows[0]!.data)).toHaveLength(
      fixtures.WOT_MAIN_HEADER.split(';').length,
    );

    const ids = parsed.rows.map((row) => row.data['VEHICLE_NAME']);
    expect(new Set(ids).size).toBe(spec.count);
    for (const id of ids) expect(typeof id).toBe('string');
  });

  it('makes every twentieth vehicle the zero-battle one, and only those', () => {
    // The one figure in this fixture with a genuine closed form: the
    // zero-battle vehicles are POSITIONAL, so the assertion is about row
    // position rather than about the id format (which the test does not
    // duplicate — that would be a second copy of the contract to keep in step).
    const parsed = parseCsvFile(
      fixtures.generateVehicleMainCsv(fixtures.VEHICLE_SCALE_5K_SPEC),
      'Player_statistics',
      'WOT_Vehicle_Statistics.csv',
    );
    const rows = parsed.rows.map((row) => row.data);

    let zeroCount = 0;
    rows.forEach((row, index) => {
      if (index % 20 === 0) {
        zeroCount += 1;
        expect(row['BATTLES_COUNT'], `row ${index} battles`).toBe('0');
        expect(row['WINS_COUNT'], `row ${index} wins`).toBe('0');
        // A vehicle that never fought has no last battle, like the hand fixture's
        // ussr:R04_T-34.
        expect(row['LAST_BATTLE_AT'], `row ${index} last battle`).toBe('');
      } else {
        expect(Number(row['BATTLES_COUNT']), `row ${index} battles`).toBeGreaterThan(0);
        expect(row['LAST_BATTLE_AT'], `row ${index} last battle`).not.toBe('');
      }
    });

    expect(zeroCount).toBe(250); // 5,000 / 20
  });

  it('keeps every derived figure inside its own row, so no cell is self-contradicting', () => {
    const parsed = parseCsvFile(
      fixtures.generateVehicleMainCsv(fixtures.VEHICLE_SCALE_5K_SPEC),
      'Player_statistics',
      'WOT_Vehicle_Statistics.csv',
    );

    for (const { data } of parsed.rows) {
      const battles = Number(data['BATTLES_COUNT']);
      expect(Number(data['WINS_COUNT'])).toBeLessThanOrEqual(battles);
      expect(Number(data['SURVIVED_BATTLES'])).toBeLessThanOrEqual(battles);
      // Hits cannot exceed shots, and XP and damage scale with battles, so a
      // reader that divides by battles never sees a negative or absurd figure.
      expect(Number(data['HITS_COUNT'])).toBeLessThanOrEqual(Number(data['SHOTS_COUNT']));
      expect(Number(data['XP_AMOUNT'])).toBeLessThanOrEqual(battles * 1200 + 1);
      expect(Number(data['DAMAGE_DEALT'])).toBeLessThanOrEqual(battles * 2000 + 1);
      expect(Number(data['FRAGS_COUNT'])).toBeLessThanOrEqual(battles * 3 + 1);
      // The last battle is an ISO wall clock inside the 2013..2021 window the
      // generator draws from — never a `Date` object and never a locale shape.
      // Every twentieth row is the zero-battle vehicle, whose last battle is
      // blank, so the blank case is the one that is checked first.
      const lastBattle = data['LAST_BATTLE_AT']!;
      if (battles === 0) {
        expect(lastBattle).toBe('');
      } else {
        expect(lastBattle).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
        expect(Number(lastBattle.slice(0, 4))).toBeGreaterThanOrEqual(2013);
        expect(Number(lastBattle.slice(0, 4))).toBeLessThanOrEqual(2021);
      }
    }
  });

  it('reports an answer key the oracle derives from the same rows', () => {
    const spec = fixtures.VEHICLE_SCALE_5K_SPEC;
    const parsed = parseCsvFile(
      fixtures.generateVehicleMainCsv(spec),
      'Player_statistics',
      'WOT_Vehicle_Statistics.csv',
    );
    const rows = parsed.rows.map((row) => row.data);
    const key = fixtures.vehicleScaleExpected(spec);

    // Row and zero-battle counts are the closed-form part.
    expect(key.rowCount).toBe(5000);
    expect(key.zeroBattleCount).toBe(250);

    // Everything else is recomputed here from the PARSED rows, independently of
    // the key, so a key that drifted from its own generator fails.
    const order = oracleDefaultOrder(rows);
    expect(key.firstRowId).toBe(order[0]);
    expect(key.firstThreeIds).toEqual(order.slice(0, 3));

    const largest = Math.max(...rows.map((row) => Number(row['BATTLES_COUNT'])));
    expect(key.largestBattles).toBe(largest);

    // UI-SPEC section 15: the first row of the default sort has the largest
    // battle count. Stated here so 05-16 inherits a checked property instead of
    // a hope.
    const firstRow = rows.find((row) => row['VEHICLE_NAME'] === key.firstRowId)!;
    expect(Number(firstRow['BATTLES_COUNT'])).toBe(key.largestBattles);

    // And a spec other than the 5,000 one gets its own key, not a shared answer.
    const smallKey = fixtures.vehicleScaleExpected({ seed: 999, count: 40 });
    expect(smallKey.rowCount).toBe(40);
    expect(smallKey.zeroBattleCount).toBe(2);
  });
});
