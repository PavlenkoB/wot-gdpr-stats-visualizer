// =============================================================================
// The vehicle view builder (phase 05, plan 05-05).
//
// WHAT THIS FILE IS FOR
// `src/lib/features/vehicles/vehicle-aggregate.ts` turns the exact Player_statistics files of
// an export into one title's table. It is pure — no worker, no Dexie, no DOM, no
// clock — so a wrong answer fails in seconds under Node rather than in a browser
// run hours later. STATS-01's correctness lives here and not in a component:
// N/D is never 0, the Warships All view never invents a win rate, a per-ship row
// is never summed across battle types, and the account nickname is never read.
//
// THE ANSWERS COME FROM TWO INDEPENDENT PLACES
//   - the hand fixtures in `tests/fixtures/player-stats-fixtures.ts`, whose
//     expected objects carry the arithmetic in the comment beside each figure;
//   - `tests/helpers/vehicle-oracle.ts`, which recomputes every derived value
//     from the raw rows with NO import from `src/` at all — ratios by `Number`
//     arithmetic with the specials decided as STRINGS before anything is parsed,
//     codes by its own integer-vs-code-unit comparator.
//
// The two are written in different shapes on purpose, so a misreading of the
// export cannot hide in both at once.
//
// THE FILES TRAVEL THROUGH THE PRODUCTION PARSER
// Every CSV below is read with `parseCsvFile`, the import path's own reader, so
// the rows the builder sees are the rows the worker will see: quote-all cells
// unwrapped, a bare-CR terminator on every line, mojibake already repaired.
//
// Decisions: D-05..D-13. Threats: T-05-12..T-05-15.
// =============================================================================

import { describe, expect, it } from 'vitest';

import * as fixtures from '../../fixtures/player-stats-fixtures';
import * as oracle from '../../helpers/vehicle-oracle';
import {
  MA_DIVERGENT_VEHICLE_CANONICAL,
  MA_DIVERGENT_VEHICLE_HEADER,
  MA_DIVERGENT_VEHICLE_RENAMED,
} from '../../fixtures/multi-account-fixtures';
import { WOT_MAIN_HEADER } from '../../fixtures/player-stats-fixtures';
import { oneAccount } from '../../helpers/row-groups';
import { parseCsvFile } from '../../../src/lib/worker/csv-parse';
import { NEW_DATA_SPEC_FILES } from '../../../src/lib/worker/new-data-specs';
// Namespace imports on purpose: a symbol that does not exist yet fails the ONE
// test that uses it instead of crashing the whole file at module resolution,
// which is what makes the RED run below readable.
import * as shared from '../../../src/lib/features/vehicles/vehicle-shared';
import * as vehicleStats from '../../../src/lib/features/vehicles/vehicle-aggregate';
import type {
  SpecialKey,
  VehicleCell,
  VehicleRow,
  VehicleRowData,
  VehicleView,
} from '../../../src/lib/features/vehicles/vehicle-shared';
import type { AccountRowGroup } from '../../../src/lib/worker/csv-columns';
import type {
  VehicleFileFacts,
  VehicleFiles,
} from '../../../src/lib/features/vehicles/vehicle-aggregate';

/** The category the export writes these files under. */
const CATEGORY = 'Player_statistics';

/** The four WoT files, which is all the tracer needs. */
const WOT_FILES = [
  'WOT_Vehicle_Statistics.csv',
  'WOT_Vehicle_Statistics_by_Type.csv',
  'WOT_Battle_Types_Statistics.csv',
  'WOT_Account_Statistics.csv',
] as const;

/**
 * The six WoT ids in FILE order, as the answer key writes them.
 *
 * A `const` tuple rather than a `string[]`, because the answer key is `as const`
 * and indexing it with a general `string` would not type-check — the tuple's
 * literal types are exactly the keys the key has.
 */
const WOT_RAW_IDS = [
  'china:Ch24_Type64',
  'usa:A12_T29',
  'germany:G32_PzV_PzIV',
  'ussr:R04_T-34',
  'china:Ch99_<b>bold_markup',
  '__proto__',
] as const;

/**
 * The sample files, parsed by the production reader and keyed by lower-cased
 * exact name — the key {@link VehicleFiles} is defined on.
 *
 * Only the named files are present, which is what makes an absent title a real
 * absence rather than an empty list of every title's files.
 */
function filesFrom(names: readonly string[]): Map<string, VehicleFileFacts> {
  const files = new Map<string, VehicleFileFacts>();
  for (const name of names) {
    const parsed = parseCsvFile(fixtures.PLAYER_STATS_SAMPLE_FILES[name], CATEGORY, name);
    files.set(name.toLowerCase(), {
      groups: oneAccount(parsed.rows.map((row) => row.data)),
      seen: true,
    });
  }
  return files;
}

/** Every sample file, parsed — all four titles and the three never-shown ones. */
function allFiles(): Map<string, VehicleFileFacts> {
  return filesFrom(Object.keys(fixtures.PLAYER_STATS_SAMPLE_FILES));
}

/** The four WoT files, parsed. */
function wotFiles(): Map<string, VehicleFileFacts> {
  return filesFrom(WOT_FILES);
}

/** The one cell of a row in the named column. */
function cellOf(view: VehicleView, row: VehicleRow, key: string): VehicleCell {
  const index = view.columns.findIndex((column) => column.key === key);
  expect(`${key}:${index}`).toBe(`${key}:${index >= 0 ? index : 'absent'}`);
  return row.cells[index];
}

/** The number a cell holds, for the cases where it must hold one. */
function numberOf(cell: VehicleCell): number | string {
  return cell.t === 'n' ? cell.v : `not a number (${cell.t})`;
}

/**
 * A cell in the ORACLE's vocabulary, so a built cell can be compared with the
 * hand key and with `oracleRatio` directly.
 *
 * The two sides spell the same four situations differently and deliberately:
 * the oracle says `'dash'` for a ratio over zero, this app says `'no-battles'`
 * (or `'no-shots'`) and draws an em dash with a visually hidden "no battles"
 * beside it (D-09). Everything else — `nd`, `na`, `missing` — is spelled the
 * same on both sides, and the mapping below is the only translation there is.
 */
function oracleShape(cell: VehicleCell): number | string {
  if (cell.t === 'n') return cell.v;
  if (cell.t === 'x') return cell.v === 'no-battles' || cell.v === 'no-shots' ? 'dash' : cell.v;
  return cell.t;
}

/** The special a cell holds, or null when it holds a value. */
function specialOf(cell: VehicleCell): SpecialKey | null {
  return cell.t === 'x' ? cell.v : null;
}

/**
 * Index the built rows by the id the ANSWER KEY uses.
 *
 * The key is rebuilt from `nation` and `id` rather than kept, because the split
 * is the thing under test: a row only lands on `china:Ch24_Type64` again if the
 * builder put `china` in `nation` and `Ch24_Type64` in `id`.
 */
function rowsByRawId(view: VehicleView): Map<string, VehicleRow> {
  return new Map(
    view.rows.map((row) => [row.nation === null ? row.id : `${row.nation}:${row.id}`, row]),
  );
}

