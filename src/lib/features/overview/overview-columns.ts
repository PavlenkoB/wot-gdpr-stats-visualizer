/**
 * overview-columns.ts — the shared column readers (13-07, D-04, D-09, D-18).
 *
 * ## What this module is
 *
 * Four pure helpers that every Overview reducer shares: resolve a set of
 * fields against ONE row's keys, read a count, read a record id, and clamp a
 * name. They live in their own module because the Totals and Time plans read
 * the same columns and must read them the SAME way — a second spelling list
 * would be a second answer to "which column is the battle count".
 *
 * ## Why the field list is a LIST and not one name
 *
 * A header spelling is not stable across export revisions or accounts. The
 * battle count is `BATTLES_COUNT` in a World of Tanks export and `GAMES_PLAYED`
 * in a Warplanes one; the maximum damage is `DAMAGE_MAX` in one revision and
 * `MAX_DAMAGE_DEALT` in another. So a field names every spelling it accepts,
 * and a spelling that is MISSING reads as "not in this export" — never as a
 * zero (D-09). A missing column is an absence the Overview renders; a zero is
 * a claim about the player's data.
 *
 * ## Why the resolved key is the ROW'S OWN key
 *
 * `resolveFields` returns the key AS THE ROW SPELLS IT, never a normalised
 * one. A row's keys are read through the key that row carries, so a row whose
 * header is `BATTLES_COUNT` and a row whose header is `GAMES_PLAYED` are both
 * read through their own key. Resolving off ONE account's first row and
 * reading another account's cells through those keys is the CR-01 failure:
 * it turns the other account's data into a statement about absent data (or,
 * worse, about zeros).
 *
 * ## Why the first matching key WINS
 *
 * A header can carry two spellings of the same quantity (the vehicle export
 * writes a blank `FRAGS` beside a populated `FRAGS_COUNT`). The key that
 * appears FIRST IN THE ROW wins, so the one that has data is the one read.
 * That is the same rule `vehicle-aggregate.ts` documents, and it is why
 * `resolveFields` walks the key list once, in order.
 *
 * ## Why the specials are never zeros
 *
 * The export writes `N/D`, `N/A`, a blank and `\N` for "no value", and none of
 * them is a zero. A reader that turned any of them into `0` would report a
 * player with no battles as a player with zero battles — an assertion about
 * the user's own data that the export does not make. So every reader here
 * answers `null` for a cell it cannot read as a plain number, and the callers
 * turn that into an absent tile.
 */

import { headerKey, type CsvRow } from '../../worker/csv-columns.ts';

/**
 * One value a reducer reads, and the header names that may spell it.
 *
 * The headers are UPPER-CASE spellings: they are compared against a key
 * normalised with `headerKey`, so a header of `battles_count` and one of
 * `BATTLES_COUNT` are the same column.
 */
export interface FieldSpec {
  /** The reducer's own name for the value, never a header name. */
  readonly id: string;
  /** Every header spelling that may carry it, in preference order. */
  readonly headers: readonly string[];
}

/**
 * Resolve every field against ONE row's keys.
 *
 * ONE walk of the key list for the whole field set, which is both the cheaper
 * shape and the one a Proxy canary can assert: one enumeration per account
 * group, never per row and never per field (T-05-12).
 *
 * Every field id gets an entry in the returned map. An unresolved field maps
 * to `null`, which is the caller's signal that the column is not in this
 * export — the difference between "absent" and "zero" (D-09).
 *
 * When a field matches more than one accepted spelling, the key that appears
 * FIRST IN THE ROW wins rather than the first spelling in the list.
 */
export function resolveFields(
  row: CsvRow | undefined,
  fields: readonly FieldSpec[],
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
 * The only shape a COUNT may have.
 *
 * Plain digits, at most fifteen of them. A sign, a decimal point, an
 * exponent, a thousands separator, `N/D`, `N/A`, a blank and `\N` are all
 * refused — none of them is a count.
 */
const COUNT_PATTERN = /^[0-9]{1,15}$/;

/**
 * A numeric cell, or null when the cell does not hold one.
 *
 * `null` means "this cell does not say a number", which is NOT the same as
 * zero: the caller turns it into an absent tile or a skipped row, never into a
 * figure (D-09).
 */
export function readCount(raw: string | undefined): number | null {
  if (typeof raw !== 'string') return null;
  const text = raw.trim();
  if (!COUNT_PATTERN.test(text)) return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

/**
 * The only shape a RECORD TANK ID may have.
 *
 * A positive integer with no leading zero, at most ten digits. The export
 * writes `0`, a blank and `\N` for "not recorded", and a record column that
 * named tank `0` would be a claim the export never made (D-09, RESEARCH
 * Pitfall 9). So `'0'`, `''`, `'007'`, `'1e3'`, `'-5'`, `' 12'` and `'12 '`
 * all resolve to nothing.
 */
const TANK_ID_PATTERN = /^[1-9][0-9]{0,9}$/;

/**
 * A record tank id, or null when the cell does not hold one.
 *
 * The id is returned as the trimmed STRING, because that is what the lookup
 * is keyed by.
 */
export function readTankId(raw: string | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const text = raw.trim();
  return TANK_ID_PATTERN.test(text) ? text : null;
}

/**
 * The longest a name may be, so a page can interpolate it.
 *
 * A hundred characters is far longer than any tank name and short enough that
 * a hostile cell cannot push a megabyte of text into a tile (T-13-22).
 */
const MAX_NAME_LENGTH = 100;

/**
 * A name, trimmed and clamped.
 *
 * The trim is what makes a blank cell a blank name rather than a name of
 * spaces; the clamp bounds what a page renders. Neither guesses anything: a
 * name the export wrote is kept as it is, apart from its surrounding space
 * and its length.
 */
export function clampName(text: string): string {
  return text.trim().slice(0, MAX_NAME_LENGTH);
}
