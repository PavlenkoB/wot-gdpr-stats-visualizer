/**
 * overview-account-stats.ts — the per-account account-statistics reader
 * (13-07, D-04, D-18, D-19, T-13-19, T-13-20).
 *
 * ## What this module is
 *
 * The account-statistics file holds ONE row per account folder: the lifetime
 * totals (battles, wins, battle life) and the RECORD maxima (the best single
 * battle's damage, XP and frags, the tank each was fought in, and the longest
 * sniper series). This module reads those rows and hands the reducers a list
 * of plain per-account figures — no cell text, no headers, no rows.
 *
 * ## Why each account resolves its OWN columns (CR-01, T-13-20)
 *
 * Two accounts' same-named files carry DIFFERENT headers: one spells the
 * battle count `BATTLES_COUNT` and the other `GAMES_PLAYED`. Resolving off
 * one account's first row and reading the other account's cells through those
 * keys would make the second account's data read as absent — a false
 * statement about the user's own data while its file is plainly in the
 * archive. So every group resolves the fields from ITS OWN first row, and
 * the two accounts' figures are combined only after each has been read.
 *
 * ## Why only the FIRST row of a group is read
 *
 * The file holds one row per account. A second row in the same group would be
 * a malformed export, and reading it would double the account's totals — a
 * claim about the user's data that the export does not make. The first row is
 * the account's row; the rest are ignored, and this comment says so.
 *
 * ## Why the NICKNAME is never read (D-18, T-13-19)
 *
 * The account-statistics row's `NAME` column is the player's nickname: a
 * personal value the Overview must never carry (D-18). This module names only
 * numeric and id columns, so `NAME` is never read at all — not read and
 * discarded, but never touched. A Proxy-wrapped row in the unit test records
 * every property this module reads and asserts that `NAME` is not among
 * them, which is a stronger claim than "the value was dropped afterwards".
 *
 * ## Why the specials are never zeros (D-09)
 *
 * `N/D`, `N/A`, a blank and `\N` all mean "no value". None of them is a
 * zero, so every cell that is not a plain number reads as `null` and the
 * caller treats it as an absent figure.
 */

import { cell } from '../../worker/csv-columns.ts';
import type { OverviewFileInput } from './overview-aggregate.ts';
import { readCount, readTankId, resolveFields, type FieldSpec } from './overview-columns.ts';

// -----------------------------------------------------------------------------
// The column vocabulary
// -----------------------------------------------------------------------------

/**
 * The lifetime battle count, under the spellings the exports use.
 *
 * `BATTLES_COUNT` is the World of Tanks name; `GAMES_PLAYED` is what a
 * Warplanes export writes and what one of the two accounts in the fixture
 * archive carries.
 */
const BATTLES_FIELD: FieldSpec = {
  id: 'battles',
  headers: ['BATTLES_COUNT', 'BATTLES', 'GAMES_PLAYED'],
};

/** The lifetime win count. */
const WINS_FIELD: FieldSpec = { id: 'wins', headers: ['WINS_COUNT', 'WINS'] };

/** The lifetime battle life, in seconds. */
const BATTLE_SECONDS_FIELD: FieldSpec = { id: 'battleSeconds', headers: ['BATTLE_LIFE_TIME'] };

/** The best single battle's damage. */
const DAMAGE_MAX_FIELD: FieldSpec = {
  id: 'damageMax',
  headers: ['DAMAGE_MAX', 'MAX_DAMAGE_DEALT'],
};

/** The best single battle's XP. */
const XP_MAX_FIELD: FieldSpec = {
  id: 'xpMax',
  headers: ['XP_MAX', 'MAX_XP', 'MAX_EXP', 'MAX_GAIN_EXPERIENCE'],
};

/** The best single battle's frags. */
const FRAGS_MAX_FIELD: FieldSpec = { id: 'fragsMax', headers: ['FRAGS_MAX', 'MAX_FRAGS'] };

/** The longest sniper series recorded. */
const SNIPER_SERIES_FIELD: FieldSpec = { id: 'sniperSeries', headers: ['SNIPER_SERIES_MAX'] };

/** The tank the best damage was fought in, as a numeric id. */
const DAMAGE_MAX_TANK_FIELD: FieldSpec = {
  id: 'damageMaxTank',
  headers: ['MAX_DAMAGE_VEHICLE'],
};

/** The tank the best XP was fought in, as a numeric id. */
const XP_MAX_TANK_FIELD: FieldSpec = { id: 'xpMaxTank', headers: ['MAX_XP_VEHICLE'] };

/** The tank the best frags were fought in, as a numeric id. */
const FRAGS_MAX_TANK_FIELD: FieldSpec = { id: 'fragsMaxTank', headers: ['MAX_FRAGS_VEHICLE'] };

/**
 * Every field this module reads, in ONE list.
 *
 * The list is the module's whole vocabulary: a field that is not named here
 * is not read, and the list is resolved in ONE pass over each group's first
 * row rather than one pass per field (T-05-12).
 *
 * `NAME` — the nickname — is deliberately absent, and its absence is the
 * privacy rule (D-18, T-13-19).
 */