describe('05-05 tracer: WoT All battles view through the production parser', () => {
  it('reads the four WoT files by their exact lower-cased names', () => {
    // An anchored exact-name table, never a prefix test: `WOTB_` and
    // `WOT_Fallout_` both start with `WOT` (RESEARCH Pattern 7).
    for (const name of WOT_FILES) {
      expect(vehicleStats.VEHICLE_FILE_NAMES.has(name.toLowerCase())).toBe(true);
    }
    expect(vehicleStats.VEHICLE_FILE_NAMES.has('wot_fallout_vehicle_statistics.csv')).toBe(false);
    expect(vehicleStats.VEHICLE_FILE_NAMES.size).toBe(16);
  });

  it('builds the All battles view with the six core columns in order and six rows in file order', () => {
    const view = vehicleStats.buildVehicleView(wotFiles(), { title: 'wot', battleType: null });

    expect(view.titleState).toBe('ready');
    expect(view.title).toBe('wot');
    expect(view.battleType).toBe(null);
    // The SIX CORE COLUMNS, in the fixed order, all core (D-10). The extras
    // this file can also show follow them with `core: false`, because the
    // column picker needs the view to say what the FILE has and leaves the
    // choice of which of them to draw to the main thread (plan 05-09).
    const core = view.columns.filter((column) => column.core);
    expect(core.map((column) => column.key)).toEqual([
      'vehicle',
      'battles',
      'winRate',
      'avgDamage',
      'frags',
      'xp',
    ]);
    expect(view.columns.slice(0, core.length)).toEqual(core);
    expect(view.columns.slice(core.length).every((column) => column.core === false)).toBe(true);
    // The WoT main file has no `DAMAGE_MAX` and no garage column, so those two
    // extras are not offered at all (UI-SPEC section 3's extras table).
    expect(view.columns.map((column) => column.key)).not.toContain('maxDamage');
    expect(view.columns.map((column) => column.key)).not.toContain('inGarage');
    expect(view.columns.map((column) => column.key)).toContain('lastBattle');
    expect(view.rows).toHaveLength(6);
    // File order, not sorted order: sorting is the main thread's (plan 05-09),
    // so a builder that decided an order would make a sort test vacuous.
    expect([...rowsByRawId(view).keys()]).toEqual(WOT_RAW_IDS);
  });

  it('derives win rate and average damage, and agrees with the hand key and the oracle', () => {
    const view = vehicleStats.buildVehicleView(wotFiles(), { title: 'wot', battleType: null });
    const rows = rowsByRawId(view);
    const expected = fixtures.PLAYER_STATS_EXPECTED.wotHandDerived;

    for (const rawId of WOT_RAW_IDS) {
      const row = rows.get(rawId);
      expect(row, rawId).toBeDefined();
      if (row === undefined) continue;
      // Exact equality against the hand key, which records the PRODUCT of the
      // oracle's own arithmetic: 55 of 100 is 55.00000000000001, not 55.
      expect(oracleShape(cellOf(view, row, 'winRate')), `${rawId} win rate`).toEqual(
        expected.winRatePercent[rawId],
      );
      expect(oracleShape(cellOf(view, row, 'avgDamage')), `${rawId} average damage`).toEqual(
        expected.averageDamage[rawId],
      );
    }

    // And the third check: the zero-import oracle, on the raw rows, which never
    // saw the builder.
    const raw = parseCsvFile(
      fixtures.PLAYER_STATS_SAMPLE_FILES['WOT_Vehicle_Statistics.csv'],
      CATEGORY,
      'WOT_Vehicle_Statistics.csv',
    ).rows.map((row) => row.data);
    const first = raw[0];
    expect(oracle.oracleRatio(first?.['WINS_COUNT'], first?.['BATTLES_COUNT'])).toEqual(
      expected.winRatePercent['china:Ch24_Type64'],
    );
  });

  it('splits the nation tag off the raw id and leaves an unprefixed id alone', () => {
    const view = vehicleStats.buildVehicleView(wotFiles(), { title: 'wot', battleType: null });
    const rows = rowsByRawId(view);

    const type64 = rows.get('china:Ch24_Type64');
    expect(type64?.nation).toBe('china');
    expect(type64?.id).toBe('Ch24_Type64');
    expect(type64?.battles).toBe(100);
    expect(numberOf(cellOf(view, type64!, 'frags'))).toBe(150);
    expect(numberOf(cellOf(view, type64!, 'xp'))).toBe(90_000);

    const a12 = rows.get('usa:A12_T29');
    expect(numberOf(cellOf(view, a12!, 'winRate'))).toBe(37.5);
    expect(numberOf(cellOf(view, a12!, 'avgDamage'))).toBe(750);

    const panzer = rows.get('germany:G32_PzV_PzIV');
    expect(numberOf(cellOf(view, panzer!, 'winRate'))).toBe(42.857142857142854);
    expect(numberOf(cellOf(view, panzer!, 'avgDamage'))).toBe(714.2857142857143);

    // The markup-bearing id is an ordinary string, split on its colon like any
    // other (T-05-03).
    const markup = rows.get('china:Ch99_<b>bold_markup');
    expect(markup?.id).toBe('Ch99_<b>bold_markup');
    expect(markup?.nation).toBe('china');

    // `__proto__` has no colon, so it has no nation, and it is an ordinary row
    // rather than a lost one (T-05-13).
    const proto = rows.get('__proto__');
    expect(proto?.nation).toBe(null);
    expect(proto?.id).toBe('__proto__');
    expect(proto?.battles).toBe(3);
    expect(numberOf(cellOf(view, proto!, 'winRate'))).toBe(33.33333333333333);
  });

  it('gives the zero-battle vehicle a dash, never a zero', () => {
    const view = vehicleStats.buildVehicleView(wotFiles(), { title: 'wot', battleType: null });
    const zero = rowsByRawId(view).get('ussr:R04_T-34');

    expect(zero?.battles).toBe(0);
    // A real zero: the vehicle IS in the table with its count (D-12).
    expect(cellOf(view, zero!, 'battles').t).toBe('n');
    expect(numberOf(cellOf(view, zero!, 'battles'))).toBe(0);
    // Two dashes: 0 ÷ 0 is not 0% and not 0 damage (D-09).
    expect(specialOf(cellOf(view, zero!, 'winRate'))).toBe('no-battles');
    expect(specialOf(cellOf(view, zero!, 'avgDamage'))).toBe('no-battles');
  });

  it('reads the header as written and reconciles with the rows', () => {
    const view = vehicleStats.buildVehicleView(wotFiles(), { title: 'wot', battleType: null });

    // 162 is the account file's lifetime count, and it is also the sum of the
    // six rows — the reconciliation the research recorded. The builder derives
    // neither from the other; the test asserts they agree.
    expect(numberOf(view.header?.battles ?? { t: 'x', v: 'missing' })).toBe(162);
    const sum = view.rows.reduce((total, row) => total + (row.battles ?? 0), 0);
    expect(sum).toBe(162);

    // The expiry is shown EXACTLY as written, Unix epoch included (D-13).
    const expiry = view.header?.premiumExpires;
    expect(expiry?.t).toBe('s');
    expect(expiry?.t === 's' ? expiry.v : '').toBe('1970-01-01 00:00:00');
  });

  it('reports all four titles in order, with the WoT entry present and six rows', () => {
    const view = vehicleStats.buildVehicleView(wotFiles(), { title: null, battleType: null });

    expect(view.overview.map((entry) => entry.title)).toEqual([...shared.VEHICLE_TITLES]);
    expect(view.overview[0]).toEqual({ title: 'wot', present: true, rows: 6 });
    // The other three are absent from this four-file export, not empty.
    expect(view.overview.slice(1).every((entry) => entry.present === false)).toBe(true);
    expect(view.overview.slice(1).every((entry) => entry.rows === 0)).toBe(true);
    // A null request picks the first title that has rows.
    expect(view.title).toBe('wot');
  });

  it('tells a title that is absent from the zip from one whose file parsed to nothing', () => {
    // NOTHING of WoT in the zip: the option keeps its "(not in this export)"
    // suffix and there is no table and no header (D-05).
    const absent = vehicleStats.buildVehicleView(
      filesFrom(WOT_FILES.filter((name) => name.startsWith('WOTB_'))),
      { title: 'wot', battleType: null },
    );
    expect(absent.titleState).toBe('not-in-export');
    expect(absent.rows).toEqual([]);
    expect(absent.header).toBeNull();
    expect(absent.summary).toEqual([]);
    expect(absent.battleTypes).toEqual([]);

    // The file WAS in the zip and parsed to no data rows: the table is empty
    // and the header is still real, because the account file still has a row.
    const seenButEmpty = new Map(wotFiles());
    seenButEmpty.set('wot_vehicle_statistics.csv', { groups: [], seen: true });
    const empty = vehicleStats.buildVehicleView(seenButEmpty, { title: 'wot', battleType: null });
    expect(empty.titleState).toBe('no-rows');
    expect(empty.rows).toEqual([]);
    expect(empty.header).not.toBeNull();

    // A title that is in the export but has NO vehicle file is `no-rows`, not
    // `not-in-export`: the zip does hold WoT files, and calling the title
    // absent would be a claim the export contradicts.
    const noVehicleFile = vehicleStats.buildVehicleView(
      filesFrom(WOT_FILES.filter((name) => name !== 'WOT_Vehicle_Statistics.csv')),
      { title: 'wot', battleType: null },
    );
    expect(noVehicleFile.titleState).toBe('no-rows');
    expect(noVehicleFile.rows).toEqual([]);
    expect(noVehicleFile.header).not.toBeNull();
  });
});

/**
 * Days from 1970-01-01 to a civil date, written out here so a date cell's sort
 * key is checked against a SECOND implementation rather than against the
 * parser that produced it.
 *
 * Howard Hinnant's `days_from_civil`, the same identity the app's
 * `civil-date.ts` implements and for the same reason: an era of 400 years and
 * a March-shifted year, so the arithmetic is integer-only and has no leap-year
 * special case to get wrong.
 */
function daysFromEpoch(year: number, month: number, day: number): number {
  const shifted = year - (month <= 2 ? 1 : 0);
  const era = Math.floor(shifted / 400);
  const yearOfEra = shifted - era * 400;
  const dayOfYear = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1;
  const dayOfEra =
    yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear;
  return era * 146_097 + dayOfEra - 719_468;
}

/** The wall-clock seconds a `YYYY-MM-DD hh:mm:ss` cell names. */
function wallClockSeconds(text: string): number {
  const [date, time] = text.split(' ');
  const [year, month, day] = (date ?? '').split('-').map(Number);
  const [hour, minute, second] = (time ?? '').split(':').map(Number);
  return (
    daysFromEpoch(year ?? 0, month ?? 0, day ?? 0) * 86_400 +
    (hour ?? 0) * 3_600 +
    (minute ?? 0) * 60 +
    (second ?? 0)
  );
}

