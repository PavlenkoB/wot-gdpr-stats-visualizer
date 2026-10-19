/**
 * The vehicle-table view contract, shared by the aggregation worker and the page.
 *
 * ## Why this module exists
 *
 * `src/lib/features/vehicles/vehicle-aggregate.ts` builds these views inside a Web Worker and
 * `src/lib/` reads them back on the main thread, so everything both sides have
 * to agree on — the shape of a cell, the list of titles, the clamp on every
 * string — has to live in ONE module neither of them has to own.
 *
 * This module has **no imports at all**, and that is load-bearing rather than
 * stylistic: it is what makes it legal for a worker-side module and a page-side
 * module to agree on a number without either depending on the other.
 * `grep -c '^import' src/lib/features/vehicles/vehicle-shared.ts` printing 0 is the check that
 * keeps it true.
 *
 * ## Why a cell carries its own kind
 *
 * A number is not enough. `0` means three different things to this export — a
 * vehicle that has fought no battles, a damage figure the game does not define,
 * and a value the builder could not read — and D-09 forbids collapsing any of
 * them. So a cell is a discriminated union: a caller has to look at `t` before
 * it can do arithmetic, and no arithmetic is possible at all on a special
 * (`t: 'x'`). The table (plan 05-12) formats, the model (plan 05-09) sorts, and
 * neither of them has to guess what a bare number meant.
 *
 * ## Why the battle type is a string and never a name
 *
 * The export names nothing. A battle-type code is an identifier, so it crosses
 * this boundary as the trimmed, clamped STRING the export wrote and nothing
 * else; no code is ever turned into a label here (D-07).
 *
 * Decisions: D-05 (title states), D-06 (the main file is the All view),
 * D-07 (battle-type codes and summary), D-08 (Warships battles only),
 * D-09 (special values, Warplanes), D-10 (core columns and derived values),
 * D-11 (nation-tagged ids), D-13 (the per-title header).
 */

/**
 * The four titles this phase reads, in the order the selector draws them.
 *
 * Fixed rather than derived from the file names: the order is a UI decision
 * (UI-SPEC section 3), not a property of the export, and an account holding
 * only Warships must still see the other three options marked absent.
 */
export const VEHICLE_TITLES = ['wot', 'wotb', 'wows', 'wowp'] as const;

/** One entry of {@link VEHICLE_TITLES}. */
export type VehicleTitleId = (typeof VEHICLE_TITLES)[number];

/**
 * Every string lifted out of a zip cell is clamped to this many characters
 * before it is stored, counted or drawn (RESEARCH Pitfall 13, T-05-14).
 *
 * The clamp is a bound on what can reach the DOM, not a guess about what a
 * vehicle name "should" look like: a corrupt or hostile cell is truncated where
 * it is read, so a 5,000-byte name costs a slice and not a layout.
 */
export const MAX_VEHICLE_STRING = 200;

/**
 * At most this many distinct battle-type codes are kept for a title
 * (T-05-14).
 *
 * A real export has around a dozen; a corrupt or hostile one could have as many
 * as it has rows, and the codes become one `<select>` option and one summary row
 * each. Capping the LIST is not the same as hiding data — the cap bounds the
 * options, and a view with more than this many codes is already a file this
 * module cannot describe.
 */
export const MAX_BATTLE_TYPE_CODES = 64;

/**
 * The longest battle-type code string kept or accepted (T-05-14, T-05-18).
 *
 * A code is a short numeric token in every export, so 64 characters is already
 * far past any real value. It bounds what a corrupt cell can make the worker
 * hold, and what a hostile query message can make it echo into a view. This is
 * a LENGTH; {@link MAX_BATTLE_TYPE_CODES} is a COUNT of distinct codes.
 */
export const MAX_BATTLE_TYPE_LENGTH = 64;

