/**
 * The vehicle view builder over the export's Player_statistics files
 * (phase 05, plan 05-05).
 *
 * ## Why this module exists
 *
 * STATS-01's correctness lives here and not in a component. Everything a
 * vehicle table draws — the column map, the derived win rate and average
 * damage, the battle-type codes, the per-title header, the special values —
 * is produced by pure functions over header-keyed rows, so the same code runs
 * under Node in a unit test and inside the ingest worker against a real export.
 * A wrong answer is wrong in one place and fails in seconds rather than in a
 * browser run hours later.
 *
 * ## The four rules that shape every builder here
 *
 * 1. **Files are matched by an ANCHORED, EXACT, lower-cased name**
 *    ({@link TITLE_FILES}), never by a prefix. `WOTB_`, `WOT_` and
 *    `WOT_Fallout_` all begin with the same three letters, and a prefix test
 *    would read Blitz's vehicles as WoT's and the Fallout file as either
 *    (RESEARCH Pattern 7).
 *
 * 2. **A column is resolved by HEADER NAME, and only from the first row**
 *    ({@link resolveFields}). The four titles spell the same idea five
 *    different ways (`BATTLES_COUNT`, `BATTLES`, `GAMES_PLAYED`), and a
 *    newer export may rename within the family, so each field carries the
 *    spellings it accepts — its own title's header first. A field with no
 *    match is UNRESOLVED and draws a "not in export" cell, which is the honest
 *    answer: a guessed column name would put the wrong number under a heading
 *    the export never gave (PROJECT.md's defensive-parsing constraint).
 *
 * 3. **A special value is never a number** (D-09, T-05-15). `N/D` is the
 *    export's documented "not defined", `N/A` is "not available", a blank is
 *    "this cell says nothing" and an absent column is "this file does not
 *    have it" — four different things, and none of them is a zero. Each is a
 *    separate cell kind that no arithmetic in this file accepts, and a
 *    derived ratio over a zero denominator is a dash rather than 0%.
 *
 * 4. **A builder reads the columns it NAMES, and no others** (T-05-12). The
 *    account file's `NAME` column is the account nickname, which Phase 3 D-21
 *    confines to the identity header, so the per-title header resolves exactly
 *    two columns from it and reads their values by direct access. Nothing here
 *    enumerates a row's keys, spreads a row, or passes one around, so an
 *    identifying value has no path to a view even by accident; the unit test
 *    proves it with rows that record every key read.
 *
 * ## Hostile input
 *
 * Every string that leaves this module is clamped where it is read — to
 * `MAX_VEHICLE_STRING` characters for an id, a nation, a date and a header
 * value, and to `MAX_BATTLE_TYPE_LENGTH` for a battle-type code (T-05-14). Every
 * grouping is a `Map` or a `Set`, never a plain object, so a vehicle id or code
 * of `__proto__` is an ordinary string that writes nothing onto
 * `Object.prototype` (T-05-13). Every ordering compares CODE UNITS and never a
 * locale-aware collation, so two viewers in two locales agree on one order, and
 * a value of `__proto__` is a Map key or a `Set` member like any other.
 *
 * ## Nothing here reads a clock or a network
 *
 * Dates are parsed by `parseSessionTimestamp` from `playtime.ts` — the same
 * range-checked wall-clock reader Phase 4 uses — and are carried as the text the
 * export wrote PLUS those seconds, so the page can sort on a number and show
 * what was written, and no value is ever routed through an instant (D-01).
 *
 * Decisions: D-05 (title states), D-06 (the main file is the All view),
 * D-07 (battle-type codes and summary), D-08 (Warships battles only),
 * D-09 (special values, Warplanes), D-10 (core columns and derived values),
 * D-11 (nation-tagged ids), D-13 (the per-title header).
 * Threats: T-05-12..T-05-15.
 */

import { cell, headerKey, type AccountRowGroup } from '../../worker/csv-columns.ts';
import { parseSessionTimestamp } from '../playtime/playtime-aggregate';
import {
  MAX_BATTLE_TYPE_CODES,
  MAX_BATTLE_TYPE_LENGTH,
  MAX_VEHICLE_STRING,
  VEHICLE_TITLES,
  type BattleTypeSummaryRow,
  type ColumnKind,
  type SpecialKey,
  type TitleOverview,
  type VehicleCell,
  type VehicleColumn,
  type VehicleHeader,
  type VehicleRow,
  type VehicleRowData,
  type VehicleTitleId,
  type VehicleView,
  type Warplanes20Note,
} from './vehicle-shared';

// ---------------------------------------------------------------------------
// The file table
// ---------------------------------------------------------------------------

/**
 * The files one title owns, by exact lower-cased name.
 *
 * `accounts` is a LIST in preference order rather than one name: the Warplanes
 * table is built from `WOWP_19_Plane_Statistics.csv` while `WOWP_20` has no
 * vehicle identifier at all and is only a note (D-09), so the header falls back
 * to the 20 account file exactly when the 19 one has no row (RESEARCH
 * Pitfall 9).
 */
interface TitleFiles {
  main: string;
  byType: string | null;
  battleTypes: string | null;
  accounts: readonly string[];
  /**
   * Files the title owns that are neither its table, its battle types nor its
   * header — today only the Warplanes 20 plane file, which has no vehicle
   * identifier and is therefore a note rather than a table (D-09).
   */
  extras: readonly string[];
}

const TITLE_FILES: Record<VehicleTitleId, TitleFiles> = {
  wot: {
    main: 'wot_vehicle_statistics.csv',
    byType: 'wot_vehicle_statistics_by_type.csv',
    battleTypes: 'wot_battle_types_statistics.csv',
    accounts: ['wot_account_statistics.csv'],
    extras: [],
  },
  wotb: {
    main: 'wotb_vehicle_statistics.csv',
    byType: 'wotb_vehicle_statistics_by_type.csv',
    battleTypes: 'wotb_battle_types_statistics.csv',
    accounts: ['wotb_account_statistics.csv'],
    extras: [],
  },
  wows: {
    main: 'wows_ship_statistics.csv',
    byType: 'wows_ship_statistics_by_type.csv',
    battleTypes: 'wows_battle_types_statistics.csv',
    accounts: ['wows_account_statistics.csv'],
    extras: [],
  },
  wowp: {
    main: 'wowp_19_plane_statistics.csv',
    byType: null,
    battleTypes: null,
    accounts: ['wowp_19_account_statistics.csv', 'wowp_20_account_statistics.csv'],
    extras: ['wowp_20_plane_statistics.csv'],
  },
};