describe('05-05 the battle-type filter and the WoT summary', () => {
  it('lists only the codes the by_Type rows carry, in numeric order', () => {
    const view = vehicleStats.buildVehicleView(allFiles(), { title: 'wot', battleType: null });

    // 1, 2, 10 — NUMERIC order, where plain code-unit order would be 1, 10, 2.
    expect(view.battleTypes).toEqual(['1', '2', '10']);
    expect(view.battleTypes).toEqual(fixtures.PLAYER_STATS_EXPECTED.titles.wot.byTypeCodes);

    // And against the zero-import oracle, which sorts the same codes with a
    // comparator of its own.
    const byType = parseCsvFile(
      fixtures.PLAYER_STATS_SAMPLE_FILES['WOT_Vehicle_Statistics_by_Type.csv'],
      CATEGORY,
      'WOT_Vehicle_Statistics_by_Type.csv',
    ).rows.map((row) => row.data);
    expect(view.battleTypes).toEqual(oracle.oracleBattleTypeCodes(byType));
  });

  it('lists every code of the Battle_Types file, by battles descending then code', () => {
    const view = vehicleStats.buildVehicleView(allFiles(), { title: 'wot', battleType: null });

    // 80, 10, 8, then the 4/4 tie broken by code. Codes 11 and 13 are in the
    // summary and NOT in the filter: the select may only offer codes that have
    // by_Type rows (RESEARCH Pitfall 10), so a summary row with no selectable
    // option is expected rather than a bug.
    expect(view.summary.map((entry) => entry.code)).toEqual(['1', '2', '10', '11', '13']);
    expect(view.summary.map((entry) => entry.code)).toEqual(
      fixtures.PLAYER_STATS_EXPECTED.titles.wot.summaryCodes,
    );
    expect(view.summary.map((entry) => numberOf(entry.battles))).toEqual([80, 10, 8, 4, 4]);
    expect(view.summary[0]?.wins.t === 'n' ? view.summary[0]?.wins.v : null).toBe(44);
    expect(view.summary[0]?.damage.t === 'n' ? view.summary[0]?.damage.v : null).toBe(96_000);
  });

  it('swaps to one battle type by_Type rows, mapped with that file by column map', () => {
    const view = vehicleStats.buildVehicleView(allFiles(), { title: 'wot', battleType: '1' });

    expect(view.battleType).toBe('1');
    expect(view.rows).toHaveLength(2);
    expect(view.rows.map((row) => row.id)).toEqual(['Ch24_Type64', 'A12_T29']);
    expect(view.rows.map((row) => row.nation)).toEqual(['china', 'usa']);
    // 33 of 60 battles won under type 1 is 55%, and its average damage is
    // 72000 / 60 = 1200. The product, not the mathematical value: 33/60 is
    // 0.55 exactly, and multiplying by 100 gives 55.00000000000001.
    expect(oracleShape(cellOf(view, view.rows[0]!, 'winRate'))).toBe((33 / 60) * 100);
    expect(oracleShape(cellOf(view, view.rows[0]!, 'avgDamage'))).toBe(1200);
    // The by_Type file carries DAMAGE_MAX, so Max damage is offered here and was
    // not offered in the All view.
    expect(view.columns.map((column) => column.key)).toContain('maxDamage');
    expect(numberOf(cellOf(view, view.rows[0]!, 'maxDamage'))).toBe(3_600);

    const two = vehicleStats.buildVehicleView(allFiles(), { title: 'wot', battleType: '2' });
    expect(two.battleType).toBe('2');
    expect(two.rows).toHaveLength(1);
    expect(two.rows[0]?.battles).toBe(10);
  });

  it('applies null for a code this title does not have', () => {
    for (const asked of ['11', 'abc', '', '1 ']) {
      const view = vehicleStats.buildVehicleView(allFiles(), { title: 'wot', battleType: asked });
      // The view reports what it APPLIED, never what it was asked for, so a
      // stale selection can never be displayed as if the data supported it.
      expect(`${asked}:${view.battleType}`).toBe(`${asked}:null`);
      expect(view.rows).toHaveLength(6);
    }
  });
});

describe('05-05 the Blitz view', () => {
  it('maps the Blitz spellings of wins, frags and XP', () => {
    const view = vehicleStats.buildVehicleView(allFiles(), { title: 'wotb', battleType: null });
    const rows = rowsByRawId(view);

    // Blitz writes WINS, FRAGS and XP where WoT writes WINS_COUNT, FRAGS_COUNT
    // and XP_AMOUNT, so a builder that only knew WoT's names would show "not in
    // export" on every Blitz column.
    expect(view.titleState).toBe('ready');
    expect(view.rows).toHaveLength(3);
    const alpha = rows.get('blitz_alpha');
    expect(alpha?.battles).toBe(20);
    expect(oracleShape(cellOf(view, alpha!, 'winRate'))).toBe(60);
    expect(oracleShape(cellOf(view, alpha!, 'avgDamage'))).toBe(1200);
    expect(numberOf(cellOf(view, alpha!, 'frags'))).toBe(18);
    expect(numberOf(cellOf(view, alpha!, 'xp'))).toBe(15_000);
  });

  it('offers the Blitz battle types and dates and booleans as their own cells', () => {
    const view = vehicleStats.buildVehicleView(allFiles(), { title: 'wotb', battleType: null });
    expect(view.battleTypes).toEqual(['1', '3']);
    expect(view.battleTypes).toEqual(fixtures.PLAYER_STATS_EXPECTED.titles.blitz.byTypeCodes);
    expect(view.summary.map((entry) => entry.code)).toEqual(['1', '3']);

    const keys = view.columns.map((column) => column.key);
    expect(keys).toContain('inGarage');
    expect(keys).toContain('lastBattle');

    const alpha = rowsByRawId(view).get('blitz_alpha');
    // `1` is yes and `0` is no: the export's readme writes F/T and the 2021
    // sample writes 1/0, and they are the same flag.
    expect(cellOf(view, alpha!, 'inGarage')).toEqual({ t: 'b', v: true });
    expect(cellOf(view, rowsByRawId(view).get('ussr:R12_Blitz')!, 'inGarage')).toEqual({
      t: 'b',
      v: false,
    });

    // The date carries the text the export wrote AND the seconds it names, so
    // the table can sort on a number without the player losing what was there.
    const last = cellOf(view, alpha!, 'lastBattle');
    expect(last.t).toBe('d');
    expect(last.t === 'd' ? last.v : '').toBe('2021-07-07 07:07:07');
    expect(last.t === 'd' ? last.k : null).toBe(wallClockSeconds('2021-07-07 07:07:07'));
  });

  it('shows the account expiry as the export wrote it, and an N/A as not available', () => {
    const view = vehicleStats.buildVehicleView(allFiles(), { title: 'wotb', battleType: null });

    expect(numberOf(view.header?.battles ?? { t: 'x', v: 'missing' })).toBe(28);
    // Blitz writes `N/A` in PREMIUM_EXPIRY_TIME. It is a value the header must
    // render, not a parse failure to swallow (D-13).
    expect(view.header?.premiumExpires).toEqual({ t: 'x', v: 'na' });
  });
});

describe('05-05 the Warships view and the D-08 no-guessing rule', () => {
  it('shows battles, last battle and in garage in All battles, and nothing summed', () => {
    const view = vehicleStats.buildVehicleView(allFiles(), { title: 'wows', battleType: null });

    expect(view.titleState).toBe('ready');
    expect(view.allBattlesOnly).toBe(true);
    const core = view.columns.filter((column) => column.core);
    expect(core.map((column) => column.key)).toEqual([
      'vehicle',
      'battles',
      'lastBattle',
      'inGarage',
      'winRate',
      'avgDamage',
    ]);
    // Every win-rate and average-damage cell reads the same per-type note and
    // is not sortable: there is one value for the whole table, so there is
    // nothing to order (D-08).
    for (const key of ['winRate', 'avgDamage']) {
      const column = view.columns.find((candidate) => candidate.key === key);
      expect(`${key}:${column?.sortable}`).toBe(`${key}:false`);
      for (const row of view.rows) {
        expect(cellOf(view, row, key)).toEqual({ t: 'x', v: 'per-type' });
      }
    }

    // 7 + 0 + 2 = 9 real battles, and that is the account file's figure.
    const allBattles = view.rows.map((row) => row.battles ?? 0).reduce((a, b) => a + b, 0);
    expect(allBattles).toBe(9);
    expect(allBattles).toBe(fixtures.PLAYER_STATS_EXPECTED.titles.warships.battlesSum);

    // The by_Type rows add to 18 because every Warships battle is counted under
    // TWO types, so no per-ship figure may ever be summed across them. The
    // number 18 appears nowhere in this view.
    const byTypeSum = fixtures.PLAYER_STATS_EXPECTED.titles.warships.byTypeBattlesSum;
    expect(byTypeSum).toBe(18);
    expect(JSON.stringify(view.rows)).not.toContain('"v":18');
    expect(view.summary.map((entry) => numberOf(entry.battles))).toEqual([9, 9]);
  });

  it('fills the same columns in once a battle type is chosen', () => {
    const view = vehicleStats.buildVehicleView(allFiles(), { title: 'wows', battleType: '1' });

    expect(view.allBattlesOnly).toBe(false);
    expect(view.battleType).toBe('1');
    expect(view.rows).toHaveLength(2);
    expect(view.rows.map((row) => row.id)).toEqual(['PJSD001_Fake_Alpha', 'PJSC003_Fake_Gamma']);
    expect(view.rows.map((row) => row.battles)).toEqual([7, 2]);
    // The by_Type file has real wins, damage, frags and XP, so the six core
    // columns are values again rather than per-type notes.
    expect(oracleShape(cellOf(view, view.rows[0]!, 'winRate'))).toBe((4 / 7) * 100);
    expect(oracleShape(cellOf(view, view.rows[0]!, 'avgDamage'))).toBe(4000);
    expect(view.columns.map((column) => column.key)).toContain('planesDestroyed');
    expect(numberOf(cellOf(view, view.rows[0]!, 'planesDestroyed'))).toBe(1);
    expect(view.columns.find((column) => column.key === 'winRate')?.sortable).toBe(true);
  });
});

