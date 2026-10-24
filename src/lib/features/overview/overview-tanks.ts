/**
 * overview-tanks.ts — the Tanks group (13-07, D-04, D-09, D-17, T-13-20, T-13-22).
 *
 * ## What this module is
 *
 * The four tiles the Tanks group carries: the most-played tank with its top
 * five, the favourite class with its coverage, how many tanks were played and
 * the favourite nation. All four are computed from the vehicle-statistics
 * file, and all four are a FOLD over the file's rows.
 *
 * ## Why the figures SUM across accounts (D-04)
 *
 * The vehicle-statistics file holds one row per tank per account folder. A
 * player with two account folders has two rows for the tank they played in
 * both, and the lifetime figure is the SUM of the two — the same rule Phase 10
 * D-20 set for the totals, and the same rule D-19 refines for the records.
 * Two exports of the same player are never added together, because a new
 * upload replaces the whole dataset rather than joining it.
 *
 * ## Why each account resolves its OWN columns (CR-01, T-13-20)
 *
 * One account's vehicle file spells the battle count `BATTLES_COUNT` and the
 * other's `GAMES_PLAYED`. Resolving off one account's first row and reading
 * the other account's rows through those keys would make the second account's
 * tanks read as absent — a false statement about the player's own garage
 * while its file is plainly in the archive. So every group resolves the
 * fields from ITS OWN first row.
 *
 * ## Why a garage-only row never counts (RESEARCH Pitfall 8)
 *
 * The vehicle file lists every tank the player owns, and a tank they never
 * fought in is a row with zero battles. Such a row is NOT a tank they played:
 * counting it would inflate the fleet, give the class split a share the
 * player never earned and put a tank in the top five. So a row whose battle
 * count is zero — or unreadable — is skipped, and the garage-only tank is
 * simply not there.
 *
 * ## Why a tank the table does not have is not guessed (D-09)
 *
 * A tank missing from the built-in table keeps its TAG-DERIVED name and the
 * class `unknown`. Nothing is invented: the table is a lookup, not an
 * authority, and a retired tank is a real tank the player really owns. The
 * class tile therefore states its COVERAGE — the share of battles whose class
 * the table knows — and is ABSENT when no battle resolves a class, because
 * there is no class to name.
 *
 * ## Why the lookup arrives as an ARGUMENT
 *
 * The tank table is worker-only (D-08): it is inlined into the worker chunk
 * and the page must never pull it into the main bundle. So the lookup is a
 * parameter and this module never imports the table — which is also what
 * makes it testable against a synthetic table of three rows.
 */

import { cell, type CsvRow } from '../../worker/csv-columns.ts';
import type { OverviewFileInput } from './overview-aggregate.ts';
import { clampName, readCount, resolveFields, type FieldSpec } from './overview-columns.ts';
import { nationOfKey, tagFallbackName, type VehicleLookup } from './overview-lookup.ts';
import {
  OVERVIEW_TILE_NEEDS,
  type OverviewAbsentTile,
  type OverviewClassKey,
  type OverviewTile,
  type OverviewTileId,
} from './overview-shared.ts';

// -----------------------------------------------------------------------------
// The column vocabulary
// -----------------------------------------------------------------------------

/** The tank's own key: a `nation:tag` string. */
const VEHICLE_NAME_FIELD: FieldSpec = { id: 'vehicleName', headers: ['VEHICLE_NAME'] };

/**
 * The battle count, under the spellings the exports use.
 *
 * `BATTLES_COUNT` is the World of Tanks name and `GAMES_PLAYED` is what the
 * other account in the fixture archive carries.
 */
const BATTLES_FIELD: FieldSpec = {
  id: 'battles',
  headers: ['BATTLES_COUNT', 'BATTLES', 'GAMES_PLAYED'],
};

/** The seconds spent in battle, per tank. */
const BATTLE_SECONDS_FIELD: FieldSpec = {
  id: 'battleSeconds',
  headers: ['BATTLE_LIFE_TIME_SEC'],
};