/** Every file name one title owns, in the order the table names them. */
function ownedFiles(title: VehicleTitleId): readonly string[] {
  const files = TITLE_FILES[title];
  return [files.main, files.byType, files.battleTypes, ...files.accounts, ...files.extras].filter(
    (name): name is string => name !== null,
  );
}

/**
 * Every file name the reader must fetch, lower-cased.
 *
 * Built from {@link TITLE_FILES} rather than written out beside it, so the
 * list the zip reader screens on and the table the builder resolves through
 * cannot drift apart. Sixteen names: four per title for the three that have
 * them, and the Warplanes 19 and 20 pairs for the fourth, which has no
 * by_Type and no battle-type file at all.
 */
export const VEHICLE_FILE_NAMES: ReadonlySet<string> = new Set(
  VEHICLE_TITLES.flatMap((title) => ownedFiles(title)),
);

// ---------------------------------------------------------------------------
// The file map the reader hands over
// ---------------------------------------------------------------------------

/**
 * What the reader knows about one file: whether it was in the zip at all, and
 * the rows the production parser produced — grouped per ACCOUNT.
 *
 * `seen` is separate from the row count on purpose, and the difference is a
 * title state (D-05): a file that was never in the zip is `not-in-export`, a
 * file that was in it and parsed to no data rows is `no-rows`, and only the
 * second one has a header worth showing.
 *
 * The grouping is load-bearing, not bookkeeping (CR-01). Every resolution in
 * this module walks the FIRST row's keys, and two accounts' same-named files
 * carry their own headers — resolving off one account's row made the other's
 * `VEHICLE_NAME` read as absent and `splitVehicleId(undefined)` produce the
 * empty name for every row.
 */
export interface VehicleFileFacts {
  groups: readonly AccountRowGroup<VehicleRowData>[];
  seen: boolean;
}

/** The files of one export, keyed by lower-cased exact file name. */
export type VehicleFiles = ReadonlyMap<string, VehicleFileFacts>;

/** What the caller asked for. Either half may be null. */
export interface VehicleViewRequest {
  title: VehicleTitleId | null;
  battleType: string | null;
}

/** The facts of one file, or an UNSEEN stand-in when the zip had none. */
function factsOf(files: VehicleFiles, name: string): VehicleFileFacts {
  return files.get(name) ?? { groups: [], seen: false };
}

/** The per-account groups of one file, or none when the zip had no such file. */
function groupsOf(
  files: VehicleFiles,
  name: string | null,
): readonly AccountRowGroup<VehicleRowData>[] {
  return name === null ? [] : factsOf(files, name).groups;
}

/** How many rows a file holds across EVERY account's group (D-11 adds them up). */
function rowCountOf(groups: readonly AccountRowGroup<VehicleRowData>[]): number {
  let total = 0;
  for (const group of groups) total += group.rows.length;
  return total;
}

/**
 * Each group's resolved field keys, from that group's OWN first row.
 *
 * One key enumeration per group rather than per row, which keeps the T-05-12
 * Proxy canary honest — the count grew with the number of ACCOUNTS, never with
 * the number of rows.
 */
function resolvedByGroup(
  groups: readonly AccountRowGroup<VehicleRowData>[],
  fields: readonly RawField[],
): Map<string, string | null>[] {
  return groups.map((group) => resolveFields(group.rows[0], fields));
}

/**
 * What the accounts resolved BETWEEN them: a field counts as resolved when ANY
 * group resolved it, so a column only the second account's header carries is
 * still listed.
 *
 * The VALUES here are never used to read a cell — {@link mapRow} takes the
 * group's OWN map — and {@link listColumns} only tests for null. That is what
 * makes a union the right shape for the COLUMN LIST and the wrong one for a
 * cell: a key taken from another account's header is absent from this account's
 * rows, which is exactly the defect one layer down.
 */
function unionResolved(maps: readonly Map<string, string | null>[]): Map<string, string | null> {
  const union = new Map<string, string | null>();
  // Seeded from the FIRST map, NULLS INCLUDED: `resolveFields` gives every field
  // an entry, and `listColumns` asks `fields.get(id) !== null`, so an id left
  // absent would read as resolved rather than as not-in-export.
  for (const [id, key] of maps[0] ?? []) union.set(id, key);
  for (const map of maps) {
    for (const [id, key] of map) {
      if (key !== null && union.get(id) === null) union.set(id, key);
    }
  }
  return union;
}

// ---------------------------------------------------------------------------
// The per-title field specs
// ---------------------------------------------------------------------------

/**
 * One value the view reads, and the header names that may spell it.
 *
 * The accepted spellings are the title's own header first and the other
 * titles' after it, matched on a trimmed upper-cased key. That is an
 * input-tolerance choice, not a promise that any header name is stable: a
 * newer export that renames within the family still maps, and one that does
 * not degrades to a "not in export" cell rather than to a wrong number
 * (RESEARCH A8).
 */
interface RawField {
  readonly id: string;
  readonly headers: readonly string[];
}

/** How a DERIVED column divides two raw fields into one. */
interface DerivedSpec {
  readonly numerator: string;
  readonly denominator: string;
  /** The special a zero denominator produces: a dash, never a zero. */
  readonly empty: SpecialKey;
  /**
   * 100 for a percent column (the win rate, a survival rate, a hit ratio) and
   * 1 for an average, which is the same quotient unscaled. The multiply is a
   * real float operation, so `(55 / 100) * 100` is 55.00000000000001 and not
   * 55 — the oracle records the product for exactly that reason.
   */
  readonly scale: number;
}

/** One column of one title's table. */
interface ColumnSpec {
  readonly key: string;
  readonly kind: ColumnKind;
  /** Core columns are always listed, even when their header is absent. */
  readonly core: boolean;
  /** False only where sorting has no meaning (D-08's two per-type columns). */
  readonly sortable: boolean;
  /** The raw field a direct column reads; null when the column is derived. */
  readonly source: string | null;
  readonly derived: DerivedSpec | null;
  /** A special every cell of this column holds, ignoring the row entirely. */
  readonly fixedCell: SpecialKey | null;
}