describe('05-05 the Warplanes view and the 20-file note', () => {
  it('shows the named WOWP_19 planes with N/D damage that is never a zero', () => {
    const view = vehicleStats.buildVehicleView(allFiles(), { title: 'wowp', battleType: null });

    expect(view.titleState).toBe('ready');
    expect(view.rows).toHaveLength(3);
    expect(view.rows.map((row) => row.id)).toEqual([
      'plane_fake_one',
      'plane_fake_two',
      'plane_fake_three',
    ]);
    // Every plane's TOTAL_DAMAGE_DEALT and MAX_DAMAGE_DEALT read N/D, including
    // the one that has played four games, because the game does not define
    // damage at all (D-09). Neither may be 0 — and the average damage of a
    // never-flown plane is `not defined` rather than a dash, because the export
    // said the quantity does not exist, which outranks the fact that there was
    // nothing to divide. The oracle's rule order says exactly this.
    for (const row of view.rows) {
      const damage = oracleShape(cellOf(view, row, 'avgDamage'));
      expect(`${row.id}:${damage}`).toBe(`${row.id}:nd`);
      expect(oracleShape(cellOf(view, row, 'maxDamage'))).toBe('nd');
    }

    const two = view.rows[1]!;
    expect(oracleShape(cellOf(view, two, 'winRate'))).toBe(50);
    // The two never-flown planes get dashes on the ratios whose inputs ARE
    // numbers, and never a zero.
    for (const row of [view.rows[0]!, view.rows[2]!]) {
      expect(specialOf(cellOf(view, row, 'winRate'))).toBe('no-battles');
      expect(specialOf(cellOf(view, row, 'survival'))).toBe('no-battles');
      // Hits over zero shots is its own dash, with its own hidden label.
      expect(specialOf(cellOf(view, row, 'hitRatio'))).toBe('no-shots');
      expect(row.battles).toBe(0);
    }
  });

  it('has no battle types and no summary, because Warplanes has no by_Type file', () => {
    const view = vehicleStats.buildVehicleView(allFiles(), { title: 'wowp', battleType: '1' });

    expect(view.battleTypes).toEqual([]);
    expect(view.summary).toEqual([]);
    expect(view.battleType).toBe(null);
    expect(view.rows).toHaveLength(3);
    expect(fixtures.PLAYER_STATS_EXPECTED.titles.warplanes.byTypeCodes).toEqual([]);
  });

  it('reports the 20 file as a note, never a table', () => {
    const view = vehicleStats.buildVehicleView(allFiles(), { title: 'wowp', battleType: null });

    // WOWP_20_Plane_Statistics.csv has no vehicle identifier at all, so there is
    // nothing to put in a vehicle cell: four records, eight battles, and a
    // neutral sentence (D-09).
    expect(view.wowp20).toEqual({ records: 4, battles: 8 });
    expect(view.wowp20).toEqual(fixtures.PLAYER_STATS_EXPECTED.warplanes20);
    // 8 is the 20 file's own total and is NOT the Warplanes title's 4, which
    // is the WOWP_19 total. The two files describe different planes and are
    // never added together.
    expect(view.rows.map((row) => row.battles ?? 0).reduce((a, b) => a + b, 0)).toBe(4);
  });

  it('takes the header battle figure from GAMES_PLAYED, then from the 20 file', () => {
    const fromNineteen = vehicleStats.buildVehicleView(allFiles(), {
      title: 'wowp',
      battleType: null,
    });
    // RESEARCH Pitfall 9: the Warplanes account file spells its battle count
    // GAMES_PLAYED, so a header resolved only on BATTLES_COUNT would read "not
    // in export" on every Warplanes account.
    expect(numberOf(fromNineteen.header?.battles ?? { t: 'x', v: 'missing' })).toBe(4);

    const withoutNineteen = new Map(allFiles());
    withoutNineteen.set('wowp_19_account_statistics.csv', { groups: [], seen: true });
    const fromTwenty = vehicleStats.buildVehicleView(withoutNineteen, {
      title: 'wowp',
      battleType: null,
    });
    // The fallback is the 20 account file, which spells it BATTLES: 8.
    expect(numberOf(fromTwenty.header?.battles ?? { t: 'x', v: 'missing' })).toBe(8);
  });
});

describe('05-05 the default title and the title states', () => {
  it('picks the first title with rows, and WoT when none has any', () => {
    expect(vehicleStats.buildVehicleView(allFiles(), { title: null, battleType: null }).title).toBe(
      'wot',
    );

    // WoT's files are there but hold no rows, so the pick moves to the next
    // title that has some.
    const noWotRows = new Map(allFiles());
    noWotRows.set('wot_vehicle_statistics.csv', { groups: [], seen: true });
    expect(vehicleStats.buildVehicleView(noWotRows, { title: null, battleType: null }).title).toBe(
      'wotb',
    );

    // Nothing anywhere: WoT, because the selector opens on it rather than on
    // nothing at all.
    const empty = filesFrom(['WOWS_Crews.csv']);
    expect(vehicleStats.buildVehicleView(empty, { title: null, battleType: null }).title).toBe(
      'wot',
    );
  });

  it('reports the four titles in the fixture with their row counts', () => {
    const view = vehicleStats.buildVehicleView(allFiles(), { title: null, battleType: null });
    const expected = fixtures.PLAYER_STATS_EXPECTED.titles;

    expect(view.overview).toEqual([
      { title: 'wot', present: true, rows: expected.wot.vehicleRows },
      { title: 'wotb', present: true, rows: expected.blitz.vehicleRows },
      { title: 'wows', present: true, rows: expected.warships.vehicleRows },
      { title: 'wowp', present: true, rows: expected.warplanes.vehicleRows },
    ]);
  });

  it('gives an absent or empty title the view defaults and nothing else', () => {
    const absent = vehicleStats.buildVehicleView(filesFrom(['WOWS_Crews.csv']), {
      title: 'wowp',
      battleType: null,
    });
    expect(absent.titleState).toBe('not-in-export');
    expect(absent.columns.map((column) => column.key)).toEqual([
      'vehicle',
      'battles',
      'winRate',
      'avgDamage',
      'frags',
      'xp',
    ]);
    expect(absent.rows).toEqual([]);
    expect(absent.summary).toEqual([]);
    expect(absent.battleTypes).toEqual([]);
    expect(absent.wowp20).toBeNull();
    expect(absent.header).toBeNull();

    const noRows = new Map(allFiles());
    noRows.set('wows_ship_statistics.csv', { groups: [], seen: true });
    const empty = vehicleStats.buildVehicleView(noRows, { title: 'wows', battleType: null });
    expect(empty.titleState).toBe('no-rows');
    expect(empty.rows).toEqual([]);
    expect(empty.summary).toEqual([]);
    // The header is still real, because the account file still has its row.
    expect(numberOf(empty.header?.battles ?? { t: 'x', v: 'missing' })).toBe(9);
  });
});

/**
 * Wrap every row of the named files in a Proxy that records what was read.
 *
 * The instrument has to be live before it can be trusted, so the canary
 * assertion is paired with one that points the same trap at the value it is
 * meant to catch (the shape plan 05-04 used on the payments columns).
 */
function watchFiles(
  files: VehicleFiles,
  names: readonly string[],
): {
  files: VehicleFiles;
  readsByFile: Map<string, Set<string>>;
  listingsByFile: Map<string, number[]>;
} {
  const watched = new Map(files);
  const readsByFile = new Map<string, Set<string>>();
  const listingsByFile = new Map<string, number[]>();

  for (const name of names) {
    const facts = files.get(name);
    if (facts === undefined) continue;
    const reads = new Set<string>();
    const listings: number[] = [];
    const rows = facts.groups
      .flatMap((group) => group.rows)
      .map((row, index) => {
        listings[index] = 0;
        return new Proxy(row, {
          get(target, property, receiver) {
            if (typeof property === 'string') reads.add(property);
            return Reflect.get(target, property, receiver);
          },
          ownKeys(target) {
            listings[index] = (listings[index] ?? 0) + 1;
            return Reflect.ownKeys(target);
          },
        });
      });
    watched.set(name, { groups: oneAccount(rows), seen: facts.seen });
    readsByFile.set(name, reads);
    listingsByFile.set(name, listings);
  }

  return { files: watched, readsByFile, listingsByFile };
}

/** A three-row account file, so the one-listing rule has later rows to skip. */
const MULTI_ROW_ACCOUNT_CSV = fixtures.renderStatsCsv('NAME;BATTLES_COUNT;PREMIUM_EXPIRY_TIME', [
  [fixtures.STATS_NAME_CANARY, '10', '2021-01-01 00:00:00'],
  [fixtures.STATS_NAME_CANARY, '20', '2021-02-01 00:00:00'],
  [fixtures.STATS_NAME_CANARY, '30', '2021-03-01 00:00:00'],
]);

describe('05-05 the account NAME canary and the one-listing rule', () => {
  const ACCOUNT_NAMES = [
    'wot_account_statistics.csv',
    'wotb_account_statistics.csv',
    'wows_account_statistics.csv',
    'wowp_19_account_statistics.csv',
    'wowp_20_account_statistics.csv',
  ] as const;

  it('reads only the two named columns of the account file, on every title', () => {
    const files = allFiles();
    // A Blitz account file with three rows, so "only the first row is listed"
    // is a claim about rows 2 and 3 rather than a vacuous one.
    files.set('wotb_account_statistics.csv', {
      groups: oneAccount(
        parseCsvFile(MULTI_ROW_ACCOUNT_CSV, CATEGORY, 'WOTB_Account_Statistics.csv').rows.map(
          (row) => row.data,
        ),
      ),
      seen: true,
    });

    const watched = watchFiles(files, ACCOUNT_NAMES);
    for (const title of shared.VEHICLE_TITLES) {
      vehicleStats.buildVehicleView(watched.files, { title, battleType: null });
    }

    for (const name of ACCOUNT_NAMES) {
      const reads = watched.readsByFile.get(name);
      const listings = watched.listingsByFile.get(name);
      expect(reads === undefined, `${name} was watched`).toBe(false);
      if (reads === undefined || listings === undefined) continue;

      // The nickname is never read. Phase 3 D-21 confines it to the identity
      // header, and this builder is not that header (T-05-12).
      expect(`${name}:${reads.has('NAME')}`).toBe(`${name}:false`);
      // Exactly the resolved battle-count and expiry keys, and nothing else:
      // there is no "pass the whole row" helper here for a value to slip
      // through.
      expect([...reads].sort()).toEqual(
        ['BATTLES', 'BATTLES_COUNT', 'GAMES_PLAYED', 'PREMIUM_EXPIRES_AT', 'PREMIUM_EXPIRY_TIME']
          .filter((candidate) => reads.has(candidate))
          .sort(),
      );
      // The first row's key list is read AT MOST ONCE, to resolve the header
      // names, and no later row is enumerated at all. Zero is a legitimate
      // count: the Warplanes 20 account file is the FALLBACK, so when the 19
      // file has a row this one is not read at all — which is the stronger
      // outcome, not a missing one.
      expect(`${name}:${(listings[0] ?? 0) <= 1}`).toBe(`${name}:true`);
      expect(`${name}:${listings.slice(1).every((count) => count === 0)}`).toBe(`${name}:true`);
    }

    // The account file that supplied the header read its two columns; the
    // fallback beside it was never touched.
    expect([...(watched.readsByFile.get('wowp_19_account_statistics.csv') ?? [])].sort()).toEqual([
      'GAMES_PLAYED',
      'PREMIUM_EXPIRY_TIME',
    ]);
    expect([...(watched.readsByFile.get('wowp_20_account_statistics.csv') ?? [])]).toEqual([]);
  });

  it('proves the canary is live by reading the nickname on purpose', () => {
    const watched = watchFiles(allFiles(), ['wot_account_statistics.csv']);
    const first = watched.files.get('wot_account_statistics.csv')?.groups[0]?.rows[0];

    // If the trap were dead the assertions above would be vacuous, so the same
    // instrument is pointed at the value it is meant to catch.
    expect(first?.['NAME']).toBe(fixtures.STATS_NAME_CANARY);
    expect(watched.readsByFile.get('wot_account_statistics.csv')?.has('NAME')).toBe(true);
  });

  it('keeps the nickname out of every serialised view of every title and code', () => {
    const files = allFiles();
    const serialised: string[] = [];

    for (const title of shared.VEHICLE_TITLES) {
      const all = vehicleStats.buildVehicleView(files, { title, battleType: null });
      serialised.push(JSON.stringify(all));
      for (const code of all.battleTypes) {
        serialised.push(
          JSON.stringify(vehicleStats.buildVehicleView(files, { title, battleType: code })),
        );
      }
    }

    expect(serialised.length).toBeGreaterThan(4);
    for (const text of serialised) {
      expect(text.includes(fixtures.STATS_NAME_CANARY)).toBe(false);
    }
  });
});