/** Every field this module reads, resolved in ONE pass per account group. */
const ALL_FIELDS: readonly FieldSpec[] = [VEHICLE_NAME_FIELD, BATTLES_FIELD, BATTLE_SECONDS_FIELD];

/** How many tanks the most-played tile's list carries. */
const TOP_TANKS = 5;

// -----------------------------------------------------------------------------
// The shapes
// -----------------------------------------------------------------------------

/** One tank's figures, after the fold. */
interface TankEntry {
  /** The tank's own key, as the export spelled it. */
  key: string;
  /** The name to show: the table's, or the tag-derived fallback. */
  name: string;
  /** The tank's class, or `unknown` when the table does not have it. */
  classKey: OverviewClassKey;
  /** The tank's tier, or null when the table does not name one. */
  tier: number | null;
  /** How many battles, summed over the account folders. */
  battles: number;
}

// -----------------------------------------------------------------------------
// The absent form
// -----------------------------------------------------------------------------

/**
 * The absent form of one tile: the source it needs, and the column when the
 * absence is a COLUMN-level one (D-03, D-09).
 */
function absent(id: OverviewTileId, column: string | null): OverviewAbsentTile {
  return { id, status: 'absent', need: OVERVIEW_TILE_NEEDS[id], column };
}

/** All four Tanks tiles absent, with the column that names the absence. */
function allAbsent(column: string | null): OverviewTile[] {
  return [
    absent('tank', column),
    absent('cls', column),
    absent('fleet', column),
    absent('nat', column),
  ];
}

// -----------------------------------------------------------------------------
// The builder
// -----------------------------------------------------------------------------

/**
 * Build the four Tanks tiles.
 *
 * Pure: it reads the rows it is handed and returns four tiles, always in the
 * order tank, cls, fleet, nat. It never throws, whatever a cell holds.
 */