/**
 * The five ways a cell can be something other than a value.
 *
 * None of them is ever `0` and none is ever summed (D-09, T-05-15):
 *
 *   - `nd`          the export wrote `N/D`, its documented "not defined";
 *   - `na`          the export wrote `N/A`, a blank, or something unreadable;
 *   - `missing`     the column is not in this file at all;
 *   - `no-battles`  a ratio whose denominator is zero battles;
 *   - `no-shots`    a hit ratio whose denominator is zero shots;
 *   - `per-type`    a value that exists only per battle type (D-08: the
 *                   Warships All-battles win rate and average damage).
 */
export type SpecialKey = 'nd' | 'na' | 'missing' | 'no-battles' | 'no-shots' | 'per-type';

/**
 * One value in the table, tagged with what it is.
 *
 * The four value kinds and the one special kind, deliberately disjoint:
 *
 *   - `n` a finite number — the only kind any arithmetic may touch;
 *   - `s` text exactly as the export wrote it (a vehicle id, an expiry);
 *   - `d` a date as written PLUS its wall-clock seconds, because the page sorts
 *       on a number and the player has to read the text the export wrote, and
 *       `k` is null when the text does not parse (D-01: no instant, no zone);
 *   - `b` a boolean the export spelled `1`/`T` or `0`/`F` (its readme's `F`/`T`
 *       and the sample's `1`/`0` are the same flag, RESEARCH A8);
 *   - `x` a {@link SpecialKey}, which no arithmetic accepts.
 */
export type VehicleCell =
  | { t: 'n'; v: number }
  | { t: 's'; v: string }
  | { t: 'd'; v: string; k: number | null }
  | { t: 'b'; v: boolean }
  | { t: 'x'; v: SpecialKey };

/**
 * How a column's numbers are drawn, so the table never has to guess (D-25).
 *
 * `count` and `whole` are exact grouped integers (`whole` is an average that
 * displays without a decimal), `percent` is a PERCENTAGE with one decimal — 55,
 * not 0.55, because the builder scales a derived ratio once when it builds the
 * cell (05-14) — `text` and `date` are strings as written, and `garage` is a
 * Yes/No boolean.
 */
export type ColumnKind = 'count' | 'percent' | 'whole' | 'text' | 'date' | 'garage';

/**
 * One column of the table.
 *
 * `core` marks a column the view always shows, so a later plan can tell "this is
 * one of the six" from "this is a column the user asked for" without a second
 * list. `sortable` is false only where sorting has no meaning: the two
 * Warships All-battles cells that read the same per-type note in every row.
 */
export interface VehicleColumn {
  key: string;
  kind: ColumnKind;
  core: boolean;
  sortable: boolean;
}

/**
 * One vehicle row.
 *
 * `id` is the CLEANED id — the text after the first colon — and `nation` is the
 * text before it, or null when the export wrote no colon at all (D-11). Both
 * are clamped to {@link MAX_VEHICLE_STRING}. `battles` is the number the table
 * sorts and the count line reads, or null when the cell is a special, so the
 * model never has to re-read a cell to sort on it.
 *
 * `account` is the ROOT of the account this row came from, stamped from the
 * owning `AccountRowGroup.account` and never from any cell (Phase 10, D-10,
 * T-10-10). It is what the tag chip is looked up by, so a misattributed row
 * would put one account's letter on another account's vehicle — which is why it
 * is a parameter of the mapper rather than something a cell can influence.
 *
 * `cells[i]` belongs to `columns[i]`, and `cells[0]` is the vehicle column's own
 * text cell, so a row and a column list always describe the same width.
 */
export interface VehicleRow {
  id: string;
  nation: string | null;
  battles: number | null;
  /** The owning account root, stamped by the mapper from the group (D-10). */
  account: string;
  cells: VehicleCell[];
}

/** One row of the battle-type summary: battles, wins and damage for a code. */
export interface BattleTypeSummaryRow {
  code: string;
  battles: VehicleCell;
  wins: VehicleCell;
  damage: VehicleCell;
}

