// =============================================================================
// The vehicle table model (phase 05, plan 05-09).
//
// WHY THIS FILE IS HERE
// Vitest runs with no DOM, so a decision that lived inside the Svelte table could
// not be tested at all. Sorting, searching, counting, windowing and column
// selection are therefore pure functions over the view plan 05-05 built, and plan
// 05-12 becomes wiring.
//
// THE ANSWERS COME FROM TWO INDEPENDENT PLACES
//   - the hand answer key in `tests/fixtures/player-stats-fixtures.ts`, whose
//     figures carry their arithmetic in the comment beside them;
//   - `tests/helpers/vehicle-oracle.ts`, which recomputes the order from the RAW
//     rows with NO import from `src/` at all — plain relational string
//     comparison, no collation, no shared comparator with the code under test.
// Nothing here is ever checked against the model's own output.
//
// THE ROWS TRAVEL THROUGH THE PRODUCTION PARSER
// Every CSV is read with `parseCsvFile` and built with `buildVehicleView`, so the
// rows the model sorts are the rows the worker built.
//
// Decisions: D-08, D-11, D-12, D-14. Threats: T-05-26, T-05-27, T-05-28.
// =============================================================================

import { describe, expect, it } from 'vitest';

import * as fixtures from '../fixtures/player-stats-fixtures';
import * as oracle from '../helpers/vehicle-oracle';
import { parseCsvFile } from '../../src/lib/worker/csv-parse';
// Namespace imports on purpose: a symbol that does not exist yet fails the ONE
// test that uses it instead of crashing the whole file at module resolution,
// which is what makes the RED run readable.
import * as shared from '../../src/lib/vehicle-shared';
import * as vehicleModel from '../../src/lib/vehicle-model';
import * as vehicleStats from '../../src/lib/worker/vehicle-stats';
import type { VehicleColumn, VehicleRow, VehicleView } from '../../src/lib/vehicle-shared';
import type { VehicleFileFacts, VehicleFiles } from '../../src/lib/worker/vehicle-stats';

const CATEGORY = 'Player_statistics';

const WOT_FILES = ['WOT_Vehicle_Statistics.csv', 'WOT_Account_Statistics.csv'] as const;

const WOWS_FILES = ['WOWS_Ship_Statistics.csv', 'WOWS_Account_Statistics.csv'] as const;

/**
 * The six WoT ids, in the DEFAULT order (D-12): battles descending, ties by
 * cleaned id ascending in code-unit order, the zero-battle vehicle last rather
 * than filtered out. Written out so a change shows as a failing order rather than
 * as a model that agrees with itself. The battle counts are the file's own:
 * 100, 40, 12, 7, 3 and 0.
 */
const DEFAULT_ORDER = [
  'china:Ch24_Type64',
  'usa:A12_T29',
  'china:Ch99_<b>bold_markup',
  'germany:G32_PzV_PzIV',
  '__proto__',
  'ussr:R04_T-34',
] as const;

function filesFrom(names: readonly string[]): Map<string, VehicleFileFacts> {
  const files = new Map<string, VehicleFileFacts>();
  for (const name of names) {
    const parsed = parseCsvFile(fixtures.PLAYER_STATS_SAMPLE_FILES[name], CATEGORY, name);
    files.set(name.toLowerCase(), { rows: parsed.rows.map((row) => row.data), seen: true });
  }
  return files;
}

function viewOf(names: readonly string[], title: 'wot' | 'wows'): VehicleView {
  return vehicleStats.buildVehicleView(filesFrom(names), { title, battleType: null });
}

function wotView(): VehicleView {
  return viewOf(WOT_FILES, 'wot');
}

function wowsView(): VehicleView {
  return viewOf(WOWS_FILES, 'wows');
}

/** The id the ANSWER KEY and the ORACLE use: nation and cleaned id rejoined. */
function rawIdOf(row: VehicleRow): string {
  return row.nation === null ? row.id : `${row.nation}:${row.id}`;
}

/** The WoT sample's rows with one main file replaced, for the scale cases. */
function withMain(csv: string): VehicleFiles {
  const files = filesFrom(['WOT_Account_Statistics.csv']);
  files.set('wot_vehicle_statistics.csv', {
    rows: parseCsvFile(csv, CATEGORY, 'WOT_Vehicle_Statistics.csv').rows.map((row) => row.data),
    seen: true,
  });
  return files;
}

function idsOf(rows: readonly VehicleRow[]): string[] {
  return rows.map(rawIdOf);
}