/** One title's whole field spec: what it reads and what it shows. */
interface TitleSpec {
  readonly raw: readonly RawField[];
  readonly columns: readonly ColumnSpec[];
}

/** The vehicle name of a row, under the only header that carries one. */
const VEHICLE_FIELD: RawField = { id: 'vehicle', headers: ['VEHICLE_NAME'] };

/**
 * The battle count, under the three spellings the four titles use.
 *
 * WoT and Blitz write `BATTLES_COUNT`, Warplanes 19 writes `GAMES_PLAYED` and
 * Warplanes 20 writes `BATTLES`. With only the first spelling the Warplanes
 * header would read "not in export" on every account (RESEARCH Pitfall 9).
 */
const BATTLES_FIELD: RawField = {
  id: 'battles',
  headers: ['BATTLES_COUNT', 'BATTLES', 'GAMES_PLAYED'],
};

/** The win count, under WoT's and the other titles' spellings. */
const WINS_FIELD: RawField = { id: 'wins', headers: ['WINS_COUNT', 'WINS'] };

/** Damage dealt, under the vehicle-statistics and the plane-statistics name. */
const DAMAGE_FIELD: RawField = {
  id: 'damage',
  headers: ['DAMAGE_DEALT', 'TOTAL_DAMAGE_DEALT'],
};

/** Frags (WoT, Blitz) or kills (Warplanes), which are the same column. */
const FRAGS_FIELD: RawField = {
  id: 'frags',
  headers: ['FRAGS_COUNT', 'FRAGS', 'TOTAL_KILLED'],
};

/** Experience: `XP_AMOUNT` (WoT), `XP` (Blitz), `EXP` (Warships), `GAIN_EXPERIENCE`. */
const XP_FIELD: RawField = {
  id: 'xp',
  headers: ['XP_AMOUNT', 'XP', 'EXP', 'GAIN_EXPERIENCE'],
};

/** Battles survived, which is a rate against the battle count, not a count. */
const SURVIVED_FIELD: RawField = {
  id: 'survived',
  headers: ['SURVIVED_BATTLES', 'SURVIVED'],
};

const HITS_FIELD: RawField = { id: 'hits', headers: ['HITS_COUNT', 'HITS', 'TOTAL_HITS'] };
const SHOTS_FIELD: RawField = { id: 'shots', headers: ['SHOTS_COUNT', 'SHOTS', 'TOTAL_SHOTS'] };
const MAX_DAMAGE_FIELD: RawField = {
  id: 'maxDamage',
  headers: ['DAMAGE_MAX', 'MAX_DAMAGE_DEALT'],
};
const MAX_FRAGS_FIELD: RawField = { id: 'maxFrags', headers: ['FRAGS_MAX', 'MAX_FRAGS'] };
const MAX_XP_FIELD: RawField = {
  id: 'maxXp',
  headers: ['XP_MAX', 'MAX_XP', 'MAX_EXP', 'MAX_GAIN_EXPERIENCE'],
};
const DAMAGE_RECEIVED_FIELD: RawField = { id: 'damageReceived', headers: ['DAMAGE_RECEIVED'] };
const SPOTTED_FIELD: RawField = { id: 'spotted', headers: ['SPOTTED_COUNT', 'SPOTTED'] };
const PLANES_KILLED_FIELD: RawField = { id: 'planesDestroyed', headers: ['PLANES_KILLED'] };
const DISTANCE_FIELD: RawField = { id: 'distance', headers: ['DISTANCE'] };
const LAST_BATTLE_FIELD: RawField = {
  id: 'lastBattle',
  headers: ['LAST_BATTLE_AT', 'LAST_BATTLE_TIME', 'LAST_GAME_TIME'],
};
const IN_GARAGE_FIELD: RawField = { id: 'inGarage', headers: ['IN_GARAGE'] };

/** The battle-type code column, which only the by_Type and summary files carry. */
const TYPE_FIELD: RawField = { id: 'type', headers: ['TYPE'] };

/**
 * The Warplanes 20 battle column, which is `BATTLES` there and nothing else.
 *
 * It is named separately from {@link BATTLES_FIELD} so the note's total is
 * summed from the 20 file's OWN column rather than from a spelling list that
 * would also accept `GAMES_PLAYED` — the note is about one file, and a drifted
 * header should read as a note with no battles rather than borrow another
 * file's column.
 */
const WOWP20_BATTLES_FIELD: RawField = { id: 'battles', headers: ['BATTLES'] };

/**
 * Every raw field any title may read, in one list.
 *
 * A title's spec names the fields it shows; this is the whole vocabulary they
 * are drawn from, so {@link resolveFields} resolves a title's fields in ONE
 * pass over the first row's keys rather than one pass per field.
 */
const ALL_FIELDS: readonly RawField[] = [
  VEHICLE_FIELD,
  BATTLES_FIELD,
  WINS_FIELD,
  DAMAGE_FIELD,
  FRAGS_FIELD,
  XP_FIELD,
  SURVIVED_FIELD,
  HITS_FIELD,
  SHOTS_FIELD,
  MAX_DAMAGE_FIELD,
  MAX_FRAGS_FIELD,
  MAX_XP_FIELD,
  DAMAGE_RECEIVED_FIELD,
  SPOTTED_FIELD,
  PLANES_KILLED_FIELD,
  DISTANCE_FIELD,
  LAST_BATTLE_FIELD,
  IN_GARAGE_FIELD,
];

/** A direct column: one raw field, shown as written. */
function direct(key: string, kind: ColumnKind, source: string, core = false): ColumnSpec {
  return { key, kind, core, sortable: true, source, derived: null, fixedCell: null };
}

/** A derived column: two raw fields divided into one, with a zero dash. */
function derived(
  key: string,
  kind: ColumnKind,
  numerator: string,
  denominator: string,
  empty: SpecialKey,
  core: boolean,
): ColumnSpec {
  return {
    key,
    kind,
    core,
    sortable: true,
    source: null,
    derived: { numerator, denominator, empty, scale: kind === 'percent' ? 100 : 1 },
    fixedCell: null,
  };
}

