// =============================================================================
// new-data-allowlist.ts — which columns of a new-game file may be stored (D-08)
// =============================================================================
//
// Four questions, four pure functions, no I/O and no worker globals:
//
//   `isNewDataFile`    is this file in the new-game FAMILY (by NAME)?
//   `specFor`          does this family file have a spec, filed correctly?
//   `projectRow`       narrow one parsed row to the spec's columns
//   `fileMatchesSpec`  did this file match at all — decided per FILE
//
// ## Why the family test is by NAME and not by FOLDER
//
// The folder a CSV is filed under inside a zip is attacker-controlled, and the
// classifier's answer about it can be wrong. That is the same argument the
// existing choke-point strip already makes for the User_Info deny-list
// (CR-01 layer 2, `ingest.worker.ts`): a rule keyed on the folder can be dodged
// by moving the file, so the rule is keyed on the file's own NAME and the
// folder is only consulted for the SEPARATE question of which spec applies.
//
// ## Why the file match is per FILE, never per row
//
// A ragged row — one with fewer cells than the header, which a real export
// produces and PapaParse models as a row with absent keys — carries no spec
// column. Deciding "does this row match?" per row would classify the whole FILE
// as unmatched because of its shortest line, and drop thousands of good rows
// with it (11-RESEARCH Pitfall 3). So the match is decided once per file, from
// the union of every row's keys, and a short row inside a matching file
// projects to an empty object that is still a row.
//
// ## Why the output keys are spec constants
//
// The projection never copies a key from the file. It walks the row's keys, asks
// the spec whether it recognises them, and writes the answer under the spec's
// own header. A hostile header — `__proto__`, a 100 KB name, a duplicate that
// PapaParse has already suffixed — therefore cannot become a stored key, cannot
// reach an object's prototype, and cannot even be a key that has to be reasoned
// about downstream (T-11-02).
// =============================================================================

import { headerKey, type CsvRow } from './csv-columns.ts';
import { NEW_DATA_SPEC_FILES, type SpecColumn, type SpecFile } from './new-data-specs.ts';

/**
 * The longest cell a new-game row may store, in characters.
 *
 * The same bound as `MAX_DEVICE_TEXT`: long enough that no real header or
 * stamp is truncated, short enough that one crafted 100 MB cell cannot be
 * written to the user's IndexedDB (T-11-02). The clamp is per cell, not per
 * row, so a file cannot smuggle bulk past it by spreading the payload.
 */
export const MAX_NEW_DATA_CELL = 200;

/**
 * The new-game file-name FAMILIES.
 *
 * Anchored, case-insensitive, matched against the LOWER-CASED file name. Three
 * patterns, each with a stated reach, because the WIDENING is the dangerous
 * direction: a name that enters this list without a spec stops being stored the
 * way it always was and starts storing nothing.
 *
 *   - `/^(?:heat|wotc)_/` — every World of Tanks HEAT and WoT Console file.
 *     `HEAT_Device_Info.csv` and `HEAT_Surveys.csv` are in this family and have
 *     NO spec on purpose: they are counted as present and nothing in them is
 *     stored (11-HEADERS.md, D-15 Open Question 7).
 *   - `/^wowp_/` — EVERY Warplanes file, deliberately WIDER than the two
 *     revisions the capture holds. A `WOWP_21_*.csv` the next export revision
 *     ships is in the family and has no spec, so it stores nothing rather than
 *     reaching IndexedDB unfiltered. Narrowing this pattern is the act that
 *     would admit it.
 *   - `/^wows_(?:crews|account_storage)\.csv$/` — exactly the two Warships files
 *     with no Vehicles-owned reader. Anchored on the WHOLE name, so
 *     `WOWS_Ship_Statistics.csv`, `WOWS_Account_Statistics.csv` and
 *     `WOWS_Battle_Types_Statistics.csv` stay OUTSIDE the family and keep being
 *     stored column for column, as the Vehicles builder has always read them.
 *
 * A name here with no matching spec in {@link NEW_DATA_SPEC_FILES} stores
 * NOTHING — the fail-closed direction (D-15).
 */
export const FAMILY_PATTERNS: readonly RegExp[] = [
  /^(?:heat|wotc)_/,
  /^wowp_/,
  /^wows_(?:crews|account_storage)\.csv$/,
];