export function buildTankTiles(input: OverviewFileInput, lookup: VehicleLookup): OverviewTile[] {
  // The file is not in the export at all, or it holds no row: there is
  // nothing to report and no column to name.
  const groups = input.groups.filter((group) => group.rows.length > 0);
  if (!input.seen || groups.length === 0) return allAbsent(null);

  // CR-01: each group resolves its OWN columns from its OWN first row.
  const contributing: { nameKey: string | null; battlesKey: string; rows: readonly CsvRow[] }[] =
    [];
  for (const group of groups) {
    const first = group.rows[0]!;
    const keys = resolveFields(first, ALL_FIELDS);
    const battlesKey = keys.get('battles') ?? null;
    // A group whose battle-count column is unresolved contributes nothing.
    if (battlesKey === null) continue;
    contributing.push({
      nameKey: keys.get('vehicleName') ?? null,
      battlesKey,
      rows: group.rows,
    });
  }

  // EVERY group lacked the column: the export has no battle count to read.
  if (contributing.length === 0) return allAbsent('BATTLES_COUNT');

  // The fold. One entry per tank name, summed over the account folders.
  // A `Map` and not an object, so a name of `__proto__` is an ordinary key
  // (T-13-22).
  const counts = new Map<string, number>();
  for (const group of contributing) {
    for (const row of group.rows) {
      const rawName = cell(row, group.nameKey);
      if (rawName === undefined) continue;
      const name = clampName(rawName);
      // A blank name is not a tank.
      if (name === '') continue;
      const count = readCount(cell(row, group.battlesKey));
      // A zero is a garage-only row and an unreadable cell is no figure:
      // neither is a battle, and neither may enter the fleet (Pitfall 8).
      if (count === null || count === 0) continue;
      counts.set(name, (counts.get(name) ?? 0) + count);
    }
  }

  // Nothing was played: the file is there, but it names no battle.
  if (counts.size === 0) return allAbsent(null);

  // The entries, most played first, and the total they share.
  const entries: TankEntry[] = [...counts.entries()]
    .map(([key, battles]) => {
      const info = lookup.byTag(key);
      return {
        key,
        name: info?.name ?? tagFallbackName(key),
        classKey: info?.classKey ?? 'unknown',
        tier: info?.tier ?? null,
        battles,
      };
    })
    .sort((a, b) => b.battles - a.battles || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));

  const total = entries.reduce((sum, entry) => sum + entry.battles, 0);
  const lead = entries[0]!;

  // --- the class split ------------------------------------------------------
  const classTotals = new Map<OverviewClassKey, number>();
  for (const entry of entries) {
    classTotals.set(entry.classKey, (classTotals.get(entry.classKey) ?? 0) + entry.battles);
  }
  const resolvedBattles = [...classTotals.entries()]
    .filter(([classKey]) => classKey !== 'unknown')
    .reduce((sum, [, battles]) => sum + battles, 0);

  // No battle resolves a class: there is no class to name, so the tile is
  // absent rather than a tile whose favourite is "unknown" (D-09).
  const clsTile: OverviewTile =
    resolvedBattles === 0
      ? absent('cls', null)
      : (() => {
          const known = [...classTotals.entries()].filter(
            (entry): entry is [Exclude<OverviewClassKey, 'unknown'>, number] =>
              entry[0] !== 'unknown',
          );
          known.sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
          const favourite = known[0]!;
          const rows = [...classTotals.entries()]
            .filter(([, battles]) => battles > 0)
            .sort((a, b) => {
              // `unknown` always sorts last, whatever its battle count.
              if (a[0] === 'unknown') return b[0] === 'unknown' ? 0 : 1;
              if (b[0] === 'unknown') return -1;
              return b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
            })
            .map(([classKey, battles]) => ({ classKey, battles }));
          return {
            id: 'cls',
            status: 'ok',
            classKey: favourite[0],
            share: favourite[1] / total,
            coverage: resolvedBattles / total,
            rows,
          };
        })();

  // --- the nations ----------------------------------------------------------
  const nationTotals = new Map<string, number>();
  for (const entry of entries) {
    const nation = nationOfKey(entry.key);
    // A key with no prefix has no nation: it is skipped in this tally and
    // still counted in the total.
    if (nation === null) continue;
    nationTotals.set(nation, (nationTotals.get(nation) ?? 0) + entry.battles);
  }
  const nations = [...nationTotals.entries()].sort(
    (a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0),
  );
  const natTile: OverviewTile =
    nations.length === 0
      ? absent('nat', null)
      : {
          id: 'nat',
          status: 'ok',
          nation: nations[0]![0],
          share: nations[0]![1] / total,
        };

  return [
    {
      id: 'tank',
      status: 'ok',
      name: lead.name,
      battles: lead.battles,
      share: lead.battles / total,
      classKey: lead.classKey,
      tier: lead.tier,
      top: entries.slice(0, TOP_TANKS).map((entry) => ({
        name: entry.name,
        classKey: entry.classKey,
        battles: entry.battles,
      })),
    },
    clsTile,
    {
      id: 'fleet',
      status: 'ok',
      count: entries.length,
    },
    natTile,
  ];
}

/**
 * The lifetime battle time, summed over the per-vehicle cells.
 *
 * The account-statistics file carries a `BATTLE_LIFE_TIME` total, and the
 * vehicle file carries the same quantity per tank. The per-vehicle sum is
 * the FALLBACK for the "In battle" figure when the account statistics are
 * missing, so it is computed here, once, from the vehicle rows alone.
 *
 * Each account resolves the column from its OWN first row (CR-01). The answer
 * is null when no account's header resolved the column at all — "the export
 * does not carry it", which is different from a total of zero.
 */
export function sumVehicleBattleSeconds(input: OverviewFileInput): number | null {
  let total = 0;
  let resolved = false;
  for (const group of input.groups) {
    const first = group.rows[0];
    if (first === undefined) continue;
    const keys = resolveFields(first, ALL_FIELDS);
    const key = keys.get('battleSeconds') ?? null;
    if (key === null) continue;
    resolved = true;
    for (const row of group.rows) {
      const value = readCount(cell(row, key));
      if (value !== null) total += value;
    }
  }
  return resolved ? total : null;
}