/**
 * A column whose every cell is the same special and which therefore cannot be
 * sorted (D-08).
 *
 * The two Warships All-battles cells are this: wins and damage exist only in
 * the by_Type file, so in the All view every row reads the same per-type note.
 * Making that a property of the COLUMN rather than of each row is what makes
 * "every cell is the per-type special and neither header is a sort button" a
 * structural property instead of a promise.
 */
function perTypeColumn(key: string, kind: ColumnKind): ColumnSpec {
  return {
    key,
    kind,
    core: true,
    sortable: false,
    source: null,
    derived: null,
    fixedCell: 'per-type',
  };
}

/**
 * The six core columns every title but Warships' All view shows (D-10).
 *
 * Vehicle, battles, win rate, average damage, frags and total XP, in that
 * order. Win rate and average damage are COMPUTED here rather than read, so a
 * title that has no wins column shows "not in export" instead of a zero.
 */
const CORE_COLUMNS: readonly ColumnSpec[] = [
  direct('vehicle', 'text', 'vehicle', true),
  direct('battles', 'count', 'battles', true),
  derived('winRate', 'percent', 'wins', 'battles', 'no-battles', true),
  derived('avgDamage', 'whole', 'damage', 'battles', 'no-battles', true),
  direct('frags', 'count', 'frags', true),
  direct('xp', 'count', 'xp', true),
];

/**
 * Every extra a title's column picker MAY offer, in the order the picker shows
 * them (D-10, UI-SPEC section 3).
 *
 * A single superset per title rather than a list per file: an extra is listed
 * only when its own header resolved in THIS file, so WoT's All view offers Max
 * frags and Max XP but not Max damage (its file has no `DAMAGE_MAX`), while
 * WoT's battle-type view offers all three. The two lists in the UI-SPEC are
 * then a property of the files rather than a second hand-maintained table.
 */
const EXTRA_COLUMNS: readonly ColumnSpec[] = [
  derived('survival', 'percent', 'survived', 'battles', 'no-battles', false),
  derived('hitRatio', 'percent', 'hits', 'shots', 'no-shots', false),
  direct('maxDamage', 'count', 'maxDamage'),
  direct('maxFrags', 'count', 'maxFrags'),
  direct('maxXp', 'count', 'maxXp'),
  direct('damageReceived', 'count', 'damageReceived'),
  direct('spotted', 'count', 'spotted'),
  direct('planesDestroyed', 'count', 'planesDestroyed'),
  direct('distance', 'count', 'distance'),
  direct('lastBattle', 'date', 'lastBattle'),
  direct('inGarage', 'garage', 'inGarage'),
];

/** One title's spec: the core six plus the extras that may apply to it. */
function titleSpec(extra: readonly ColumnSpec[] = EXTRA_COLUMNS): TitleSpec {
  return { raw: ALL_FIELDS, columns: [...CORE_COLUMNS, ...extra] };
}

/**
 * The Warships All-battles spec (D-08) — the one view that is not the core six.
 *
 * `WOWS_Ship_Statistics.csv` has no wins, no damage, no frags and no XP: those
 * exist only in the by_Type file, so the All view shows the ship's own battles,
 * when it last fought and whether it is in the garage, and the two computed
 * columns read the same per-type note in every row. Distance is the only extra
 * the file can offer.
 */
const WARSHIPS_ALL_SPEC: TitleSpec = {
  raw: ALL_FIELDS,
  columns: [
    direct('vehicle', 'text', 'vehicle', true),
    direct('battles', 'count', 'battles', true),
    direct('lastBattle', 'date', 'lastBattle', true),
    direct('inGarage', 'garage', 'inGarage', true),
    perTypeColumn('winRate', 'percent'),
    perTypeColumn('avgDamage', 'whole'),
    direct('distance', 'count', 'distance'),
  ],
};

/** The per-title specs. The four titles differ in their file names, not rules. */
const TITLE_SPECS: Record<VehicleTitleId, TitleSpec> = {
  wot: titleSpec(),
  wotb: titleSpec(),
  wows: titleSpec(),
  wowp: titleSpec(),
};

/** The spec one title shows in its All-battles view. */
function allBattlesSpec(title: VehicleTitleId): TitleSpec {
  return title === 'wows' ? WARSHIPS_ALL_SPEC : TITLE_SPECS[title];
}

// ---------------------------------------------------------------------------
// Reading a cell
// ---------------------------------------------------------------------------

/** The export's documented "not defined" spelling, compared case-folded. */
const NOT_DEFINED = 'N/D';

/** The export's documented "not available" spelling, compared case-folded. */
const NOT_AVAILABLE = 'N/A';

/** Clamp every string that leaves this module (RESEARCH Pitfall 13). */
function clamp(text: string): string {
  return text.slice(0, MAX_VEHICLE_STRING);
}

/**
 * Resolve every field a title may show, from the FIRST row's keys only.
 *
 * One walk of the key list for the whole field set, which is both the cheaper
 * shape and the one a Proxy canary can assert: one enumeration per file, never
 * per row and never per field (T-05-12).
 *
 * Only the first row is inspected, so a file whose later rows carry extra
 * columns cannot change which column is which — the same rule
 * `resolveSessionColumns` follows in `playtime.ts`. When a field matches more
 * than one accepted spelling, the key that appears FIRST IN THE ROW wins
 * rather than the first spelling in the list, so a header carrying both
 * `FRAGS_COUNT` and the blank `FRAGS` column resolves to the one that has data.
 */
function resolveFields(
  row: VehicleRowData | undefined,
  fields: readonly RawField[],
): Map<string, string | null> {
  const resolved = new Map<string, string | null>();
  for (const field of fields) resolved.set(field.id, null);
  if (row === undefined) return resolved;
  for (const key of Object.keys(row)) {
    const normalized = headerKey(key);
    for (const field of fields) {
      if (resolved.get(field.id) === null && field.headers.includes(normalized)) {
        resolved.set(field.id, key);
      }
    }
  }
  return resolved;
}

/**
 * A numeric cell, or the special it turned out to be.
 *
 * The order is the whole contract and it matches the export's own vocabulary:
 * an absent column is `missing`; `N/D` is `nd`; `N/A`, a blank and anything
 * that is not a finite number are `na`; anything else is a number. A blank is
 * rejected BEFORE the parse, because `Number('')` is 0 and a blank cell
 * reading as a zero is exactly the claim D-09 forbids.
 */