describe('05-05 defensive parsing over drifted headers', () => {
  /** A one-file export around a main vehicle file the test writes itself. */
  function withMainFile(csv: string): VehicleFiles {
    const files = filesFrom(['WOT_Account_Statistics.csv']);
    files.set('wot_vehicle_statistics.csv', {
      groups: oneAccount(
        parseCsvFile(csv, CATEGORY, 'WOT_Vehicle_Statistics.csv').rows.map((row) => row.data),
      ),
      seen: true,
    });
    return files;
  }

  const RIG_ROW: readonly string[] = ['nation:Rig', '', '10', '5', '1000', '3', '900'];

  it('maps by the first row keys when a later row carries extra columns', () => {
    const csv = fixtures.renderStatsCsv(fixtures.WOT_MAIN_HEADER, [
      RIG_ROW,
      // A ragged row: three cells past the header, which a real export does
      // write and the parser does preserve as an extra field.
      [...RIG_ROW, 'extra1', 'extra2', 'extra3'],
    ]);
    const view = vehicleStats.buildVehicleView(withMainFile(csv), {
      title: 'wot',
      battleType: null,
    });

    expect(view.titleState).toBe('ready');
    expect(view.rows).toHaveLength(2);
    const row = view.rows[1]!;
    expect(row.id).toBe('Rig');
    expect(row.battles).toBe(10);
    // The extra cells changed nothing: a later row's keys cannot remap a column.
    expect(oracleShape(cellOf(view, row, 'winRate'))).toBe(50);
    expect(oracleShape(cellOf(view, row, 'avgDamage'))).toBe(100);
  });

  it('maps a padded and lower-cased header', () => {
    const csv = fixtures.renderStatsCsv('  vehicle_name ;battles_count; WINS_COUNT;damage_dealt', [
      ['germany:Rig', '8', '2', '400'],
    ]);
    const view = vehicleStats.buildVehicleView(withMainFile(csv), {
      title: 'wot',
      battleType: null,
    });

    const row = view.rows[0]!;
    expect(row.id).toBe('Rig');
    expect(row.nation).toBe('germany');
    expect(row.battles).toBe(8);
    expect(oracleShape(cellOf(view, row, 'winRate'))).toBe(25);
    // Frags and XP are not in this header, so their core columns are still
    // there and every cell is "not in export" rather than a zero.
    expect(specialOf(cellOf(view, row, 'frags'))).toBe('missing');
  });

  it('reports a missing wins column as not in export, not as zero and not an error', () => {
    const csv = fixtures.renderStatsCsv('VEHICLE_NAME;BATTLES_COUNT;DAMAGE_DEALT', [
      ['usa:Rig', '10', '2000'],
    ]);
    const view = vehicleStats.buildVehicleView(withMainFile(csv), {
      title: 'wot',
      battleType: null,
    });

    const row = view.rows[0]!;
    expect(specialOf(cellOf(view, row, 'winRate'))).toBe('missing');
    // The column is still listed: the table says the export does not have it
    // rather than silently dropping a heading.
    expect(view.columns.map((column) => column.key)).toContain('winRate');
    // Average damage is computable and is not dragged down by the missing wins.
    expect(oracleShape(cellOf(view, row, 'avgDamage'))).toBe(200);
  });

  it('answers a file that is a bare header with no rows', () => {
    const csv = fixtures.renderStatsCsv(fixtures.WOT_MAIN_HEADER, []);
    const view = vehicleStats.buildVehicleView(withMainFile(csv), {
      title: 'wot',
      battleType: null,
    });

    expect(view.titleState).toBe('no-rows');
    expect(view.rows).toEqual([]);
  });
});

describe('05-05 hostile ids, clamps and the 5,000-row ceiling', () => {
  it('carries hostile ids through as ordinary strings and writes nothing to a prototype', () => {
    const before = Object.getOwnPropertyNames(Object.prototype).length;
    const view = vehicleStats.buildVehicleView(allFiles(), { title: 'wot', battleType: null });

    const proto = rowsByRawId(view).get('__proto__');
    expect(proto?.id).toBe('__proto__');
    expect(proto?.battles).toBe(3);
    // The markup-bearing id is plain text in a cell: never markup, never a
    // selector this app reads back (T-05-03).
    expect(rowsByRawId(view).get('china:Ch99_<b>bold_markup')?.id).toBe('Ch99_<b>bold_markup');

    // Grouping is a Map, so neither id ever became a property of anything.
    expect(Object.getOwnPropertyNames(Object.prototype).length).toBe(before);
    expect(({} as Record<string, unknown>)['__proto__']).toBe(Object.prototype);
    expect(Object.prototype).not.toHaveProperty('Ch24_Type64');
  });

  it('clamps a 500-character vehicle name to 200 characters', () => {
    const csv = fixtures.renderStatsCsv('VEHICLE_NAME;BATTLES_COUNT', [['x'.repeat(500), '3']]);
    const view = vehicleStats.buildVehicleView(withRaggedMain(csv), {
      title: 'wot',
      battleType: null,
    });

    expect(view.rows[0]?.id).toBe('x'.repeat(200));
  });

  it('clamps a 500-character battle-type code to 64 characters', () => {
    const long = 'c'.repeat(500);
    const csv = fixtures.renderStatsCsv('VEHICLE_NAME;TYPE;BATTLES_COUNT;WINS;DAMAGE_DEALT', [
      ['nation:Rig', long, '4', '2', '800'],
    ]);
    const files = allFiles();
    files.set('wot_vehicle_statistics_by_type.csv', {
      groups: oneAccount(
        parseCsvFile(csv, CATEGORY, 'WOT_Vehicle_Statistics_by_Type.csv').rows.map(
          (row) => row.data,
        ),
      ),
      seen: true,
    });
    const view = vehicleStats.buildVehicleView(files, { title: 'wot', battleType: null });

    expect(view.battleTypes).toEqual(['c'.repeat(64)]);
    // A code the caller echoes back is matched against the CLAMPED string, so a
    // selection copied out of the untruncated cell is not silently applied.
    const applied = vehicleStats.buildVehicleView(files, { title: 'wot', battleType: long });
    expect(applied.battleType).toBe(null);
  });

  it('builds five thousand vehicles inside a one-second ceiling', () => {
    const expected = fixtures.vehicleScaleExpected(fixtures.VEHICLE_SCALE_5K_SPEC);
    // The file is parsed OUTSIDE the timed region: this is the builder's cost,
    // not the reader's, and an O(n squared) map is what the ceiling is for.
    const files = withRaggedMain(fixtures.generateVehicleMainCsv(fixtures.VEHICLE_SCALE_5K_SPEC));

    const started = performance.now();
    const view = vehicleStats.buildVehicleView(files, { title: 'wot', battleType: null });
    const elapsed = performance.now() - started;

    expect(view.rows).toHaveLength(expected.rowCount);
    expect(view.rows.filter((row) => row.battles === 0)).toHaveLength(expected.zeroBattleCount);
    expect(Math.max(...view.rows.map((row) => row.battles ?? 0))).toBe(expected.largestBattles);
    expect(elapsed).toBeLessThan(1_000);
  });
});

/**
 * An export holding one WoT main file the test supplies, plus the WoT account
 * file so the title is `ready` rather than `not-in-export`.
 */
function withRaggedMain(csv: string): VehicleFiles {
  const files = filesFrom(['WOT_Account_Statistics.csv']);
  files.set('wot_vehicle_statistics.csv', {
    groups: oneAccount(
      parseCsvFile(csv, CATEGORY, 'WOT_Vehicle_Statistics.csv').rows.map((r) => r.data),
    ),
    seen: true,
  });
  return files;
}

// =============================================================================
// 09-07 CR-01 — two accounts, one file name, two different headers
// =============================================================================
//
// Written against the MERGED shape on purpose: one flat row list whose second
// half is spelled differently from its first half is exactly what the pre-09-07
// reader handed over, and it fails here for the reason the verification report
// names — `resolveFields(rows[0], ...)` resolves off the first account's header,
// so the second account's `VEHICLE_NAME` reads as absent and
// `splitVehicleId(undefined)` yields an empty id.
// =============================================================================

