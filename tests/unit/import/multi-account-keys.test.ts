import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { componentPath, listComponentFiles } from '../../helpers/components.ts';
import * as fixtures from '../../fixtures/player-stats-fixtures.ts';
import { parseCsvFile } from '../../../src/lib/worker/csv-parse.ts';
import { oneAccount, oneAccountEach } from '../../helpers/row-groups.ts';
import {
  buildVehicleView,
  type VehicleFileFacts,
} from '../../../src/lib/features/vehicles/vehicle-aggregate.ts';

// =============================================================================
// multi-account-keys - the keyed `{#each}` audit (09-05, D-12, T-09-22)
// =============================================================================
//
// WHY A SOURCE GUARD AND NOT A RENDER TEST
//
// Vitest runs in Node with no Svelte plugin, so a component cannot be rendered
// in a unit test at all; and a PRODUCTION build does not throw on a duplicate
// keyed-each key — Svelte drops one of the two rows and says nothing. So a
// render check could not be relied on to catch this regression, and the browser
// spec is what proves the pane actually opens.
//
// That leaves three questions this file answers, in order:
//
//   1. **Do the two offending blocks key by position?** A source guard, because
//      the key expression IS the thing under test and a source read states it
//      exactly.
//
//   2. **Are the values that made those keys wrong really there?** A DATA test.
//      Without it the guard would be vacuous: `(index)` would pass just as well
//      on a fixture whose ids never repeat. Feeding the builder the same file
//      twice is exactly what a multi-account export does, because
//      `WOTB_Vehicle_Statistics.csv` exists in three roots and
//      `WOTB_Battle_Types_Statistics.csv` in two.
//
//   3. **Is every OTHER keyed list accounted for?** The audit table below. A
//      value key is only safe while its value is unique BY CONSTRUCTION or
//      de-duplicated upstream, and "it is unique today" is not a property anyone
//      can see in the markup. Pinning every (file, key) pair in a table with a
//      written reason turns "this list is fine" into a claim a future edit has
//      to revisit, and a list keyed by a value that starts repeating across
//      accounts fails this file by name.
// =============================================================================

/** The two blocks this plan had to change, and the keys they used to use. */
const TABLE = 'VehicleTable.svelte';
const SUMMARY = 'BattleTypeSummary.svelte';

/** The source, or a loud failure — a missing component must not read as "no bug". */
function source(file: string): string {
  const full = componentPath(file);
  if (!existsSync(full)) throw new Error(`component not found: ${file}`);
  return readFileSync(full, 'utf8');
}

/**
 * The source with every comment stripped.
 *
 * The two components now carry a comment explaining WHY the key is a position,
 * and that comment necessarily mentions `row.id` and `row.code`. A guard that
 * read the prose would therefore fail on correct code, so it reads the markup.
 */
function markup(file: string): string {
  return source(file)
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '');
}

/**
 * EVERY `{#each}` key expression in a component, unkeyed blocks included as
 * `null`.
 *
 * Anchored at the start of a line so a prose mention of `{#each}` inside a
 * comment block cannot be read as a template block, and it returns the whole
 * list rather than the first hit because a component may legitimately carry
 * several blocks keyed differently — `VehicleTable` keys its column list and its
 * data rows on two different principles, and only the second one is D-12's.
 *
 * The key may contain parentheses only as part of an interpolation, and none of
 * the components' keys do, so the outermost `(` … `)` is the key's delimiters.
 */