function readNumber(row: VehicleRowData, key: string | null): VehicleCell {
  if (key === null) return { t: 'x', v: 'missing' };
  const raw = row[key];
  if (raw === undefined) return { t: 'x', v: 'na' };
  const text = raw.trim();
  const upper = text.toUpperCase();
  if (upper === NOT_DEFINED) return { t: 'x', v: 'nd' };
  if (upper === NOT_AVAILABLE || text === '') return { t: 'x', v: 'na' };
  const value = Number(text);
  return Number.isFinite(value) ? { t: 'n', v: value } : { t: 'x', v: 'na' };
}

/**
 * A date cell: the text the export wrote plus the seconds it names.
 *
 * `k` is null when the text does not parse, and the cell still carries the text
 * — a last-battle column the app cannot date is shown as written rather than
 * hidden, because the player is the only one who can read it (D-13).
 */
function readDate(row: VehicleRowData, key: string | null): VehicleCell {
  if (key === null) return { t: 'x', v: 'missing' };
  const raw = row[key];
  if (raw === undefined) return { t: 'x', v: 'na' };
  const text = raw.trim();
  const upper = text.toUpperCase();
  if (upper === NOT_DEFINED) return { t: 'x', v: 'nd' };
  if (upper === NOT_AVAILABLE || text === '') return { t: 'x', v: 'na' };
  return { t: 'd', v: clamp(text), k: parseSessionTimestamp(text) };
}

/**
 * A garage flag: `1`/`T` are yes and `0`/`F` are no, and anything else is not
 * available rather than a guess.
 *
 * The export's readme documents `F`/`T` and the 2021 sample writes `1`/`0`;
 * both are the same flag, and a cell that is neither is a value this app will
 * not interpret (RESEARCH A8).
 */
function readGarage(row: VehicleRowData, key: string | null): VehicleCell {
  if (key === null) return { t: 'x', v: 'missing' };
  const raw = row[key];
  if (raw === undefined) return { t: 'x', v: 'na' };
  const text = raw.trim();
  const upper = text.toUpperCase();
  if (upper === '1' || upper === 'T') return { t: 'b', v: true };
  if (upper === '0' || upper === 'F') return { t: 'b', v: false };
  return { t: 'x', v: 'na' };
}

/** The special a cell holds, or null when it holds a value. */
function specialOf(cell: VehicleCell): SpecialKey | null {
  return cell.t === 'x' ? cell.v : null;
}

/**
 * Divide two cells into a third, honouring every special on the way (D-09).
 *
 * The decision order is fixed and each step wins over the next: an absent
 * column on either side is `missing` (it reports itself rather than borrowing
 * the other cell's spelling), then `N/D` on either side is `nd`, then
 * `N/A`/blank/unreadable is `na`, and only then is a zero denominator the
 * view's own dash. That order is why `N/D` damage over zero battles is
 * `not defined` rather than a dash: the export said the quantity does not
 * exist, which outranks the fact that there was nothing to divide.
 */
function derive(numerator: VehicleCell, denominator: VehicleCell, spec: DerivedSpec): VehicleCell {
  const top = specialOf(numerator);
  const bottom = specialOf(denominator);
  if (top === 'missing' || bottom === 'missing') return { t: 'x', v: 'missing' };
  if (top === 'nd' || bottom === 'nd') return { t: 'x', v: 'nd' };
  if (top === 'na' || bottom === 'na') return { t: 'x', v: 'na' };
  if (numerator.t !== 'n' || denominator.t !== 'n') return { t: 'x', v: 'missing' };
  // A ratio over nothing is a dash, never a zero: a win rate of 0% would be a
  // claim about a vehicle that has never fought (D-09).
  if (denominator.v === 0) return { t: 'x', v: spec.empty };
  return { t: 'n', v: (numerator.v / denominator.v) * spec.scale };
}

/**
 * Split a vehicle name into a nation tag and the rest, exactly as written
 * (D-11).
 *
 * The colon rule is generic across the four titles even though only WoT's ids
 * are verified to carry a prefix (RESEARCH A9): a name with no colon has no
 * tag, and a name that STARTS with a colon has no tag either, because the text
 * before it is empty. No lookup, no bundled name map and no case folding — the
 * export never claimed two spellings are one vehicle.
 */
function splitVehicleId(raw: string | undefined): { id: string; nation: string | null } {
  const text = clamp((raw ?? '').trim());
  const colon = text.indexOf(':');
  if (colon < 0) return { id: text, nation: null };
  const nation = text.slice(0, colon);
  const id = text.slice(colon + 1);
  return nation === '' ? { id, nation: null } : { id, nation: clamp(nation) };
}

// ---------------------------------------------------------------------------
// Building the table
// ---------------------------------------------------------------------------

/** Whether a column's own source(s) resolved, i.e. whether it can be listed. */
function resolved(spec: ColumnSpec, fields: Map<string, string | null>): boolean {
  if (spec.derived !== null) {
    return (
      fields.get(spec.derived.numerator) !== null && fields.get(spec.derived.denominator) !== null
    );
  }
  return spec.source !== null && fields.get(spec.source) !== null;
}

/**
 * The columns this file can show: every core column, plus the extras whose own
 * headers are present.
 *
 * A core column whose header is ABSENT still appears, with a "not in export"
 * cell in every row (D-10) — a missing column the table omits entirely would
 * read as "this app does not show it", which is a different claim.
 */
function listColumns(spec: TitleSpec, fields: Map<string, string | null>): readonly ColumnSpec[] {
  return spec.columns.filter((column) => column.core || resolved(column, fields));
}

/** The published form of a column spec. */
function toColumn(spec: ColumnSpec): VehicleColumn {
  return { key: spec.key, kind: spec.kind, core: spec.core, sortable: spec.sortable };
}

// ---------------------------------------------------------------------------
// Battle-type codes
// ---------------------------------------------------------------------------

/** A battle-type code as it leaves this module: trimmed and length-bounded. */
function codeOf(raw: string | undefined): string {
  return (raw ?? '').trim().slice(0, MAX_BATTLE_TYPE_LENGTH);
}

/** A code that is a whole number, or null when it is not one. */
function integerCode(code: string): number | null {
  if (code === '') return null;
  const value = Number(code);
  return Number.isInteger(value) ? value : null;
}