describe('09-07 CR-01: a file two accounts contribute under different headers', () => {
  /**
   * Two groups of one file name, the way the reader hands them over.
   *
   * The FIRST group writes `GAMES_PLAYED` where the export writes
   * `BATTLES_COUNT`. Both spellings are accepted, so resolving off the MERGED
   * bucket's first row read every canonical row through this account's key and
   * found nothing — which is how a real value became a "not in export" cell.
   */
  function divergentFiles(): VehicleFiles {
    const renamed = parseCsvFile(
      fixtures.renderStatsCsv(MA_DIVERGENT_VEHICLE_HEADER, [
        [
          MA_DIVERGENT_VEHICLE_RENAMED,
          '2021-09-30 18:00:00',
          '100',
          '55',
          '120000',
          '150',
          '90000',
        ],
      ]),
      CATEGORY,
      'WOT_Vehicle_Statistics.csv',
    ).rows.map((row) => row.data);
    const canonical = parseCsvFile(
      fixtures.renderStatsCsv(WOT_MAIN_HEADER, [
        [
          MA_DIVERGENT_VEHICLE_CANONICAL,
          '2021-08-01 12:00:00',
          '100',
          '55',
          '120000',
          '150',
          '90000',
        ],
      ]),
      CATEGORY,
      'WOT_Vehicle_Statistics.csv',
    ).rows.map((row) => row.data);

    const files = filesFrom(['WOT_Account_Statistics.csv']);
    files.set('wot_vehicle_statistics.csv', {
      groups: [
        { account: 'renamed', rows: renamed },
        { account: 'canonical', rows: canonical },
      ],
      seen: true,
    });
    return files;
  }

  it('gives each account its own name and its own battle count', () => {
    const view = vehicleStats.buildVehicleView(divergentFiles(), {
      title: 'wot',
      battleType: null,
    });
    expect(view.rows).toHaveLength(2);
    const byId = new Map(view.rows.map((row) => [row.id, row]));

    // No row of a file that is in the archive carries the empty name
    // `splitVehicleId(undefined)` produces.
    expect(view.rows.map((row) => row.id)).not.toContain('');
    expect(byId.get('SynthDivergentTank-Canonical')!.battles).toBe(100);
    expect(byId.get('SynthDivergentTank-Renamed')!.battles).toBe(100);
  });

  it('never blanks one account rows because another account header lacks its columns', () => {
    // The first group declares NO vehicle column at all — a by_Type-shaped
    // header under the main file's name, which is the shape that produced the
    // empty-name bug. Its OWN rows are honestly unnamed; the SECOND account's
    // rows, which do declare `VEHICLE_NAME`, must keep their names.
    const files = filesFrom(['WOT_Account_Statistics.csv']);
    files.set('wot_vehicle_statistics.csv', {
      groups: [
        {
          account: 'headerless',
          rows: [{ TYPE: '1', BATTLES_COUNT: '7' }],
        },
        {
          account: 'canonical',
          rows: [
            {
              VEHICLE_NAME: MA_DIVERGENT_VEHICLE_CANONICAL,
              BATTLES_COUNT: '12',
              WINS_COUNT: '3',
              DAMAGE_DEALT: '900',
              FRAGS_COUNT: '4',
              XP_AMOUNT: '1500',
            },
          ],
        },
      ],
      seen: true,
    });

    const view = vehicleStats.buildVehicleView(files, { title: 'wot', battleType: null });
    const canonical = view.rows.find((row) => row.id === 'SynthDivergentTank-Canonical');
    expect(canonical, 'the account that declares the column is not blanked').toBeDefined();
    expect(canonical!.battles).toBe(12);
  });
});

// =============================================================================
// Phase 10, D-10 / T-10-10 — the row's account comes from the OWNING GROUP
// =============================================================================
//
// `VehicleRow.account` decides which letter a row wears in every pane, so a
// wrong owner is a wrong attribution of somebody's own data. It cannot come
// from a cell: no cell of a vehicle file carries an account, and a file named
// `__proto__` is a hostile string that a group-keyed `Map` handles as an
// ordinary key.

describe('Phase 10: every row names its owning account', () => {
  it('two accounts with the SAME vehicle file yield two rows, two accounts', () => {
    const header = 'VEHICLE_NAME;BATTLES_COUNT;WINS_COUNT;DAMAGE_DEALT;FRAGS_COUNT;XP_AMOUNT';
    const rows = (battles: string) =>
      parseCsvFile(
        fixtures.renderStatsCsv(header, [['synth:SynthTwin', battles, '5', '1000', '3', '9000']]),
        CATEGORY,
        'WOT_Vehicle_Statistics.csv',
      ).rows.map((entry) => entry.data);

    const files = filesFrom(['WOT_Account_Statistics.csv']);
    files.set('wot_vehicle_statistics.csv', {
      groups: [
        { account: '2000002', rows: rows('11') },
        { account: '500000001', rows: rows('22') },
      ],
      seen: true,
    });

    const view = vehicleStats.buildVehicleView(files, { title: 'wot', battleType: null });

    // D-09: a vehicle both accounts own stays TWO rows, one per account.
    expect(view.rows).toHaveLength(2);
    expect(view.rows.every((row) => row.id === 'SynthTwin')).toBe(true);
    // And each row carries ITS OWN group's root, not the first one's and not a
    // cell's. Asserting the PAIR is the point: an implementation that stamped
    // the first group twice would still produce two rows.
    expect(view.rows.map((row) => row.account).sort()).toEqual(['2000002', '500000001']);
    // The battle counts are the two accounts' own, which is the control that
    // the two rows really are different rows rather than one row twice.
    expect(view.rows.map((row) => row.battles).sort()).toEqual([11, 22]);
  });

  it('an account root named __proto__ is an ordinary owner', () => {
    const header = 'VEHICLE_NAME;BATTLES_COUNT;WINS_COUNT;DAMAGE_DEALT;FRAGS_COUNT;XP_AMOUNT';
    const rows = parseCsvFile(
      fixtures.renderStatsCsv(header, [['synth:SynthProto', '5', '1', '100', '0', '500']]),
      CATEGORY,
      'WOT_Vehicle_Statistics.csv',
    ).rows.map((entry) => entry.data);

    const files = filesFrom(['WOT_Account_Statistics.csv']);
    files.set('wot_vehicle_statistics.csv', {
      groups: [{ account: '__proto__', rows }],
      seen: true,
    });

    const view = vehicleStats.buildVehicleView(files, { title: 'wot', battleType: null });
    expect(view.rows[0]?.account).toBe('__proto__');
  });

  it('a battle-type view stamps the by_Type group too', () => {
    // The second of the two row loops. A stamped main-table row and an unstamped
    // by_Type row would make the same vehicle carry different letters depending
    // on which code was selected.
    const files = allFiles();
    const view = vehicleStats.buildVehicleView(files, { title: 'wot', battleType: '1' });
    expect(view.rows.length).toBeGreaterThan(0);
    for (const row of view.rows) {
      expect(row.account, 'every by_Type row names its account').toBe('test-account');
    }
  });
});

// =============================================================================
// Phase 10, D-09 / D-20 — the summary folds across accounts, the header sums
// =============================================================================
//
// Two things happen at once here and they went DIFFERENT WAYS, which is the
// point: the vehicle ROWS stay one per account (a vehicle two accounts own is
// two rows), while the battle-type SUMMARY and the header's lifetime battles
// add the accounts together. The expiry does NOT: with two accounts there is no
// honest combined expiry, so the term is dropped rather than filled (T-10-11).