function keyExpressions(text: string): Array<string | null> {
  const keys: Array<string | null> = [];
  for (const line of text.split('\n')) {
    if (!/^\s*\{#each\b/.test(line)) continue;
    const match = /\(([^()]*)\)\s*\}\s*$/.exec(line);
    keys.push(match === null ? null : match[1]!.trim());
  }
  return keys;
}

/** Every keyed `{#each}` in `src/lib`, as (file, key expression, line) triples. */
function keyedEachBlocks(): Array<{ file: string; key: string; line: number }> {
  const found: Array<{ file: string; key: string; line: number }> = [];
  for (const file of listComponentFiles()) {
    const lines = markup(file).split('\n');
    for (const [index, line] of lines.entries()) {
      if (!/^\s*\{#each\b/.test(line)) continue;
      const match = /\(([^()]*)\)\s*\}\s*$/.exec(line);
      if (match === null) continue;
      found.push({ file, key: match[1]!.trim(), line: index + 1 });
    }
  }
  return found;
}

/**
 * WHY ONE KEY IS SAFE, as the closed set the audit below may cite.
 *
 * These are the only claims the audit accepts, because each is checkable by
 * reading where the value comes from rather than by reading one dataset:
 *
 *   `position`    the key is the loop's own index, so it cannot repeat.
 *   `fixed-list`  the collection is a module constant (a column definition, a
 *                 game list, a map's shapes), so it is fixed at build time.
 *   `de-duplicated` the producer collects into a `Set`/`Map` first, so the list
 *                 holds distinct values by construction.
 *   `per-group`   the value is unique WITHIN its parent group (a cell's column
 *                 index inside its row, a country's code inside its own list).
 */
type KeySafety = 'position' | 'fixed-list' | 'de-duplicated' | 'per-group';

interface AuditedKey {
  readonly file: string;
  readonly key: string;
  readonly why: KeySafety;
  readonly reason: string;
}

/**
 * THE AUDIT (D-12).
 *
 * Every keyed `{#each}` in `src/lib`, with the reason its key cannot repeat
 * across accounts. A key that is not in this table fails the audit by name;
 * a key that IS here and stops being safe fails the review that changed it,
 * because the reason column is the claim under review.
 *
 * The two `row`-shaped keys that were NOT safe — `VehicleTable`'s `row.id` and
 * `BattleTypeSummary`'s `row.code` — are deliberately absent. They are named
 * instead in the FORBIDDEN list below, and the two components key by position.
 */
const AUDITED: readonly AuditedKey[] = [
  // --- Position: cannot repeat, whatever the data holds ---------------------
  {
    file: 'BattleTypeSummary.svelte',
    key: 'index',
    why: 'position',
    reason: 'D-12 fix: `row.code` repeats because the Battle_Types file is in two roots.',
  },
  {
    file: 'CurrencyBlock.svelte',
    key: 'index',
    why: 'position',
    reason: 'A fixed set of chart slots, rendered in order.',
  },
  {
    file: 'CurrencyBlock.svelte',
    key: 'otherIndex',
    why: 'position',
    reason: 'A rendered window over one chart list.',
  },
  {
    file: 'DeviceTable.svelte',
    key: 'cellIndex',
    why: 'position',
    reason: 'Cells of one row; the column count is fixed by the header.',
  },
  {
    file: 'DeviceTable.svelte',
    key: 'rowIndex',
    why: 'position',
    reason: 'A rendered window over the device rows.',
  },
  {
    file: 'IdentityHeader.svelte',
    key: 'index',
    why: 'position',
    reason: "D-16 order is the worker's; two accounts may share a nickname and a year.",
  },
  {
    file: 'LoginTable.svelte',
    key: 'index',
    why: 'position',
    reason: 'D-12 sibling: the same windowing decision as VehicleTable, kept in step.',
  },
  {
    file: 'MonthlyDataTable.svelte',
    key: 'cIndex',
    why: 'position',
    reason: 'Cells of one row.',
  },
  {
    file: 'MonthlyDataTable.svelte',
    key: 'rIndex',
    why: 'position',
    reason: 'Rows of the table.',
  },
  {
    file: 'Playtime.svelte',
    key: 'index',
    why: 'position',
    reason: 'Split boundaries, a fixed handful.',
  },
  {
    file: 'PlaytimeSummary.svelte',
    key: 'index',
    why: 'position',
    reason: 'Rows of a fixed summary table.',
  },
  {
    file: 'SpendSummary.svelte',
    key: 'index',
    why: 'position',
    reason: 'Cards of a fixed set.',
  },
  {
    file: 'SpendSummary.svelte',
    key: 'rowIndex',
    why: 'position',
    reason: 'Rows of a year table and of a game table; the game list may repeat across accounts.',
  },
  {
    file: 'VehicleTable.svelte',
    key: 'index',
    why: 'position',
    reason: 'D-12 fix: `row.id` repeats because the Blitz vehicle file is in three roots.',
  },

  // --- Fixed lists: the collection is a module constant ---------------------
  {
    file: 'CalendarHeatmap.svelte',
    key: 'label.month',
    why: 'fixed-list',
    reason: 'The twelve month labels, a constant, read inside one year block.',
  },
  {
    file: 'ChartLegend.svelte',
    key: 'level',
    why: 'fixed-list',
    reason: 'The ramp levels 0..5, a constant.',
  },
  {
    file: 'DeviceInfo.svelte',
    key: 'id',
    why: 'fixed-list',
    reason: '`DEVICE_SOURCES`, the three physical device files.',
  },
  {
    file: 'DeviceTable.svelte',
    key: 'column',
    why: 'fixed-list',
    reason: 'The resolved column list, one per column definition.',
  },
  {
    file: 'HourGrid.svelte',
    key: 'label.hour',
    why: 'fixed-list',
    reason: 'Twenty-four hour labels, a constant.',
  },
  {
    file: 'MonthlyBarChart.svelte',
    key: 'cell.index',
    why: 'fixed-list',
    reason: 'The laid-out bar cells, one per laid row.',
  },
  {
    file: 'MonthlyBarChart.svelte',
    key: 'label.index',
    why: 'fixed-list',
    reason: 'The laid-out labels, one per laid row.',
  },
  {
    file: 'MonthlyDataTable.svelte',
    key: 'col',
    why: 'fixed-list',
    reason: 'The resolved column list.',
  },
  {
    file: 'PlayerStats.svelte',
    key: 'title',
    why: 'fixed-list',
    reason: '`VEHICLE_TITLES`, four constants.',
  },
  {
    file: 'VehicleTable.svelte',
    key: 'column.key',
    why: 'fixed-list',
    reason: 'The resolved column list; two blocks read it and share the decision.',
  },
  {
    file: 'LoginTable.svelte',
    key: 'column.key',
    why: 'fixed-list',
    reason: 'The resolved column list; three blocks read it.',
  },
  {
    file: 'PlayerStats.svelte',
    key: 'column.key',
    why: 'fixed-list',
    reason: 'The column-picker options, the same fixed list.',
  },
  {
    file: 'WorldMap.svelte',
    key: 'shape.iso',
    why: 'fixed-list',
    reason: '`WORLD_SHAPES`, the build-time map.',
  },
  {
    file: 'SpendSummary.svelte',
    key: 'figure.hook',
    why: 'fixed-list',
    reason: 'The fixed figure hooks, one per stat tile.',
  },

  // --- De-duplicated upstream, or an aggregate ------------------------------
  {
    file: 'CalendarHeatmap.svelte',
    key: 'row',
    why: 'de-duplicated',
    reason: 'The weekday label rows, deduplicated before they are laid out.',
  },
  {
    file: 'ChartTooltip.svelte',
    key: 'extraLine',
    why: 'de-duplicated',
    reason: 'Built by one formatter per data point; its lines are distinct by construction.',
  },
  {
    file: 'CityList.svelte',
    key: 'row.place',
    why: 'de-duplicated',
    reason: 'One row per place, grouped by the worker before the pane ranks them.',
  },
  {
    file: 'CountryList.svelte',
    key: 'row.cc',
    why: 'de-duplicated',
    reason: 'One row per country code; a count per country, not per login.',
  },
  {
    file: 'DurationList.svelte',
    key: 'row.bin',
    why: 'de-duplicated',
    reason: 'The duration bins are produced from a fixed bin list.',
  },
  {
    file: 'DeviceInfo.svelte',
    key: 'source.id',
    why: 'de-duplicated',
    reason: 'One entry per physical device source, keyed by the source id.',
  },
  {
    file: 'HourGrid.svelte',
    key: 'cell.index',
    why: 'de-duplicated',
    reason: 'The laid-out cells, one per hour slot.',
  },
  {
    file: 'HourGrid.svelte',
    key: 'row.weekday',
    why: 'de-duplicated',
    reason: 'One row per weekday, a constant of seven.',
  },
  {
    file: 'ListPane.svelte',
    key: 'entry.id',
    why: 'de-duplicated',
    reason: '`PANE_IDS`, nine pane ids.',
  },
  {
    file: 'Overview.svelte',
    key: 'card.id',
    why: 'de-duplicated',
    reason: '`OVERVIEW_CARD_IDS`, seven pane ids.',
  },
  {
    file: 'PlayerStats.svelte',
    key: 'code',
    why: 'de-duplicated',
    reason: 'The selectable battle-type codes, collected into a Set before they reach the select.',
  },
  {
    file: 'PremiumBlock.svelte',
    key: 'value',
    why: 'de-duplicated',
    reason: 'Unrecognised premium values, collected into a Set so the list cannot repeat one.',
  },
  {
    file: 'UnsupportedBlock.svelte',
    key: 'entry.name',
    why: 'de-duplicated',
    reason: 'One entry per unsupported folder name, the list the model builds.',
  },
  {
    file: 'WorldMap.svelte',
    key: 'row.cc',
    why: 'de-duplicated',
    reason: 'The tiny-country markers, one per drawn country.',
  },

  // --- Unique within its own group -----------------------------------------
  {
    file: 'CalendarHeatmap.svelte',
    key: "block.kind === 'year' ? `y${block.year}` : `e${block.fromYear}`",
    why: 'per-group',
    reason: 'One block per year or per era; the template disambiguates the two kinds.',
  },
  {
    file: 'CalendarHeatmap.svelte',
    key: 'cell.day',
    why: 'per-group',
    reason: 'A day number is unique within its own month row, which is the parent list.',
  },
  {
    file: 'CalendarHeatmap.svelte',
    key: 'rowIndex',
    why: 'position',
    reason: 'The weekday rows of one block, in order.',
  },
];

// =============================================================================
// Describe 1 — the source guard
// =============================================================================

describe('keyed each: source guard', () => {
  test('the two blocks this plan changed key by POSITION', () => {
    // The whole of D-12 in two assertions. A regression here is the exact
    // defect T-09-22 names, and it is the one that stops a pane rendering.
    // The lists are checked as collections because each component carries more
    // than one block, and only the data block is D-12's.
    expect(keyExpressions(markup(TABLE)), TABLE).toContain('index');
    expect(keyExpressions(markup(SUMMARY)), SUMMARY).toContain('index');
  });

  test('neither block keys by a property of the row any more', () => {
    // The forbidden forms are a row's own id and code. They appear only HERE,
    // in the guard that forbids them.
    for (const file of [TABLE, SUMMARY]) {
      expect(markup(file), `${file} keys no each block by a row property`).not.toMatch(
        /\{#each[^}]*\(\s*row\.[a-zA-Z]/,
      );
    }
    expect(keyExpressions(markup(TABLE))).not.toContain('row.id');
    expect(keyExpressions(markup(SUMMARY))).not.toContain('row.code');
  });

  test('both components document WHY the key is a position, in the markup path', () => {
    // Not the comment's wording — that the file explains the key is not the
    // row's value, which is why the guard above reads the markup.
    expect(source(TABLE)).toContain('D-12');
    expect(source(SUMMARY)).toContain('D-12');
  });
});

// =============================================================================
// Describe 2 — the repeated values are real (the guard is not vacuous)
// =============================================================================

/** One file's facts, parsed the way the worker parses it. */
function factsFor(name: string): VehicleFileFacts {
  const parsed = parseCsvFile(
    fixtures.PLAYER_STATS_SAMPLE_FILES[name] ?? '',
    'Player_statistics',
    name,
  );
  return { groups: oneAccount(parsed.rows.map((row) => row.data)), seen: true };
}

/**
 * The same file as N accounts' copies, which is what the view holds: the reader
 * groups every root's rows for a file name under that file's entry, so the map
 * has ONE entry per name and its GROUPS are the accounts (D-11, 09-07).
 *
 * Each copy is its own group rather than a concatenation, which is what its own
 * comment meant to say: two accounts whose files disagree on a column spelling
 * are read through their own headers, and two that agree still contribute every
 * row. The assertions below are unchanged — repeated ids and repeated codes are
 * still what this shape produces.
 */
function mergedFactsFor(name: string, accounts: number): VehicleFileFacts {
  const names = Array.from({ length: accounts }, (_, index) => `account-${index}`);
  return {
    groups: oneAccountEach(
      [...names].map(() => factsFor(name).groups[0]!.rows),
      names,
    ),
    seen: true,
  };
}

/**
 * The Blitz file set a multi-account export really holds.
 *
 * All THREE of the file names are here on purpose, not just the two the keys
 * collide on: `buildVehicleView` derives the SELECTABLE battle-type codes from
 * the by_Type file, and a title with no codes renders no battle-type summary at
 * all — so a two-file fixture would have returned an empty `summary` and the
 * test would have failed for a reason that has nothing to do with duplicates.
 *
 * `vehicle` and `battleTypes` are how many ACCOUNTS contribute that file. One
 * is v1.0; two and three are the multi-account shapes.
 */
function blitzFiles(counts: {
  vehicle: number;
  battleTypes?: number;
}): Map<string, VehicleFileFacts> {
  return new Map<string, VehicleFileFacts>([
    ['wotb_vehicle_statistics.csv', mergedFactsFor('WOTB_Vehicle_Statistics.csv', counts.vehicle)],
    [
      'wotb_vehicle_statistics_by_type.csv',
      mergedFactsFor('WOTB_Vehicle_Statistics_by_Type.csv', counts.vehicle),
    ],
    [
      'wotb_battle_types_statistics.csv',
      mergedFactsFor('WOTB_Battle_Types_Statistics.csv', counts.battleTypes ?? counts.vehicle),
    ],
  ]);
}

describe('keyed each: repeated values are real', () => {
  test("two accounts' copies of the Blitz vehicle file yield REPEATED row ids", () => {
    // The exact shape the Vehicles pane holds on a two-account export. Without
    // this, `(index)` in the table would be indistinguishable from `(row.id)`
    // and the source guard would be proving nothing.
    const files = blitzFiles({ vehicle: 2 });
    const view = buildVehicleView(files, { title: 'wotb', battleType: null });

    const ids = view.rows.map((row) => row.id);
    expect(ids.length, "the merged view holds both accounts' rows").toBeGreaterThan(0);
    expect(new Set(ids).size, 'and their vehicle ids really repeat').toBeLessThan(ids.length);
  });

  test('three accounts repeat them further, and the summary repeats its codes', () => {
    const files = blitzFiles({ vehicle: 3, battleTypes: 2 });
    const view = buildVehicleView(files, { title: 'wotb', battleType: null });

    const ids = view.rows.map((row) => row.id);
    expect(new Set(ids).size).toBeLessThan(ids.length);

    // And the summary: the Battle_Types file is in two roots, so a code arrives
    // twice and `{#each … (row.code)}` could not have drawn it.
    const codes = view.summary.map((row) => row.code);
    expect(codes.length).toBeGreaterThan(1);
    expect(new Set(codes).size, 'the battle-type codes really repeat').toBeLessThan(codes.length);
  });

  test("a single account's copy does NOT repeat — which is why v1.0 never saw it", () => {
    // The control that makes the two tests above meaningful: the same fixture,
    // fed once, has distinct ids and distinct codes. So the repetition is
    // caused by the ACCOUNTS, not by the fixture's rows.
    const files = blitzFiles({ vehicle: 1, battleTypes: 1 });
    const view = buildVehicleView(files, { title: 'wotb', battleType: null });

    const ids = view.rows.map((row) => row.id);
    expect(new Set(ids).size, "one account's rows are distinct").toBe(ids.length);
    const codes = view.summary.map((row) => row.code);
    expect(new Set(codes).size, "one account's codes are distinct").toBe(codes.length);
  });
});

// =============================================================================
// Describe 3 — the audit
// =============================================================================

describe('keyed each: audited list', () => {
  test('the scan finds a real number of keyed blocks, not an empty result', () => {
    // An empty scan makes the audit below pass vacuously, which is the failure
    // mode worth naming: a regex that stopped matching would look like a clean
    // audit.
    const found = keyedEachBlocks();
    expect(found.length, 'the scan found the keyed blocks').toBeGreaterThan(20);
    expect(new Set(found.map((block) => block.file)).size).toBeGreaterThan(5);
  });

  test('every keyed block in src/lib is in the audit, and the audit cites a real reason', () => {
    const audited = new Map(AUDITED.map((row) => [`${row.file} ${row.key}`, row]));
    const unknown = keyedEachBlocks().filter((block) => !audited.has(`${block.file} ${block.key}`));
    expect(
      unknown,
      `unaudited keyed each: ${unknown.map((block) => `${block.file}:${block.line} (${block.key})`).join(', ')}`,
    ).toEqual([]);

    for (const row of AUDITED) {
      expect(row.reason, `${row.file} / ${row.key} has a written reason`).not.toBe('');
      expect(['position', 'fixed-list', 'de-duplicated', 'per-group']).toContain(row.why);
    }
  });

  test('the audit names no block that no longer exists', () => {
    const found = new Set(keyedEachBlocks().map((block) => `${block.file} ${block.key}`));
    const stale = AUDITED.filter((row) => !found.has(`${row.file} ${row.key}`));
    expect(
      stale,
      `stale audit rows: ${stale.map((row) => `${row.file} (${row.key})`).join(', ')}`,
    ).toEqual([]);
  });

  test('a duplicate key expression is one audited row, not two', () => {
    // `VehicleTable.svelte` reads its column list twice and `SpendSummary`
    // renders two row tables; the audit is keyed on (file, expression), so a
    // second copy of a pair must be collapsed rather than silently accepted.
    const keys = AUDITED.map((row) => `${row.file} ${row.key}`);
    expect(new Set(keys).size, 'no duplicated audit row').toBe(keys.length);
  });
});
