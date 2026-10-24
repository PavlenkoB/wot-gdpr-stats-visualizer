/**
 * overview-records.ts — the Records group (13-07, D-09, D-19, T-13-21).
 *
 * ## What this module is
 *
 * The four tiles the Records group carries: the best single battle's damage,
 * XP and frags, and the longest sniper series. Each is the MAXIMUM across
 * the dataset's accounts, and each record names the tank the maximum was
 * fought in.
 *
 * ## Why a record is a MAXIMUM and not a sum (D-19)
 *
 * The lifetime figures SUM across account folders (D-04): a player with two
 * folders really did fight 1,500 battles in total. A RECORD is a different
 * kind of claim — it is the best SINGLE battle, and the best single battle in
 * two folders is the larger of the two, not the sum of them. Summing the two
 * accounts' `DAMAGE_MAX` would produce a number the player never achieved in
 * any battle, which is exactly the kind of statement D-19 forbids.
 *
 * So the fold here is a maximum, and the tank is taken from the account that
 * HOLDS the maximum — the two go together, because the tank is the tank the
 * record was fought in. A tie keeps the EARLIER account: two accounts with
 * the same best battle are the same best battle, and the first one to record
 * it is as good a witness as the second.
 *
 * ## Why a zero is a real record (D-09)
 *
 * An account that never scored a kill has `FRAGS_MAX` 0, and that is a TRUE
 * figure: the account played and scored nothing. It is shown as 0. An absent
 * record is a MISSING one — the file was not in the export, the column was
 * not in the file, or every account's cell says "no value" (`\N`, a blank,
 * `N/D`). Those are three different sentences, and the tile says which.
 *
 * ## Why a record's tank may be unrecorded (D-09)
 *
 * A record column names its tank with a NUMERIC id, and the export writes
 * `0`, a blank or `\N` when the tank was not recorded. A tank the table does
 * not carry is the same case: the id is real but the table has no row for
 * it. Both read "vehicle not recorded" — a null tank name — rather than a
 * guess (RESEARCH Pitfall 9).
 *
 * ## Why a record carries the number of accounts it was chosen from (WR-04)
 *
 * The rule line says "best of N accounts". N is the number of accounts that
 * HAD a figure to compare, not the number of account folders: a Blitz-only or
 * Warships-only folder has no account statistics file and was never compared.
 * The count rides on the tile, so it cannot drift from the maximum it
 * describes.
 *
 * ## Why the lookup arrives as an ARGUMENT
 *
 * The tank table is worker-only (D-08) and the page must never pull it into
 * the main bundle, so the lookup is a parameter and this module never
 * imports the table.
 */

import type { AccountStatsRead } from './overview-account-stats.ts';
import type { VehicleLookup } from './overview-lookup.ts';
import {
  OVERVIEW_TILE_NEEDS,
  type OverviewAbsentTile,
  type OverviewTile,
  type OverviewTileId,
} from './overview-shared.ts';

// -----------------------------------------------------------------------------
// The record specs
// -----------------------------------------------------------------------------

/**
 * One record: the figure, the column that carries it and the field that
 * names the tank it was fought in.
 */
interface RecordSpec {
  /** The tile id. */
  readonly id: 'dmg' | 'xp' | 'kills';
  /** The figure's field on an {@link AccountStatsRow}. */
  readonly valueField: 'damageMax' | 'xpMax' | 'fragsMax';
  /** The tank id's field on an {@link AccountStatsRow}. */
  readonly tankField: 'damageMaxTank' | 'xpMaxTank' | 'fragsMaxTank';
  /** The column's canonical name, for a column-level absence. */
  readonly column: string;
}

/** The three per-battle records. */
const RECORD_SPECS: readonly RecordSpec[] = [
  { id: 'dmg', valueField: 'damageMax', tankField: 'damageMaxTank', column: 'DAMAGE_MAX' },
  { id: 'xp', valueField: 'xpMax', tankField: 'xpMaxTank', column: 'XP_MAX' },
  { id: 'kills', valueField: 'fragsMax', tankField: 'fragsMaxTank', column: 'FRAGS_MAX' },
];

/** The series record's canonical column name. */
const SNIPER_COLUMN = 'SNIPER_SERIES_MAX';

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

// -----------------------------------------------------------------------------
// The builder
// -----------------------------------------------------------------------------

/**
 * Build the four Records tiles.
 *
 * Pure: it reads the account figures it is handed and returns four tiles,
 * always in the order dmg, xp, kills, snip. It never throws, whatever a cell
 * holds.
 */
export function buildRecordTiles(stats: AccountStatsRead, lookup: VehicleLookup): OverviewTile[] {
  const records = RECORD_SPECS.map((spec) => recordTile(spec, stats, lookup));
  records.push(sniperTile(stats));
  return records;
}

/**
 * One per-battle record: the maximum across the accounts, with the tank the
 * holder names.
 */
function recordTile(
  spec: RecordSpec,
  stats: AccountStatsRead,
  lookup: VehicleLookup,
): OverviewTile {
  // The file was not in the export at all.
  if (!stats.present) return absent(spec.id, null);

  // The file is there, but NO account's header carried the column: an older
  // export revision without it. That is a different sentence from a missing
  // file, and the tile names the column.
  if (!stats.columns[spec.valueField]) return absent(spec.id, spec.column);

  // The maximum, and the row that holds it. A strict `>` keeps the EARLIER
  // account when two hold the same figure.
  // `accounts` counts the rows that carried a figure at all: those are the
  // accounts the maximum was actually chosen from (WR-04), which is fewer than
  // the account folders when one holds no World of Tanks statistics.
  let best: { value: number; tankId: string | null } | null = null;
  let accounts = 0;
  for (const row of stats.rows) {
    const value = row[spec.valueField];
    if (value === null) continue;
    accounts += 1;
    if (best === null || value > best.value) {
      best = { value, tankId: row[spec.tankField] };
    }
  }

  // The column is there and every account's cell says "no value".
  if (best === null) return absent(spec.id, null);

  // The tank the record was fought in — or null when the export did not
  // record one, or when the table has no row for it (D-09).
  const tankName = best.tankId === null ? null : (lookup.byId(best.tankId)?.name ?? null);

  return { id: spec.id, status: 'ok', value: best.value, tankName, accounts };
}

/**
 * The longest sniper series: a maximum too, and the only record with no tank.
 */
function sniperTile(stats: AccountStatsRead): OverviewTile {
  if (!stats.present) return absent('snip', null);
  if (!stats.columns.sniperSeries) return absent('snip', SNIPER_COLUMN);

  let best: number | null = null;
  for (const row of stats.rows) {
    const value = row.sniperSeries;
    if (value === null) continue;
    if (best === null || value > best) best = value;
  }
  if (best === null) return absent('snip', null);

  return { id: 'snip', status: 'ok', value: best };
}