describe('Phase 10: accounts combine', () => {
  /** One by-type battle file, parsed, with the given rows per account. */
  function battleTypeRows(cells: readonly (readonly string[])[]): VehicleRowData[] {
    return parseCsvFile(
      fixtures.renderStatsCsv('TYPE;BATTLES_COUNT;WINS_COUNT;DAMAGE_DEALT', cells),
      CATEGORY,
      'WOT_Battle_Types_Statistics.csv',
    ).rows.map((row) => row.data);
  }

  /** An account file with one row: `battles` battles and this expiry. */
  function accountRows(battles: string, expiry = '2021-01-01 00:00:00'): VehicleRowData[] {
    return parseCsvFile(
      fixtures.renderStatsCsv('NAME;BATTLES_COUNT;PREMIUM_EXPIRY_TIME', [
        ['CanaryName', battles, expiry],
      ]),
      CATEGORY,
      'WOT_Account_Statistics.csv',
    ).rows.map((row) => row.data);
  }

  /** A vehicle file with one row, so the title is `ready`. */
  function vehicleRows(): VehicleRowData[] {
    return parseCsvFile(
      fixtures.renderStatsCsv(
        'VEHICLE_NAME;BATTLES_COUNT;WINS_COUNT;DAMAGE_DEALT;FRAGS_COUNT;XP_AMOUNT',
        [['synth:SynthTank', '5', '2', '900', '1', '4000']],
      ),
      CATEGORY,
      'WOT_Vehicle_Statistics.csv',
    ).rows.map((row) => row.data);
  }

  /**
   * The by_Type file, which is what makes the title `ready` AND supplies the
   * code list the summary is gated on. Without it the view has no codes, and
   * `buildSummary` returns nothing — RESEARCH Pitfall 10's "the summary is a
   * DIFFERENT list" is why a battle-types file alone would not be enough.
   */
  function byTypeRows(): VehicleRowData[] {
    return parseCsvFile(
      fixtures.renderStatsCsv('TYPE;BATTLES_COUNT;DAMAGE_DEALT', [['1', '5', '900']]),
      CATEGORY,
      'WOT_Vehicle_Statistics_by_Type.csv',
    ).rows.map((row) => row.data);
  }

  /**
   * The WoT files with `groups` contributing the summary's codes.
   *
   * A MUTABLE map, not `VehicleFiles`, because several tests below add the
   * account file afterwards — which is what D-20 is about. It is still passed
   * straight into `buildVehicleView`, which takes the readonly type.
   */
  function wotWithBattleTypes(
    groups: readonly AccountRowGroup<VehicleRowData>[],
  ): Map<string, VehicleFileFacts> {
    const files = new Map<string, VehicleFileFacts>();
    files.set('wot_vehicle_statistics.csv', {
      groups: [{ account: '2000002', rows: vehicleRows() }],
      seen: true,
    });
    files.set('wot_vehicle_statistics_by_type.csv', {
      groups: [{ account: '2000002', rows: byTypeRows() }],
      seen: true,
    });
    files.set('wot_battle_types_statistics.csv', { groups, seen: true });
    return files;
  }

  it('two accounts writing the same codes yield ONE summary row each, summed', () => {
    const view = vehicleStats.buildVehicleView(
      wotWithBattleTypes([
        {
          account: '2000002',
          rows: battleTypeRows([
            ['1', '10', '4', '1000'],
            ['2', '5', '1', '500'],
          ]),
        },
        {
          account: '500000001',
          rows: battleTypeRows([
            ['1', '7', '3', '400'],
            ['2', '3', '0', '200'],
          ]),
        },
      ]),
      { title: 'wot', battleType: null },
    );

    expect(view.summary).toHaveLength(2);
    // Code 1: battles 10 + 7, wins 4 + 3, damage 1000 + 400. The code-2 row
    // has fewer battles, so the sort still puts code 1 first — the old order.
    expect(view.summary[0]?.code).toBe('1');
    expect(view.summary[0]?.battles).toEqual({ t: 'n', v: 17 });
    expect(view.summary[0]?.wins).toEqual({ t: 'n', v: 7 });
    expect(view.summary[0]?.damage).toEqual({ t: 'n', v: 1400 });
    expect(view.summary[1]?.code).toBe('2');
    expect(view.summary[1]?.battles).toEqual({ t: 'n', v: 8 });
  });

  it('a numeric cell in one account and a special in the other sums the numeric one', () => {
    // `N/A` is not a number and is not a zero (D-09): the other account's 10
    // is the answer, and it is NOT `10 + 0` dressed up as a count.
    const view = vehicleStats.buildVehicleView(
      wotWithBattleTypes([
        { account: '2000002', rows: battleTypeRows([['1', '10', 'N/A', '1000']]) },
        { account: '500000001', rows: battleTypeRows([['1', 'N/A', '3', '400']]) },
      ]),
      { title: 'wot', battleType: null },
    );

    expect(view.summary).toHaveLength(1);
    expect(view.summary[0]?.battles, 'the numeric side wins the fold').toEqual({ t: 'n', v: 10 });
    // The wins figure is the mirror image: special first, number second.
    expect(view.summary[0]?.wins, 'a later number still counts').toEqual({ t: 'n', v: 3 });
    expect(view.summary[0]?.damage).toEqual({ t: 'n', v: 1400 });
  });

  it('a code whose cells are ALL specials keeps the FIRST special', () => {
    const view = vehicleStats.buildVehicleView(
      wotWithBattleTypes([
        { account: '2000002', rows: battleTypeRows([['1', 'N/A', 'N/D', 'N/A']]) },
        { account: '500000001', rows: battleTypeRows([['1', 'N/D', 'N/A', 'N/D']]) },
      ]),
      { title: 'wot', battleType: null },
    );

    expect(view.summary).toHaveLength(1);
    // The FIRST account's `not available`, not the second's `not defined` —
    // picking the later one would make the answer depend on the order the
    // archive happened to list its folders in.
    expect(view.summary[0]?.battles).toEqual({ t: 'x', v: 'na' });
    expect(view.summary[0]?.wins).toEqual({ t: 'x', v: 'nd' });
    expect(view.summary[0]?.damage).toEqual({ t: 'x', v: 'na' });
  });

  it('a code named __proto__ is an ordinary code', () => {
    // The code is an untrusted cell, so the fold is a `Map`. An object would
    // have dropped this row on assignment (T-10-09).
    const view = vehicleStats.buildVehicleView(
      wotWithBattleTypes([
        { account: '2000002', rows: battleTypeRows([['__proto__', '10', '4', '1000']]) },
        { account: '500000001', rows: battleTypeRows([['__proto__', '5', '1', '100']]) },
      ]),
      { title: 'wot', battleType: null },
    );

    expect(view.summary).toHaveLength(1);
    expect(view.summary[0]?.code).toBe('__proto__');
    expect(view.summary[0]?.battles).toEqual({ t: 'n', v: 15 });
  });

  it('one account produces exactly the rows it produced before', () => {
    const view = vehicleStats.buildVehicleView(
      wotWithBattleTypes([
        {
          account: '2000002',
          rows: battleTypeRows([
            ['1', '10', '4', '1000'],
            ['2', '5', 'N/A', '500'],
          ]),
        },
      ]),
      { title: 'wot', battleType: null },
    );

    expect(view.summary.map((row) => row.code)).toEqual(['1', '2']);
    expect(view.summary[0]?.battles).toEqual({ t: 'n', v: 10 });
    // The fold is the identity on a single contribution: the special survives
    // as itself, not as a zero and not as the first numeric thing nearby.
    expect(view.summary[1]?.wins).toEqual({ t: 'x', v: 'na' });
  });

  it('two accounts: the header sums battles and shows NO expiry (D-20)', () => {
    const files = wotWithBattleTypes([
      { account: '2000002', rows: battleTypeRows([['1', '10', '4', '1000']]) },
    ]);
    files.set('wot_account_statistics.csv', {
      groups: [
        { account: '2000002', rows: accountRows('100', '2021-01-01 00:00:00') },
        { account: '500000001', rows: accountRows('250', '2030-06-06 00:00:00') },
      ],
      seen: true,
    });

    const view = vehicleStats.buildVehicleView(files, { title: 'wot', battleType: null });
    expect(view.header).not.toBeNull();
    expect(view.header!.battles).toEqual({ t: 'n', v: 350 });
    // T-10-11: never one account's expiry as the combined figure, and never a
    // fabricated combination of two.
    expect(view.header!.premiumExpires).toBeNull();
  });

  it('one account: the header is exactly what v1.0 showed, expiry and all', () => {
    const files = wotWithBattleTypes([
      { account: '2000002', rows: battleTypeRows([['1', '10', '4', '1000']]) },
    ]);
    files.set('wot_account_statistics.csv', {
      groups: [{ account: '2000002', rows: accountRows('100', '2021-01-01 00:00:00') }],
      seen: true,
    });

    const view = vehicleStats.buildVehicleView(files, { title: 'wot', battleType: null });
    expect(view.header!.battles).toEqual({ t: 'n', v: 100 });
    expect(view.header!.premiumExpires).toEqual({ t: 's', v: '2021-01-01 00:00:00' });
  });

  it('a data-less account is not a contributor', () => {
    // The account file carries THREE rows for one account and none for the
    // second. The second must not count toward "two accounts contribute",
    // because it contributed nothing at all (D-20 is about CONTRIBUTORS).
    const files = wotWithBattleTypes([
      { account: '2000002', rows: battleTypeRows([['1', '10', '4', '1000']]) },
    ]);
    files.set('wot_account_statistics.csv', {
      groups: [{ account: '2000002', rows: accountRows('100', '2021-01-01 00:00:00') }],
      seen: true,
    });

    const view = vehicleStats.buildVehicleView(files, { title: 'wot', battleType: null });
    expect(view.header!.battles).toEqual({ t: 'n', v: 100 });
    expect(view.header!.premiumExpires, 'one contributor means the expiry is still shown').toEqual({
      t: 's',
      v: '2021-01-01 00:00:00',
    });
  });

  it('an account with several rows contributes its FIRST row, once', () => {
    // The one-listing rule (T-05-12) meets D-20: the second row's 900 battles
    // are not added, or the header would claim more than the account's own
    // first record says.
    const files = wotWithBattleTypes([
      { account: '2000002', rows: battleTypeRows([['1', '10', '4', '1000']]) },
    ]);
    files.set('wot_account_statistics.csv', {
      groups: [
        {
          account: '2000002',
          rows: parseCsvFile(
            MULTI_ROW_ACCOUNT_CSV,
            CATEGORY,
            'WOT_Account_Statistics.csv',
          ).rows.map((row) => row.data),
        },
      ],
      seen: true,
    });

    const view = vehicleStats.buildVehicleView(files, { title: 'wot', battleType: null });
    expect(view.header!.battles, 'the first row is the account figure').toEqual({ t: 'n', v: 10 });
  });

  it('the Warplanes preference list still picks the 19 file per account', () => {
    // WoWP is the one title with TWO account files. Each account contributes
    // through the 19 file it has a row for, and the 20 file never adds a second
    // contribution for the same account.
    const accounts = (battles: string) =>
      parseCsvFile(
        fixtures.renderStatsCsv('NAME;BATTLES_COUNT;PREMIUM_EXPIRY_TIME', [
          ['Canary', battles, 'N/A'],
        ]),
        CATEGORY,
        'WOWP_19_Account_Statistics.csv',
      ).rows.map((row) => row.data);
    const twenty = (battles: string) =>
      parseCsvFile(
        fixtures.renderStatsCsv('NAME;BATTLES_COUNT;PREMIUM_EXPIRY_TIME', [
          ['Canary', battles, 'N/A'],
        ]),
        CATEGORY,
        'WOWP_20_Account_Statistics.csv',
      ).rows.map((row) => row.data);
    const plane = (name: string) =>
      parseCsvFile(
        fixtures.renderStatsCsv('NAME;BATTLES_COUNT;DAMAGE_DEALT;WINS_COUNT', [
          [name, '1', 'N/D', '0'],
        ]),
        CATEGORY,
        'WOWP_19_Plane_Statistics.csv',
      ).rows.map((row) => row.data);

    const files = new Map<string, VehicleFileFacts>();
    files.set('wowp_19_plane_statistics.csv', {
      groups: [
        { account: '2000002', rows: plane('synth:SynthPlane') },
        { account: '500000001', rows: plane('synth:SynthPlane') },
      ],
      seen: true,
    });
    files.set('wowp_19_account_statistics.csv', {
      groups: [
        { account: '2000002', rows: accounts('40') },
        { account: '500000001', rows: accounts('60') },
      ],
      seen: true,
    });
    // A 20 file the SAME accounts also have, with different numbers. If the
    // preference list were not consulted per account, these would be added.
    files.set('wowp_20_account_statistics.csv', {
      groups: [
        { account: '2000002', rows: twenty('4000') },
        { account: '500000001', rows: twenty('6000') },
      ],
      seen: true,
    });

    const view = vehicleStats.buildVehicleView(files, { title: 'wowp', battleType: null });
    expect(view.header!.battles, 'the 19 files sum, the 20 files do not add again').toEqual({
      t: 'n',
      v: 100,
    });
    expect(view.header!.premiumExpires, 'two contributors drop the expiry').toBeNull();
  });

  it('no account file at all is still no header', () => {
    const view = vehicleStats.buildVehicleView(
      wotWithBattleTypes([
        { account: '2000002', rows: battleTypeRows([['1', '10', '4', '1000']]) },
      ]),
      { title: 'wot', battleType: null },
    );
    expect(view.header).toBeNull();
  });
});