const ALL_FIELDS: readonly FieldSpec[] = [
  BATTLES_FIELD,
  WINS_FIELD,
  BATTLE_SECONDS_FIELD,
  DAMAGE_MAX_FIELD,
  XP_MAX_FIELD,
  FRAGS_MAX_FIELD,
  SNIPER_SERIES_FIELD,
  DAMAGE_MAX_TANK_FIELD,
  XP_MAX_TANK_FIELD,
  FRAGS_MAX_TANK_FIELD,
];

// -----------------------------------------------------------------------------
// The shapes
// -----------------------------------------------------------------------------

/**
 * One account's figures.
 *
 * Every figure is `number | null`: null means the export does not say, which
 * is not the same as zero. The three tank ids are the raw numeric ids as the
 * export spelled them, or null when the cell does not hold a usable id (the
 * export writes `0` for "not recorded", and that is not an id).
 */
export interface AccountStatsRow {
  /** The account root that owns the row. */
  account: string;
  /** Lifetime battles. */
  battles: number | null;
  /** Lifetime wins. */
  wins: number | null;
  /** Lifetime battle life, in seconds. */
  battleSeconds: number | null;
  /** The best single battle's damage. */
  damageMax: number | null;
  /** The best single battle's XP. */
  xpMax: number | null;
  /** The best single battle's frags. */
  fragsMax: number | null;
  /** The longest sniper series recorded. */
  sniperSeries: number | null;
  /** The tank the best damage was fought in, as a numeric id. */
  damageMaxTank: string | null;
  /** The tank the best XP was fought in, as a numeric id. */
  xpMaxTank: string | null;
  /** The tank the best frags were fought in, as a numeric id. */
  fragsMaxTank: string | null;
}

/**
 * Which columns the export actually carried.
 *
 * A flag is true when AT LEAST ONE account's header resolved that column. It
 * is the difference between "the export has no damage column" (a column-level
 * absence) and "the export has the column and the value is unreadable" — the
 * two are different sentences in the Overview's absent row (D-03, D-09).
 */
export interface AccountStatsColumns {
  battles: boolean;
  wins: boolean;
  battleSeconds: boolean;
  damageMax: boolean;
  xpMax: boolean;
  fragsMax: boolean;
  sniperSeries: boolean;
}

/**
 * The whole read.
 *
 * `present` is true when the file WAS in the export AND at least one account
 * row was read. `rows` holds one entry per account that contributed.
 */
export interface AccountStatsRead {
  present: boolean;
  rows: AccountStatsRow[];
  columns: AccountStatsColumns;
}

// -----------------------------------------------------------------------------
// The reader
// -----------------------------------------------------------------------------

/**
 * The resolved key of a field, or null when the column is not in the export.
 *
 * `Map.get` answers `undefined` for a key the map does not hold, and
 * `resolveFields` always holds every id it was given — so this is the one
 * place that turns "not a key" into "no column", which is the difference
 * between an absence and a zero (D-09).
 */
function keyOf(keys: Map<string, string | null>, id: string): string | null {
  return keys.get(id) ?? null;
}

/**
 * Read the account statistics of every account in the file.
 *
 * Pure: it reads the rows it is handed and returns plain figures. It never
 * throws, whatever a cell holds.
 *
 * The returned `columns` flags say which columns the export carried, and
 * `present` says whether the file was there at all. A caller that wants to
 * tell "no such column" from "no such file" reads both.
 */
export function readAccountStats(input: OverviewFileInput): AccountStatsRead {
  const rows: AccountStatsRow[] = [];
  const columns: AccountStatsColumns = {
    battles: false,
    wins: false,
    battleSeconds: false,
    damageMax: false,
    xpMax: false,
    fragsMax: false,
    sniperSeries: false,
  };

  for (const group of input.groups) {
    const first = group.rows[0];
    // A group with no rows contributes nothing at all.
    if (first === undefined) continue;

    // CR-01: this group's OWN first row resolves this group's OWN columns.
    const keys = resolveFields(first, ALL_FIELDS);
    if (keyOf(keys, 'battles') !== null) columns.battles = true;
    if (keyOf(keys, 'wins') !== null) columns.wins = true;
    if (keyOf(keys, 'battleSeconds') !== null) columns.battleSeconds = true;
    if (keyOf(keys, 'damageMax') !== null) columns.damageMax = true;
    if (keyOf(keys, 'xpMax') !== null) columns.xpMax = true;
    if (keyOf(keys, 'fragsMax') !== null) columns.fragsMax = true;
    if (keyOf(keys, 'sniperSeries') !== null) columns.sniperSeries = true;

    rows.push({
      account: group.account,
      battles: readCount(cell(first, keyOf(keys, 'battles'))),
      wins: readCount(cell(first, keyOf(keys, 'wins'))),
      battleSeconds: readCount(cell(first, keyOf(keys, 'battleSeconds'))),
      damageMax: readCount(cell(first, keyOf(keys, 'damageMax'))),
      xpMax: readCount(cell(first, keyOf(keys, 'xpMax'))),
      fragsMax: readCount(cell(first, keyOf(keys, 'fragsMax'))),
      sniperSeries: readCount(cell(first, keyOf(keys, 'sniperSeries'))),
      damageMaxTank: readTankId(cell(first, keyOf(keys, 'damageMaxTank'))),
      xpMaxTank: readTankId(cell(first, keyOf(keys, 'xpMaxTank'))),
      fragsMaxTank: readTankId(cell(first, keyOf(keys, 'fragsMaxTank'))),
    });
  }

  return { present: input.seen && rows.length > 0, rows, columns };
}