/**
 * The figures above a title's table (D-13; combined across accounts by D-20).
 *
 * `battles` is the account file's lifetime battle count — with two or more
 * accounts contributing, the SUM of their numeric battle cells (or the first
 * special when none of them is a number).
 *
 * `premiumExpires` is the expiry cell exactly as written — a value like
 * `1970-01-01 00:00:00` is an export artefact, not a date to reformat — and is
 * `null` when TWO OR MORE accounts contributed. There is no honest combined
 * expiry: the earliest of two is a claim the export never made and the latest
 * drops one account, so the term is omitted instead (D-20, T-10-11). One
 * account answers with its own cell, exactly as v1.0 did.
 *
 * The account file's `NAME` column is the nickname and is NEVER read (Phase 3
 * D-21, T-05-12), which is why this type has no field for it.
 */
export interface VehicleHeader {
  battles: VehicleCell;
  premiumExpires: VehicleCell | null;
}

/** What the title selector needs to draw one option per title (D-05). */
export interface TitleOverview {
  title: VehicleTitleId;
  /** True when ANY of the title's files was in the zip. */
  present: boolean;
  /** Data rows in the main per-vehicle file, the "All battles" table. */
  rows: number;
}

/**
 * The Warplanes 20 note (D-09).
 *
 * `WOWP_20_Plane_Statistics.csv` has no vehicle identifier at all, so it is
 * never a table. It appears as a record count and a battle total, which are the
 * only two things the file actually says.
 */
export interface Warplanes20Note {
  records: number;
  battles: number;
}

/**
 * The Warplanes account statistics block (plan 11-10, D-02, GAMES-03).
 *
 * Non-null only for the Warplanes view and only when there is something to
 * show: at least one account holds the record, or at least one Warplanes file
 * was read but none of its columns are on the allowlist. It never carries a
 * nickname (the type has no field for it, and the builder reads only spec
 * headers). `columns` are shared by every account; `accounts[i].cells` line up
 * with them, and `account` is the owning group's root, never a cell. `skipped`
 * is how D-09's drifted file reaches the page: lower-cased WOWP file KEYS from
 * a closed set, never an archive name.
 */
export interface WowpAccountBlock {
  columns: { id: string; kind: ColumnKind }[];
  accounts: { account: string; cells: VehicleCell[] }[];
  skipped: string[];
}

/**
 * Why the applied title has no table, or that it has one (D-05).
 *
 * `not-in-export` — no file of this title was in the zip, so there is nothing
 * to say beyond the option's own suffix;
 * `no-rows`     — the files are there and parsed, but the vehicle file holds no
 *                  data rows, so the header is still real and is still shown;
 * `ready`       — the table has rows.
 */
export type TitleState = 'ready' | 'not-in-export' | 'no-rows';

/**
 * The whole answer to one vehicle-table request.
 *
 * `title` and `battleType` are the APPLIED values, not the requested ones: a
 * request for a code the export does not have comes back with `battleType:
 * null` and the All-battles rows, so the caller can never believe a selection
 * the data does not support (the Phase 4 "applied index" idea). `overview`
 * always carries all four titles in {@link VEHICLE_TITLES} order, whether or not
 * this view is one of them.
 *
 * `allBattlesOnly` is true for exactly one view: the Warships All-battles table
 * of D-08, where no per-ship figure exists to show. `wowp20` is non-null only
 * for the Warplanes view.
 */
export interface VehicleView {
  overview: TitleOverview[];
  title: VehicleTitleId;
  titleState: TitleState;
  battleType: string | null;
  battleTypes: string[];
  summary: BattleTypeSummaryRow[];
  header: VehicleHeader | null;
  wowp20: Warplanes20Note | null;
  /** The Warplanes account statistics; null for every other title (D-02). */
  wowpAccount: WowpAccountBlock | null;
  allBattlesOnly: boolean;
  columns: VehicleColumn[];
  rows: VehicleRow[];
}

/**
 * One parsed data row of a Player_statistics file, keyed by the header cells
 * as written.
 *
 * A cell may be missing entirely: `parseCsvFile` represents a short row as an
 * absent key, and an absent column is a real export quirk that PROJECT.md's
 * defensive-parsing constraint requires every read to tolerate.
 */
export type VehicleRowData = Readonly<Record<string, string | undefined>>;