// =============================================================================
// Plan 11-10 Task 1 - the Warplanes account statistics block (D-02, GAMES-03)
// =============================================================================

const WOWP_19_ACCOUNT = 'wowp_19_account_statistics.csv';
const WOWP_20_ACCOUNT = 'wowp_20_account_statistics.csv';
type WowpFileKey =
  | 'wowp_19_plane_statistics.csv'
  | 'wowp_20_plane_statistics.csv'
  | typeof WOWP_19_ACCOUNT
  | typeof WOWP_20_ACCOUNT;

/** The headers the existing header owns, which the block must not repeat. */
const HEADER_OWNED = new Set([
  'BATTLES_COUNT',
  'BATTLES',
  'GAMES_PLAYED',
  'PREMIUM_EXPIRES_AT',
  'PREMIUM_EXPIRY_TIME',
]);

/** The spec headers of one account file, minus the header-owned ones, in spec order. */
function specHeaders(key: string): string[] {
  const spec = NEW_DATA_SPEC_FILES.find((file) => file.key === key)!;
  return spec.columns.map((column) => column.header).filter((header) => !HEADER_OWNED.has(header));
}

/** One stored account row: every spec header (owned ones too) holds `<tag>:<header>`. */
function accountRow(key: string, tag: string): VehicleRowData {
  const spec = NEW_DATA_SPEC_FILES.find((file) => file.key === key)!;
  return Object.fromEntries(
    spec.columns.map((column) => [column.header, `${tag}:${column.header}`]),
  );
}

/** Facts for the Warplanes files: only the named ones are in the map. */
function wowpFiles(
  entries: Partial<Record<WowpFileKey, VehicleFileFacts>>,
): Map<string, VehicleFileFacts> {
  return new Map(Object.entries(entries) as [string, VehicleFileFacts][]);
}

/** The serialised cell text, to compare a cell without caring about its tag. */
function cellValue(cell: VehicleCell): string {
  return cell.t === 'x' ? `x:${cell.v}` : `${cell.t}:${String(cell.v)}`;
}

describe('11-10: buildVehicleView wowpAccount for the Warplanes title', () => {
  it('lists one entry per account, each once, A from the 19 file and B from the 20 file', () => {
    const files = wowpFiles({
      [WOWP_19_ACCOUNT]: {
        groups: [{ account: 'A', rows: [accountRow(WOWP_19_ACCOUNT, 'a19')] }],
        seen: true,
      },
      [WOWP_20_ACCOUNT]: {
        groups: [
          { account: 'A', rows: [accountRow(WOWP_20_ACCOUNT, 'a20')] },
          { account: 'B', rows: [accountRow(WOWP_20_ACCOUNT, 'b20')] },
        ],
        seen: true,
      },
    });
    const view = vehicleStats.buildVehicleView(files, { title: 'wowp', battleType: null });
    expect(view.wowpAccount).not.toBeNull();
    const block = view.wowpAccount!;
    expect(block.skipped).toEqual([]);
    expect(block.accounts.map((entry) => entry.account)).toEqual(['A', 'B']);

    // Spec columns of the two files, merged by header, 19 first, minus the
    // header-owned battles and premium-expiry headers.
    const expected: string[] = [];
    for (const header of [...specHeaders(WOWP_19_ACCOUNT), ...specHeaders(WOWP_20_ACCOUNT)]) {
      if (!expected.includes(header)) expected.push(header);
    }
    expect(block.columns.map((column) => column.id)).toEqual(expected);
    for (const owned of HEADER_OWNED) {
      expect(block.columns.map((column) => column.id)).not.toContain(owned);
    }

    const [a, b] = block.accounts;
    const goldIndex = block.columns.findIndex((column) => column.id === 'GOLD');
    expect(cellValue(a!.cells[goldIndex]!)).toBe('s:a19:GOLD');
    expect(cellValue(b!.cells[goldIndex]!)).toBe('s:b20:GOLD');
    // A contributes once: nothing of A's 20 row is in its cells.
    expect(a!.cells.map(cellValue).some((text) => text.includes('a20:'))).toBe(false);
    for (const entry of block.accounts) expect(entry.cells).toHaveLength(block.columns.length);
  });

  it('takes the kind from the spec: number is a count, date is a date, the rest are text', () => {
    const files = wowpFiles({
      [WOWP_19_ACCOUNT]: {
        groups: [
          {
            account: 'A',
            rows: [
              {
                ...accountRow(WOWP_19_ACCOUNT, 'a'),
                SPOTTED: '1234',
                CREATED_AT: '01.02.2020 10:00',
              },
            ],
          },
        ],
        seen: true,
      },
    });
    const block = vehicleStats.buildVehicleView(files, {
      title: 'wowp',
      battleType: null,
    }).wowpAccount!;
    const kinds = new Map(block.columns.map((column) => [column.id, column.kind]));
    expect(kinds.get('SPOTTED')).toBe('count');
    expect(kinds.get('CREATED_AT')).toBe('date');
    expect(kinds.get('GOLD')).toBe('text');
    const row = block.accounts[0]!.cells;
    expect(row[block.columns.findIndex((column) => column.id === 'SPOTTED')]).toEqual({
      t: 'n',
      v: 1234,
    });
  });

  it('builds specials with the existing readers: N/A, N/D, a blank and a missing key', () => {
    const files = wowpFiles({
      [WOWP_19_ACCOUNT]: {
        groups: [
          {
            account: 'A',
            rows: [
              {
                ...accountRow(WOWP_19_ACCOUNT, 'a'),
                SPOTTED: 'N/A',
                SURVIVED: 'N/D',
                WINS: '',
              },
            ],
          },
        ],
        seen: true,
      },
    });
    const block = vehicleStats.buildVehicleView(files, {
      title: 'wowp',
      battleType: null,
    }).wowpAccount!;
    const cells = block.accounts[0]!.cells;
    const at = (id: string): VehicleCell => cells[block.columns.findIndex((c) => c.id === id)]!;
    expect(at('SPOTTED')).toEqual({ t: 'x', v: 'na' });
    expect(at('SURVIVED')).toEqual({ t: 'x', v: 'nd' });
    expect(at('WINS')).toEqual({ t: 'x', v: 'na' });
  });

  it('shows an account with no row in either account file as absent, and nothing at all as null', () => {
    const only19 = wowpFiles({
      [WOWP_19_ACCOUNT]: {
        groups: [
          { account: 'A', rows: [accountRow(WOWP_19_ACCOUNT, 'a')] },
          { account: 'B', rows: [] },
        ],
        seen: true,
      },
    });
    const view = vehicleStats.buildVehicleView(only19, { title: 'wowp', battleType: null });
    expect(view.wowpAccount!.accounts.map((entry) => entry.account)).toEqual(['A']);

    const none = vehicleStats.buildVehicleView(new Map(), { title: 'wowp', battleType: null });
    expect(none.wowpAccount).toBeNull();
    expect(none.titleState).toBe('not-in-export');
  });

  it('lists a seen, parsed, row-less file in skipped, and a view of only skipped files still has the block', () => {
    const files = wowpFiles({
      [WOWP_20_ACCOUNT]: { groups: [], seen: true, parsed: 3 },
    });
    const view = vehicleStats.buildVehicleView(files, { title: 'wowp', battleType: null });
    expect(view.wowpAccount).toEqual({ columns: [], accounts: [], skipped: [WOWP_20_ACCOUNT] });
  });

  it('does not call a file skipped when its parsed count is zero or unknown', () => {
    const files = wowpFiles({
      [WOWP_19_ACCOUNT]: { groups: [], seen: true, parsed: 0 },
      [WOWP_20_ACCOUNT]: { groups: [], seen: true },
    });
    const view = vehicleStats.buildVehicleView(files, { title: 'wowp', battleType: null });
    expect(view.wowpAccount).toBeNull();
  });

  it('is null for the other three titles even when Warplanes files are in the map', () => {
    const files = new Map([
      ...allFiles(),
      ...wowpFiles({
        [WOWP_19_ACCOUNT]: {
          groups: [{ account: 'A', rows: [accountRow(WOWP_19_ACCOUNT, 'a')] }],
          seen: true,
        },
      }),
    ]);
    for (const title of ['wot', 'wotb', 'wows'] as const) {
      expect(
        vehicleStats.buildVehicleView(files, { title, battleType: null }).wowpAccount,
      ).toBeNull();
    }
  });

  it('carries no nickname or non-column key even for an unnarrowed row with a canary column', () => {
    const files = wowpFiles({
      [WOWP_19_ACCOUNT]: {
        groups: [
          {
            account: 'A',
            rows: [
              {
                ...accountRow(WOWP_19_ACCOUNT, 'a'),
                NAME: 'CANARY-NICKNAME-WOWP',
                NICKNAME: 'CANARY-NICKNAME-WOWP',
                EMAIL: 'canary@example.invalid',
              },
            ],
          },
        ],
        seen: true,
      },
    });
    const view = vehicleStats.buildVehicleView(files, { title: 'wowp', battleType: null });
    const text = JSON.stringify(view);
    expect(text).not.toContain('CANARY');
    expect(text).not.toContain('example.invalid');
    const ids = new Set(view.wowpAccount!.columns.map((column) => column.id));
    for (const id of ids) expect(['NAME', 'NICKNAME', 'EMAIL']).not.toContain(id);
  });
});