/**
 * Is this file part of a new game's family?
 *
 * Name-based and case-insensitive: `HEAT_Anything.csv` and `heat_anything.csv`
 * are the same family, because the name is the only part of the decision the
 * app controls rather than the archive. In the family means "the stored column
 * set is whatever {@link specFor} says, or nothing" — never "store it raw".
 */
export function isNewDataFile(sourceFile: string): boolean {
  const name = sourceFile.toLowerCase();
  return FAMILY_PATTERNS.some((pattern) => pattern.test(name));
}

/** A spec with its columns resolved for matching, keyed by {@link headerKey}. */
export interface AllowlistSpec {
  /** The lower-cased category the spec expects. */
  readonly category: string;
  /** The spec's key, the lower-cased file name. */
  readonly key: string;
  /** `headerKey(header)` -> the column to write. A `Map`, never an object. */
  readonly columns: ReadonlyMap<string, SpecColumn>;
}

/** One resolved spec per spec table entry, built once at module load. */
const RESOLVED_SPECS: readonly AllowlistSpec[] = NEW_DATA_SPEC_FILES.map((spec: SpecFile) => {
  const columns = new Map<string, SpecColumn>();
  for (const column of spec.columns) {
    // The MATCH key is normalised; the stored key is the spec's own `id`, which
    // is not normalised, because it is a constant this file wrote.
    const key = headerKey(column.header);
    // First definition wins: two columns resolving to one header is a table
    // error, and silently letting the later one overwrite the earlier would make
    // the answer depend on array order.
    if (!columns.has(key)) columns.set(key, column);
  }
  return { category: spec.category, key: spec.key, columns };
});

/**
 * The spec for one file of one category, or `null`.
 *
 * `null` is the answer for every case the app must fail closed on: a name
 * outside the family, a family name with no spec, a family name whose spec
 * exists but belongs to a DIFFERENT category, and any name at all in a category
 * that is not supported. The caller treats `null` as "store nothing", never as
 * "store it raw" (D-15, T-11-03).
 *
 * Both arguments are lower-cased here so a caller cannot be defeated by passing
 * `Activity_History` where the table spells `activity_history`.
 */
export function specFor(category: string, sourceFile: string): AllowlistSpec | null {
  const key = sourceFile.toLowerCase();
  const wanted = category.toLowerCase();
  return RESOLVED_SPECS.find((spec) => spec.key === key && spec.category === wanted) ?? null;
}

/** Clamp one cell, leaving an absent cell absent rather than turning it ''. */
function clampCell(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  return value.length > MAX_NEW_DATA_CELL ? value.slice(0, MAX_NEW_DATA_CELL) : value;
}

/**
 * Narrow one parsed row to the columns its spec names.
 *
 * Walks `Object.keys(raw)` in the ROW'S OWN order and writes each recognised
 * cell under the SPEC's `id`, so the stored key set is a subset of the spec by
 * construction rather than by filtering. A repeated header (two file keys that
 * normalise to one header key) keeps the FIRST and drops the rest, matching
 * PapaParse's own first-wins duplicate handling.
 *
 * Never copied: any key the spec does not name, `__parsed_extra` (an array no
 * column list can see into), and PapaParse's duplicate-suffixed keys. Returns a
 * fresh object — the parsed row stays inside the ingest loop.
 */
export function projectRow(raw: CsvRow, spec: AllowlistSpec): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const key of Object.keys(raw)) {
    // Resolved through the spec's Map, never through an object lookup on the
    // row's own keys: `__proto__` and every other inherited-looking name is
    // simply a string the Map has never heard of.
    const column = spec.columns.get(headerKey(key));
    if (column === undefined) continue;
    const id = column.id;
    if (id in out) continue;
    out[id] = clampCell(raw[key]);
  }
  return out;
}

/**
 * Did this file match its spec at all?
 *
 * TRUE when at least one row carries at least one spec column, and decided over
 * the whole FILE. A `null` spec is never a match: the caller stores nothing
 * rather than storing a projection of nothing.
 *
 * `rows` are the raw parsed rows, not projections — the question is which
 * headers the FILE carried, and asking a projection would make the answer
 * trivially true.
 */
export function fileMatchesSpec(rows: readonly CsvRow[], spec: AllowlistSpec | null): boolean {
  if (spec === null) return false;
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (spec.columns.has(headerKey(key))) return true;
    }
  }
  return false;
}