describe('05-09 the vehicle table model', () => {
  describe('sortRows — D-12, the order the table opens with', () => {
    it('opens on battles descending, with the zero-battle vehicle last and not filtered out', () => {
      const view = wotView();

      const sorted = vehicleModel.sortRows(view.rows, view.columns, vehicleModel.DEFAULT_SORT);

      expect(idsOf(sorted)).toEqual([...DEFAULT_ORDER]);
      // Every row is present: a garage-only vehicle is a row with a count, not a
      // row that disappears (D-12).
      expect(sorted).toHaveLength(view.rows.length);
    });

    it('agrees with the zero-import oracle over the same raw rows', () => {
      const view = wotView();
      const raw = parseCsvFile(
        fixtures.PLAYER_STATS_SAMPLE_FILES['WOT_Vehicle_Statistics.csv'],
        CATEGORY,
        'WOT_Vehicle_Statistics.csv',
      ).rows.map((row) => row.data);

      const sorted = vehicleModel.sortRows(view.rows, view.columns, vehicleModel.DEFAULT_SORT);

      expect(idsOf(sorted)).toEqual(oracle.oracleDefaultOrder(raw));
    });

    it('never mutates the rows it was given', () => {
      const view = wotView();
      const before = idsOf(view.rows);

      vehicleModel.sortRows(view.rows, view.columns, {
        key: 'vehicle',
        dir: 'asc',
      });

      expect(idsOf(view.rows)).toEqual(before);
    });

    it('leaves the order alone when the sort key is not a column of this view', () => {
      const view = wotView();
      const before = idsOf(view.rows);

      const sorted = vehicleModel.sortRows(view.rows, view.columns, { key: 'nope', dir: 'asc' });

      expect(idsOf(sorted)).toEqual(before);
    });
  });

  describe('special values — D-09, never a zero and never in the middle', () => {
    it('puts the no-battles win rate last when sorting win rate descending', () => {
      const view = wotView();
      const special = specialIdsOf(view, 'winRate');
      expect(special).toEqual(['ussr:R04_T-34']);

      const descending = vehicleModel.sortRows(view.rows, view.columns, {
        key: 'winRate',
        dir: 'desc',
      });

      expect(idsOf(descending).at(-1)).toBe('ussr:R04_T-34');
    });

    it('still puts it last when the direction is reversed', () => {
      const view = wotView();

      const ascending = vehicleModel.sortRows(view.rows, view.columns, {
        key: 'winRate',
        dir: 'asc',
      });

      // Ascending by win rate: 33.33, 37.5, 42.86, 50, 55 — and the vehicle with
      // no battles is still at the end, because a special is not a low value.
      expect(idsOf(ascending)).toEqual([
        '__proto__',
        'usa:A12_T29',
        'germany:G32_PzV_PzIV',
        'china:Ch99_<b>bold_markup',
        'china:Ch24_Type64',
        'ussr:R04_T-34',
      ]);
    });

    it('sorts a date column by the seconds it carries, with no date last either way', () => {
      const view = wotView();

      const descending = idsOf(
        vehicleModel.sortRows(view.rows, view.columns, { key: 'lastBattle', dir: 'desc' }),
      );
      expect(descending).toEqual([
        'china:Ch24_Type64', // 2021-09-30
        'usa:A12_T29', // 2021-08-01
        '__proto__', // 2021-02-02
        'china:Ch99_<b>bold_markup', // 2021-01-01
        'germany:G32_PzV_PzIV', // 2020-05-05
        'ussr:R04_T-34', // never fought: no date
      ]);

      const ascending = idsOf(
        vehicleModel.sortRows(view.rows, view.columns, { key: 'lastBattle', dir: 'asc' }),
      );
      // The five dated rows reverse, and the undated one STAYS last: a vehicle
      // that never fought is not "the vehicle whose last battle was earliest".
      expect(ascending).toEqual([
        'germany:G32_PzV_PzIV', // 2020-05-05
        'china:Ch99_<b>bold_markup', // 2021-01-01
        '__proto__', // 2021-02-02
        'usa:A12_T29', // 2021-08-01
        'china:Ch24_Type64', // 2021-09-30
        'ussr:R04_T-34', // never fought: no date
      ]);
    });

    it('puts a garage "yes" above a "no" when sorting descending, ties by id', () => {
      const view = wowsView();

      const descending = idsOf(
        vehicleModel.sortRows(view.rows, view.columns, { key: 'inGarage', dir: 'desc' }),
      );
      // Both ships in the garage first — and the tie between them breaks by
      // cleaned id in code-unit order, so `PA` before `PJ`.
      expect(descending).toEqual(['PASD002_Fake_Beta', 'PJSD001_Fake_Alpha', 'PJSC003_Fake_Gamma']);

      const ascending = idsOf(
        vehicleModel.sortRows(view.rows, view.columns, { key: 'inGarage', dir: 'asc' }),
      );
      expect(ascending).toEqual(['PJSC003_Fake_Gamma', 'PASD002_Fake_Beta', 'PJSD001_Fake_Alpha']);
    });
  });

  describe('the vehicle column and the tie-break', () => {
    it('sorts the vehicle column ascending in plain code-unit order on the cleaned id', () => {
      const view = wotView();

      const ascending = idsOf(
        vehicleModel.sortRows(view.rows, view.columns, { key: 'vehicle', dir: 'asc' }),
      );

      // Code units, not an alphabet: `A` is 0x41 and `_` is 0x5F, so the
      // `_`-bearing ids sort AFTER every capital letter and the lower-case ones
      // follow. `Ch24_Type64` before `Ch99_<b>bold_markup` because `2` is 0x32 and
      // `9` is 0x39.
      expect(ascending).toEqual([
        'usa:A12_T29', // A
        'china:Ch24_Type64', // C h 2
        'china:Ch99_<b>bold_markup', // C h 9
        'germany:G32_PzV_PzIV', // G
        'ussr:R04_T-34', // R
        '__proto__', // _
      ]);
    });

    it('breaks equal values by cleaned id ascending, then by the original order', () => {
      // A hand-built view: three rows sharing one average damage of 750, given
      // in an order that is NOT the order they must come back in.
      const columns: VehicleColumn[] = [
        { key: 'vehicle', kind: 'text', core: true, sortable: true },
        { key: 'avgDamage', kind: 'whole', core: true, sortable: true },
      ];
      const rows: VehicleRow[] = [
        {
          id: 'zulu',
          nation: null,
          battles: 1,
          cells: [
            { t: 's', v: 'zulu' },
            { t: 'n', v: 750 },
          ],
        },
        {
          id: 'alpha',
          nation: null,
          battles: 1,
          cells: [
            { t: 's', v: 'alpha' },
            { t: 'n', v: 750 },
          ],
        },
        {
          id: 'mike',
          nation: null,
          battles: 1,
          cells: [
            { t: 's', v: 'mike' },
            { t: 'n', v: 750 },
          ],
        },
      ];

      const sorted = vehicleModel.sortRows(rows, columns, { key: 'avgDamage', dir: 'desc' });

      expect(sorted.map((row) => row.id)).toEqual(['alpha', 'mike', 'zulu']);
      // The input is untouched: the tie-break is decided on a copy.
      expect(rows.map((row) => row.id)).toEqual(['zulu', 'alpha', 'mike']);
    });
  });

  describe('firstDirection and nextSort — no unsorted state', () => {
    it('opens a text column ascending and every other kind descending', () => {
      const kinds: readonly shared.ColumnKind[] = [
        'count',
        'percent',
        'whole',
        'text',
        'date',
        'garage',
      ];

      for (const kind of kinds) {
        expect(vehicleModel.firstDirection(kind), kind).toBe(kind === 'text' ? 'asc' : 'desc');
      }
    });

    it('gives a new key its first direction', () => {
      const columns = wotView().columns;

      expect(vehicleModel.nextSort(vehicleModel.DEFAULT_SORT, 'xp', columns)).toEqual({
        key: 'xp',
        dir: 'desc',
      });
      expect(vehicleModel.nextSort(vehicleModel.DEFAULT_SORT, 'vehicle', columns)).toEqual({
        key: 'vehicle',
        dir: 'asc',
      });
    });

    it('flips the direction when the sorted column is clicked again', () => {
      const columns = wotView().columns;

      expect(vehicleModel.nextSort(vehicleModel.DEFAULT_SORT, 'battles', columns)).toEqual({
        key: 'battles',
        dir: 'asc',
      });
      expect(vehicleModel.nextSort({ key: 'battles', dir: 'asc' }, 'battles', columns)).toEqual({
        key: 'battles',
        dir: 'desc',
      });
    });

    it('never returns an unsorted state, from any column', () => {
      const columns = wotView().columns;

      for (const column of columns) {
        if (!column.sortable) continue;
        for (const dir of ['asc', 'desc'] as const) {
          const next = vehicleModel.nextSort({ key: column.key, dir }, column.key, columns);
          expect(next, `${column.key} ${dir}`).toEqual({
            key: column.key,
            dir: dir === 'asc' ? 'desc' : 'asc',
          });
        }
      }
    });

    it('changes nothing when the column is not sortable — D-08 Warships', () => {
      const view = wowsView();
      const current = { key: 'battles', dir: 'desc' } as const;

      // The two All-battles cells that read the same per-type note in every row.
      for (const key of ['winRate', 'avgDamage']) {
        const column = view.columns.find((entry) => entry.key === key);
        expect(column?.sortable, key).toBe(false);
        expect(vehicleModel.nextSort(current, key, view.columns)).toEqual(current);
      }
    });

    it('changes nothing for a key this view does not have', () => {
      const current = { key: 'battles', dir: 'desc' } as const;

      expect(vehicleModel.nextSort(current, 'inGarage', wotView().columns)).toEqual(current);
    });
  });

  describe('filterRows — D-11, over the cleaned id', () => {
    it('returns every row for an empty or whitespace-only query', () => {
      const view = wotView();

      expect(vehicleModel.filterRows(view.rows, '')).toHaveLength(view.rows.length);
      expect(vehicleModel.filterRows(view.rows, '   ')).toHaveLength(view.rows.length);
    });

    it('matches a substring of the cleaned id, case-insensitively', () => {
      const view = wotView();

      expect(idsOf(vehicleModel.filterRows(view.rows, 'T-34'))).toEqual(['ussr:R04_T-34']);
      expect(idsOf(vehicleModel.filterRows(view.rows, 't-34'))).toEqual(['ussr:R04_T-34']);
      expect(idsOf(vehicleModel.filterRows(view.rows, 'TYPE64'))).toEqual(['china:Ch24_Type64']);
    });

    it('trims the query rather than searching for the spaces', () => {
      const view = wotView();

      expect(idsOf(vehicleModel.filterRows(view.rows, '  T29  '))).toEqual(['usa:A12_T29']);
    });

    it('does NOT match the nation tag, only the id', () => {
      const view = wotView();

      // Every WoT row carries a `china:` nation, so a search over the whole
      // prefixed id would return two rows. Over the cleaned id it returns none.
      expect(vehicleModel.filterRows(view.rows, 'china')).toHaveLength(0);
    });

    it('returns nothing for a query no row holds', () => {
      expect(vehicleModel.filterRows(wotView().rows, 'no-such-vehicle')).toHaveLength(0);
    });

    it('never changes the order of the rows it kept', () => {
      const view = wotView();
      const rows = vehicleModel.sortRows(view.rows, view.columns, vehicleModel.DEFAULT_SORT);

      const filtered = vehicleModel.filterRows(rows, 'a');

      // The expectation is derived from the CLEANED ids, because that is what
      // the model searches; comparing against the nation-prefixed ones would
      // match every row on a `china` the reader never typed.
      const kept = rows.filter((row) => row.id.toLowerCase().includes('a'));
      expect(idsOf(filtered)).toEqual(idsOf(kept));
      // A12_T29 and Ch99_<b>bold_markup carry the letter; the other four do not.
      expect(idsOf(filtered)).toEqual(['usa:A12_T29', 'china:Ch99_<b>bold_markup']);
    });
  });

  describe('zeroBattleCount — the three figures on the count line', () => {
    it('counts the one garage-only vehicle in the WoT sample', () => {
      expect(vehicleModel.zeroBattleCount(wotView().rows)).toBe(
        fixtures.PLAYER_STATS_EXPECTED.titles.wot.zeroBattleCount,
      );
    });

    it('counts the zero-battle vehicles in the generated 5,000-row view', () => {
      const spec = fixtures.VEHICLE_SCALE_5K_SPEC;
      const key = fixtures.vehicleScaleExpected(spec);
      const view = vehicleStats.buildVehicleView(withMain(fixtures.generateVehicleMainCsv(spec)), {
        title: 'wot',
        battleType: null,
      });

      expect(view.rows).toHaveLength(key.rowCount);
      expect(vehicleModel.zeroBattleCount(view.rows)).toBe(key.zeroBattleCount);
    });
  });

  describe('the 5,000-row sort — T-05-26, inside a ceiling', () => {
    it("sorts 5,000 vehicles in under 500ms and lands on the oracle's order", () => {
      const spec = fixtures.VEHICLE_SCALE_5K_SPEC;
      const key = fixtures.vehicleScaleExpected(spec);
      const rawRows = parseCsvFile(
        fixtures.generateVehicleMainCsv(spec),
        CATEGORY,
        'WOT_Vehicle_Statistics.csv',
      ).rows.map((row) => row.data);
      const view = vehicleStats.buildVehicleView(withMain(fixtures.generateVehicleMainCsv(spec)), {
        title: 'wot',
        battleType: null,
      });

      const started = performance.now();
      const sorted = vehicleModel.sortRows(view.rows, view.columns, vehicleModel.DEFAULT_SORT);
      const elapsed = performance.now() - started;

      expect(sorted).toHaveLength(5_000);
      expect(elapsed).toBeLessThan(500);

      // The whole order, compared on the ONE quantity both sides can agree
      // about: the sequence of battle counts. Ids are not comparable here,
      // because the generated fixture draws battles 1..3,000 over 5,000 vehicles
      // and so has thousands of ties — and the oracle breaks a tie on the RAW
      // `nation:V0000Tank` id while the model breaks it on the CLEANED
      // `V0000Tank`. Both rules are right for their own vocabulary; the counts
      // are what the two orders must actually agree on.
      const battlesByRawId = new Map(
        rawRows.map((row) => [row['VEHICLE_NAME'] ?? '', Number(row['BATTLES_COUNT'] ?? '0')]),
      );
      const oracleOrder = oracle.oracleDefaultOrder(rawRows);
      expect(sorted.map((row) => row.battles)).toEqual(
        oracleOrder.map((rawId) => battlesByRawId.get(rawId)),
      );
      expect(sorted[0]?.battles).toBe(key.largestBattles);
    });

    it('breaks the 5,000-row ties by cleaned id, so the order is total', () => {
      const spec = fixtures.VEHICLE_SCALE_5K_SPEC;
      const view = vehicleStats.buildVehicleView(withMain(fixtures.generateVehicleMainCsv(spec)), {
        title: 'wot',
        battleType: null,
      });
      const sorted = vehicleModel.sortRows(view.rows, view.columns, vehicleModel.DEFAULT_SORT);

      // Every run of equal battle counts must be ascending by cleaned id, which
      // is what makes the order total rather than merely non-decreasing.
      let index = 0;
      while (index < sorted.length) {
        let end = index;
        while (end + 1 < sorted.length && sorted[end + 1]!.battles === sorted[index]!.battles) {
          end += 1;
        }
        const run = sorted.slice(index, end + 1).map((row) => row.id);
        expect(run, `run at ${index}`).toEqual([...run].sort());
        index = end + 1;
      }
    });
  });

  describe('windowRange — D-14, the fixed row height and the overscan', () => {
    it('is 40px per row with six rows of overscan either side', () => {
      expect(vehicleModel.ROW_PX).toBe(40);
      expect(vehicleModel.OVERSCAN_ROWS).toBe(6);
    });

    it('opens at the top with 12 rows of viewport plus 6 above and below', () => {
      // 480 / 40 is 12 rows. `last` is exclusive, so 0 + 12 + 6 is 18: eighteen
      // rows are drawn, and the 4,982 below them are one spacer.
      expect(vehicleModel.windowRange(0, 480, 5_000)).toEqual({
        first: 0,
        last: 18,
        padTopPx: 0,
        padBottomPx: 199_280, // (5,000 - 18) x 40
      });
    });

    it('follows the scroll offset down the list', () => {
      // 20,000 / 40 is 500, so 500 - 6 is 494; the bottom edge is 512 + 6 = 518.
      expect(vehicleModel.windowRange(20_000, 480, 5_000)).toEqual({
        first: 494,
        last: 518,
        padTopPx: 19_760, // 494 x 40
        padBottomPx: 179_280, // (5,000 - 518) x 40
      });
    });

    it('gives an empty list an empty window and no padding', () => {
      expect(vehicleModel.windowRange(0, 480, 0)).toEqual({
        first: 0,
        last: 0,
        padTopPx: 0,
        padBottomPx: 0,
      });
    });

    it('never renders nothing for a non-empty list after the list shrank — T-05-27', () => {
      // The reader filtered 5,000 rows down to 30 while the scroller was still
      // at offset 20,000. A window computed from the stale offset would start
      // at row 494 of a 30-row list and draw an empty table reading as "no data".
      const window = vehicleModel.windowRange(20_000, 480, 30);

      expect(window.last).toBe(30);
      // Pulled back to a viewport's worth of the list's final rows, not clamped
      // to a single row.
      expect(window.first).toBe(18); // 30 - the 12 rows a 480px viewport shows
      expect(window.padTopPx).toBe(720);
      expect(window.padBottomPx).toBe(0);
    });

    it('holds the invariant for any offset over a list of any size', () => {
      for (const total of [1, 7, 30, 400, 5_000]) {
        for (const offset of [0, 480, 4_000, 20_000, 200_000, 1_000_000]) {
          const window = vehicleModel.windowRange(offset, 480, total);
          const label = `total ${total} offset ${offset}`;

          expect(window.first, label).toBeGreaterThanOrEqual(0);
          // `first < last` is the whole point: a non-empty list always draws at
          // least one row, however stale the offset is.
          expect(window.first, label).toBeLessThan(window.last);
          expect(window.last, label).toBeLessThanOrEqual(total);
          expect(window.padTopPx, label).toBe(window.first * 40);
          expect(window.padBottomPx, label).toBe((total - window.last) * 40);
        }
      }
    });
  });

  describe('visibleColumns — the core six, then the picked extras in pick order', () => {
    it('returns the core columns and nothing else when nothing is picked', () => {
      const view = wotView();

      expect(vehicleModel.visibleColumns(view.columns, []).map((column) => column.key)).toEqual([
        'vehicle',
        'battles',
        'winRate',
        'avgDamage',
        'frags',
        'xp',
      ]);
    });

    it('follows the PICK order, not the view order', () => {
      const view = wotView();

      // `lastBattle` is the LAST extra the WoT view offers and `maxXp` the
      // fourth, so picking them in that order reverses the view's own.
      const picked = vehicleModel
        .visibleColumns(view.columns, ['lastBattle', 'maxXp'])
        .map((column) => column.key);

      expect(picked).toEqual([
        'vehicle',
        'battles',
        'winRate',
        'avgDamage',
        'frags',
        'xp',
        'lastBattle',
        'maxXp',
      ]);
    });

    it('ignores a picked key that is not an extra of this view', () => {
      const view = wotView();

      // WoT's file has no DAMAGE_MAX and no IN_GARAGE, so neither is offered
      // even when something else asks for it by key.
      expect(view.columns.map((column) => column.key)).not.toContain('maxDamage');
      expect(
        vehicleModel.visibleColumns(view.columns, ['maxDamage', 'spotted']).map((c) => c.key),
      ).toEqual(['vehicle', 'battles', 'winRate', 'avgDamage', 'frags', 'xp', 'spotted']);
    });

    it('never picks a core column twice, and keeps the core six exactly once', () => {
      const view = wotView();

      const keys = vehicleModel
        .visibleColumns(view.columns, ['xp', 'spotted', 'xp'])
        .map((column) => column.key);

      expect(keys).toEqual([
        'vehicle',
        'battles',
        'winRate',
        'avgDamage',
        'frags',
        'xp',
        'spotted',
      ]);
    });
  });

  describe('the module boundary', () => {
    it('carries no Svelte import, no copy inventory, and no locale-aware comparison', async () => {
      const { readFileSync } = await import('node:fs');
      const source = readFileSync(
        new URL('../../src/lib/vehicle-model.ts', import.meta.url),
        'utf8',
      );
      // Comments are stripped first: the module's WHY-header names these
      // constraints in prose, and the constraint is about the code.
      const code = source
        .split('\n')
        .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
        .join('\n');

      // A component framework (runes are unavailable to a node-environment
      // test), the copy module (this model holds values, never words) and the
      // locale-aware comparison (T-05-28: two viewers in two locales must agree
      // on one order, so every string comparison is by code unit).
      expect(code).not.toMatch(/from 'svelte/);
      expect(code).not.toMatch(/ui-copy/);
      expect(code).not.toMatch(/\$state|\$derived|\$effect/);
      expect(code).not.toMatch(/localeCompare|toLocaleLowerCase|toLocaleUpperCase|Intl\./);
    });
  });
});

/** The raw ids of the rows whose named column holds a special value. */
function specialIdsOf(view: VehicleView, key: string): string[] {
  const index = view.columns.findIndex((column) => column.key === key);
  expect(`${key}:${index}`).toBe(`${key}:${index >= 0 ? index : 'absent'}`);
  return view.rows.filter((row) => row.cells[index]?.t === 'x').map(rawIdOf);
}