/**
 * Order two battle-type codes: numerically when both are whole numbers, and by
 * code unit otherwise.
 *
 * The numeric order is a decided rule, not an accident — codes are
 * identifiers, and a stable numeric order is easier to scan than a
 * data-dependent one, so plain code-unit order (which would put `10` between
 * `1` and `2`) is wrong here. A code that is not a whole number sorts AFTER
 * every code that is, and then by code unit, so the comparator stays a total
 * order either way. Distinctness is by the code STRING: `1` and `01` are two
 * codes, because the export never claimed they were one.
 */
function compareCodes(a: string, b: string): number {
  const left = integerCode(a);
  const right = integerCode(b);
  if (left !== null && right !== null) return left - right;
  if ((left !== null) !== (right !== null)) return left !== null ? -1 : 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * The distinct battle-type codes this title's by_Type rows carry (D-07).
 *
 * The FILTER offers only these, and at most {@link MAX_BATTLE_TYPE_CODES} of
 * them, which bounds both the `<select>` and the work a corrupt file can cost.
 * The codes are read as strings, never named (D-07): the export contains no
 * document that says what code 3 is.
 *
 * The list is the UNION of the accounts' code lists, each read through its own
 * group's resolved `type` key (CR-01), de-duplicated and then sorted by the same
 * comparator a single account's list has always been sorted by — so a
 * same-header fixture produces a byte-identical list.
 */
function battleTypeCodes(
  groups: readonly AccountRowGroup<VehicleRowData>[],
  maps: readonly Map<string, string | null>[],
): string[] {
  const distinct = new Set<string>();
  for (let g = 0; g < groups.length && distinct.size < MAX_BATTLE_TYPE_CODES; g++) {
    const key = maps[g]?.get('type') ?? null;
    if (key === null) continue;
    for (const row of groups[g]!.rows) {
      if (distinct.size >= MAX_BATTLE_TYPE_CODES) break;
      distinct.add(codeOf(row[key]));
    }
  }
  return [...distinct].sort(compareCodes);
}

/**
 * The battle-type summary: one row per code of the Battle_Types file, with the
 * battles, wins and damage that code recorded.
 *
 * This file is a DIFFERENT list from the filter's: it routinely names codes the
 * by_Type rows do not carry (the sample's WoT summary lists five codes and the
 * by_Type file has three), and a summary row with no selectable option is
 * expected rather than a bug (RESEARCH Pitfall 10). The summary is therefore
 * never filtered down to the selectable codes.
 *
 * Ordered by battles DESCENDING, because the summary answers "where do my
 * battles go", with ties broken by the same code order the filter uses. A
 * battles cell that is not a number sorts last in both directions, since a
 * special never counts as zero in an order (D-09).
 *
 * ## One row per code, summed across accounts (Phase 10, D-09)
 *
 * The rows stay PER ACCOUNT — the same vehicle id in two accounts is two rows,
 * and only the summary folds. Each code is accumulated in a `Map`, never an
 * object: a code is an untrusted cell (T-05-14 clamps it to 64 characters, not
 * to a safe word), so a code literally named `__proto__` is a key like any other
 * (T-10-09).
 *
 * The three figures fold INDEPENDENTLY, which is the part that is easy to get
 * wrong: battles can be a number for one account and `N/D` for the other, and
 * the answer is the sum of the numbers rather than either value chosen. Only a
 * code whose EVERY contributing cell is a special keeps a special, and then the
 * FIRST one — the same "a special never counts as a number" rule D-09 applies
 * everywhere else.
 *
 * With ONE account the fold is the identity on every cell, so a single-account
 * summary is byte-identical to the rows the pre-Phase-10 push loop produced.
 */
function buildSummary(
  files: VehicleFiles,
  title: VehicleTitleId,
  codes: readonly string[],
): BattleTypeSummaryRow[] {
  // A title with no codes has no battle-type table to summarise, and the
  // summary and the filter are shown and hidden together (UI-SPEC section 3).
  if (codes.length === 0) return [];
  const groups = groupsOf(files, TITLE_FILES[title].battleTypes);
  const fields = [TYPE_FIELD, BATTLES_FIELD, WINS_FIELD, DAMAGE_FIELD];
  // Per group, from that group's own first row (CR-01).
  const folded = new Map<
    string,
    { battles: VehicleCell; wins: VehicleCell; damage: VehicleCell }
  >();
  for (const group of groups) {
    const keys = resolveFields(group.rows[0], fields);
    for (const row of group.rows) {
      const code = codeOf(cell(row, keys.get('type') ?? null));
      const incoming = {
        battles: readNumber(row, keys.get('battles') ?? null),
        wins: readNumber(row, keys.get('wins') ?? null),
        damage: readNumber(row, keys.get('damage') ?? null),
      };
      const existing = folded.get(code);
      if (existing === undefined) {
        folded.set(code, incoming);
        continue;
      }
      folded.set(code, {
        battles: sumCells(existing.battles, incoming.battles),
        wins: sumCells(existing.wins, incoming.wins),
        damage: sumCells(existing.damage, incoming.damage),
      });
    }
  }
  const summary: BattleTypeSummaryRow[] = [...folded].map(([code, cells]) => ({
    code,
    battles: cells.battles,
    wins: cells.wins,
    damage: cells.damage,
  }));
  summary.sort((a, b) => {
    const usableA = a.battles.t === 'n';
    const usableB = b.battles.t === 'n';
    if (usableA !== usableB) return usableA ? -1 : 1;
    if (usableA && usableB && a.battles.t === 'n' && b.battles.t === 'n') {
      const difference = b.battles.v - a.battles.v;
      if (difference !== 0) return difference;
    }
    return compareCodes(a.code, b.code);
  });
  return summary;
}

/**
 * One cell plus the next, under the summary's fold rule (D-09, D-11).
 *
 * Any numeric contribution makes the result the SUM OF THE NUMBERS, so a
 * `not available` from one account and a `not defined` from the next read as
 * their combined figure rather than as one account's answer standing for both.
 * Only an all-special pair keeps a special, and then the FIRST — an absent or
 * undefined value is not a number, and picking the later one would make the
 * result depend on which account the archive happened to list first.
 */
function sumCells(accumulated: VehicleCell, incoming: VehicleCell): VehicleCell {
  if (accumulated.t === 'n') {
    return incoming.t === 'n' ? { t: 'n', v: accumulated.v + incoming.v } : accumulated;
  }
  return incoming.t === 'n' ? incoming : accumulated;
}

/**
 * The Warplanes 20 note (D-09): how many plane records the newer file holds and
 * how many battles they record between them.
 *
 * There is no vehicle identifier in that file, so there is nothing to put in a
 * vehicle cell and it is never a table. The battle total sums only cells that
 * are finite numbers, so a special contributes nothing rather than a zero that
 * would be indistinguishable from a real zero battle.
 */
function buildWowp20Note(files: VehicleFiles): Warplanes20Note | null {
  const groups = groupsOf(files, 'wowp_20_plane_statistics.csv');
  const records = rowCountOf(groups);
  if (records === 0) return null;
  // Per group, from that group's own first row (CR-01), and the totals add up
  // across accounts (D-11) exactly as the rows themselves do.
  let battles = 0;
  for (const group of groups) {
    const key = resolveFields(group.rows[0], [WOWP20_BATTLES_FIELD]).get('battles') ?? null;
    for (const row of group.rows) {
      const cellOfRow = readNumber(row, key);
      if (cellOfRow.t === 'n') battles += cellOfRow.v;
    }
  }
  return { records, battles };
}

/** Build one row's cell for a direct column, by its kind. */
function directCell(row: VehicleRowData, key: string | null, kind: ColumnKind): VehicleCell {
  if (kind === 'date') return readDate(row, key);
  if (kind === 'garage') return readGarage(row, key);
  if (kind === 'text') {
    if (key === null) return { t: 'x', v: 'missing' };
    const raw = row[key];
    if (raw === undefined) return { t: 'x', v: 'na' };
    return { t: 's', v: clamp(raw.trim()) };
  }
  return readNumber(row, key);
}

/**
 * Map one parsed row onto the view's columns.
 *
 * The vehicle column's cell is the CLEANED id, so a row and its cells always
 * agree with `row.id`; the raw name never reaches the table twice.
 *
 * `account` is the OWNING GROUP's root, passed in rather than read from `row`:
 * no cell of a vehicle file carries an account, and a row that took its owner
 * from its own contents could be attributed to anything the archive put in a
 * cell (D-10, T-10-10). The caller is the loop over `AccountRowGroup`, so the
 * stamp is as trustworthy as the file it came from.
 */
function mapRow(
  row: VehicleRowData,
  fields: Map<string, string | null>,
  columns: readonly ColumnSpec[],
  account: string,
): VehicleRow {
  const vehicle = splitVehicleId(cell(row, fields.get('vehicle') ?? null));
  const cells: VehicleCell[] = [];
  let battles: number | null = null;

  for (const column of columns) {
    let built: VehicleCell;
    if (column.fixedCell !== null) {
      // D-08: this column has no per-row value at all, so every cell — in every
      // row — is the same note.
      built = { t: 'x', v: column.fixedCell };
    } else if (column.derived !== null) {
      built = derive(
        readNumber(row, fields.get(column.derived.numerator) ?? null),
        readNumber(row, fields.get(column.derived.denominator) ?? null),
        column.derived,
      );
    } else if (column.key === 'vehicle') {
      built = { t: 's', v: vehicle.id };
    } else {
      built = directCell(row, fields.get(column.source ?? '') ?? null, column.kind);
    }
    cells.push(built);
    if (column.key === 'battles' && built.t === 'n') battles = built.v;
  }

  return { id: vehicle.id, nation: vehicle.nation, battles, account, cells };
}

/**
 * The per-title header (D-13): the account file's lifetime battles and its
 * premium expiry, and nothing else.
 *
 * Two columns are resolved and two values are read, by direct access on the
 * resolved keys. The account file also carries `NAME` — the nickname — plus
 * credits, gold and free XP, and none of them is named here, so none of them
 * can be read (T-05-12, Phase 3 D-21).
 *
 * The expiry is the cell EXACTLY as written: a value of `1970-01-01 00:00:00`
 * is an export artefact, not a date to reformat, and parsing it into a
 * formatted local time would be a claim the export never made.
 *
 * ## Across accounts (Phase 10, D-20, T-10-11)
 *
 * Battles ADD UP across the accounts that contribute a row; the premium expiry
 * is shown only when EXACTLY ONE account contributes. An expiry is a property of
 * one account's premium status, and there is no honest way to combine two: the
 * earliest of two is a claim the export never made and the latest quietly drops
 * one account. With two or more, the expiry term is omitted rather than filled,
 * and the lifetime-battles term stays — so the header is still "what this export
 * holds", one figure shorter.
 *
 * Each account contributes ONCE, through the first file name in the title's
 * preference list it has a row for (WoWP has two: the 19 and the 20 file, and
 * the 19 is preferred). Both its figures are then read through its OWN resolved
 * keys (CR-01), and its first row is the row the pre-Phase-10 reader read for
 * one account — which is why one account still answers exactly what v1.0 did.
 */
function buildHeader(files: VehicleFiles, title: VehicleTitleId): VehicleHeader | null {
  // Per ACCOUNT, in the preference order of the file names. The inner `seen`
  // set is what makes an account contribute once rather than once per file name
  // it happens to have.
  const seen = new Set<string>();
  let battles: VehicleCell | null = null;
  let expiry: VehicleCell | null = null;
  let contributors = 0;

  for (const name of TITLE_FILES[title].accounts) {
    for (const group of factsOf(files, name).groups) {
      if (seen.has(group.account)) continue;
      const first = group.rows[0];
      // A file that was in the zip but holds no row is not a header, and the
      // next account file in the list gets its turn.
      if (first === undefined) continue;
      seen.add(group.account);
      const fields = resolveFields(first, [BATTLES_FIELD, PREMIUM_EXPIRY_FIELD]);
      const own = readNumber(first, fields.get('battles') ?? null);
      battles = battles === null ? own : sumCells(battles, own);
      expiry = expiryCell(first, fields.get('premiumExpires') ?? null);
      contributors += 1;
    }
  }

  if (contributors === 0) return null;
  return {
    battles: battles ?? { t: 'x', v: 'missing' },
    premiumExpires: contributors === 1 ? expiry : null,
  };
}

/** The premium-expiry column, under WoT's and the other titles' spellings. */
const PREMIUM_EXPIRY_FIELD: RawField = {
  id: 'premiumExpires',
  headers: ['PREMIUM_EXPIRES_AT', 'PREMIUM_EXPIRY_TIME'],
};

/**
 * The expiry cell as written, with the export's two abbreviations mapped to
 * their specials: `N/A` is "not available" and `N/D` is "not defined", and a
 * blank is not available too.
 */
function expiryCell(row: VehicleRowData, key: string | null): VehicleCell {
  if (key === null) return { t: 'x', v: 'missing' };
  const raw = row[key];
  if (raw === undefined) return { t: 'x', v: 'na' };
  const text = raw.trim();
  const upper = text.toUpperCase();
  if (upper === NOT_DEFINED) return { t: 'x', v: 'nd' };
  if (upper === NOT_AVAILABLE || text === '') return { t: 'x', v: 'na' };
  return { t: 's', v: clamp(text) };
}

/** What the title selector needs for all four titles, in the fixed order. */
function buildOverview(files: VehicleFiles): TitleOverview[] {
  return VEHICLE_TITLES.map((title) => ({
    title,
    // Present means the ZIP held a file of this title — by_Type, the account
    // file, the battle-type summary or the Warplanes 20 note alone is enough,
    // because each of them is a fact the selector's "(not in this export)"
    // suffix would otherwise contradict (D-05).
    present: ownedFiles(title).some((name) => factsOf(files, name).seen),
    rows: rowCountOf(groupsOf(files, TITLE_FILES[title].main)),
  }));
}

/** The title a null request picks: the first with vehicle rows, else WoT. */
function pickTitle(overview: readonly TitleOverview[]): VehicleTitleId {
  for (const entry of overview) {
    if (entry.rows > 0) return entry.title;
  }
  return VEHICLE_TITLES[0];
}

/**
 * The whole answer to one vehicle-table request.
 *
 * `request.battleType` is applied only when the title's by_Type rows actually
 * carry that code, so a stale selection from another title comes back as the
 * All-battles view rather than as an empty table the user cannot explain (D-28:
 * a selection the new dataset does not have is never displayed).
 *
 * A title that is absent from the zip or that parsed to no rows answers with
 * the view's default columns, no rows, no codes and no summary. The battle-type
 * control and its summary are shown and hidden together, so a table with no
 * rows has nothing for either of them to act on (UI-SPEC section 3).
 */
export function buildVehicleView(files: VehicleFiles, request: VehicleViewRequest): VehicleView {
  const overview = buildOverview(files);
  const title = request.title ?? pickTitle(overview);
  const entry = overview.find((candidate) => candidate.title === title);
  const present = entry?.present ?? false;
  const titleState = !present
    ? 'not-in-export'
    : entry !== undefined && entry.rows > 0
      ? 'ready'
      : 'no-rows';

  const names = TITLE_FILES[title];
  // A view with no rows never resolves a column, so it is answered from the
  // core six directly rather than by reading an empty file's (absent) first row.
  if (titleState !== 'ready') {
    return {
      overview,
      title,
      titleState,
      battleType: null,
      battleTypes: [],
      summary: [],
      // The header is built whenever the title's account file has a row, which a
      // title absent from the zip never does — so a `no-rows` title keeps its
      // header and a `not-in-export` one has none (D-05).
      header: buildHeader(files, title),
      wowp20: null,
      allBattlesOnly: false,
      columns: CORE_COLUMNS.map(toColumn),
      rows: [],
    };
  }

  // The by_Type file is resolved ONCE PER GROUP whether or not a code is applied:
  // the filter's code list comes out of the same first row the table would read,
  // so a file costs one key listing per ACCOUNT rather than one per view
  // (T-05-12), and each account resolves its own spelling (CR-01).
  const byTypeGroups = groupsOf(files, names.byType);
  const byTypeMaps = resolvedByGroup(byTypeGroups, [...TITLE_SPECS[title].raw, TYPE_FIELD]);
  const codes = battleTypeCodes(byTypeGroups, byTypeMaps);
  const applied =
    request.battleType !== null && codes.includes(request.battleType) ? request.battleType : null;

  if (applied !== null) {
    const spec = TITLE_SPECS[title];
    // The COLUMN LIST is the union of what the accounts resolved, so a column
    // only the second account's header carries is still shown; each row is then
    // read through its OWN group's keys.
    const listed = listColumns(spec, unionResolved(byTypeMaps));
    const rows: VehicleRow[] = [];
    for (let g = 0; g < byTypeGroups.length; g++) {
      const group = byTypeGroups[g]!;
      const typeKey = byTypeMaps[g]!.get('type') ?? null;
      for (const row of group.rows) {
        if (codeOf(cell(row, typeKey)) === applied) {
          // D-10: the owner is the GROUP's root, stamped by the loop that is
          // already walking this account's rows. No cell of a by_Type file
          // carries an account, so this is the only thing that could.
          rows.push(mapRow(row, byTypeMaps[g]!, listed, group.account));
        }
      }
    }
    return {
      overview,
      title,
      titleState,
      battleType: applied,
      battleTypes: codes,
      summary: buildSummary(files, title, codes),
      header: buildHeader(files, title),
      wowp20: null,
      allBattlesOnly: false,
      columns: listed.map(toColumn),
      rows,
    };
  }

  const spec = allBattlesSpec(title);
  const mainGroups = groupsOf(files, names.main);
  const mainMaps = resolvedByGroup(mainGroups, spec.raw);
  const columns = listColumns(spec, unionResolved(mainMaps));
  const rows: VehicleRow[] = [];
  for (let g = 0; g < mainGroups.length; g++) {
    const group = mainGroups[g]!;
    for (const row of group.rows) {
      rows.push(mapRow(row, mainMaps[g]!, columns, group.account));
    }
  }

  return {
    overview,
    title,
    titleState,
    battleType: null,
    battleTypes: codes,
    summary: buildSummary(files, title, codes),
    header: buildHeader(files, title),
    // The note belongs to the Warplanes title alone: a non-Warplanes view
    // showing "4 plane records have no names" would be a sentence about a
    // table the reader is not looking at (D-09).
    wowp20: title === 'wowp' ? buildWowp20Note(files) : null,
    allBattlesOnly: title === 'wows',
    columns: columns.map(toColumn),
    rows,
  };
}
