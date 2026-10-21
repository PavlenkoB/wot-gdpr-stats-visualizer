// =============================================================================
// new-data-allowlist.ts — which columns of a new-game file may be stored (D-08)
// =============================================================================
//
// Four questions, four pure functions, no I/O and no worker globals:
//
//   `isNewDataFile`    is this file in the new-game FAMILY (by NAME)?
//   `isFamilyCategory` is this file in the family because of its CATEGORY?
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
// ## Why there is a CATEGORY half too
//
// A name-only rule has a hole in it, and the hole is a folder the app has just
// learned to read. `Surveys/Anything.csv` matches no name pattern, so under a
// name-only rule it would be stored raw. The second half of the test — the
// CATEGORY, scoped by {@link FAMILY_CATEGORIES} — closes it: in a folder that
// opts in, EVERY file is a family file, and a family file with no spec stores
// nothing (12-RESEARCH Finding 2). The two halves answer different questions
// and neither replaces the other: the name says "this file is one of ours",
// the category says "this folder holds only files of ours".
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
 *     `HEAT_Device_Info.csv` is in this family and has NO spec on purpose: it
 *     is counted as present and nothing in it is stored (11-HEADERS.md, D-15
 *     Open Question 7). `HEAT_Surveys.csv` is in the family too and DOES have a
 *     spec since phase 12 (D-03): three allowlisted columns, and the file is
 *     stored through that allowlist alone.
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
 *   - `/^(?:account_name_history|external_services_history|language_and_country_history)\.csv$/`
 *     — the three history files, and deliberately NOT a prefix (12-04). They sit
 *     in `User_Info` beside `Account_Info.csv`, which the identity pick and the
 *     Account record read; a prefix rule would sweep that file in too and stop
 *     the account header storing at all. So the pattern is anchored on the WHOLE
 *     name and these three files alone. They are stored TODAY, column for
 *     column, behind only the LOGIN/BIRTH_DATE deny-list, which is why this is
 *     the fail-closed direction for them rather than the widening one: with no
 *     spec yet (they arrive with the timeline pane in plan 12-08) each of the
 *     three stores NOTHING. A `User_Info` history file whose name this list does
 *     not know keeps the deny-list strip only, and that residual is recorded as
 *     accepted (T-12-11): the names come from the real sample and from the
 *     plan 12-01 capture, which lists every history-named `User_Info` file.
 *   - `/^(?:bans|authorized_third_parties|subscriptions|personal_coupons|bonus_code_usage)\.csv$/`
 *     — the five promoted-folder files that have a spec (12-08), anchored on the
 *     WHOLE name. The category half of the family test covers these files in
 *     their own folder; the NAME half covers a copy filed anywhere else, so a
 *     `Bans.csv` under `Payment_History` is a family file in the wrong category
 *     and stores nothing (D-15, T-12-23) rather than being stored column for
 *     column like any other file of a supported legacy folder.
 *
 * A name here with no matching spec in {@link NEW_DATA_SPEC_FILES} stores
 * NOTHING — the fail-closed direction (D-15).
 */
export const FAMILY_PATTERNS: readonly RegExp[] = [
  /^(?:heat|wotc)_/,
  /^wowp_/,
  /^wows_(?:crews|account_storage)\.csv$/,
  /^(?:account_name_history|external_services_history|language_and_country_history)\.csv$/,
  /^(?:bans|authorized_third_parties|subscriptions|personal_coupons|bonus_code_usage)\.csv$/,
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

/**
 * The categories whose EVERY file is in the allowlist family, whatever its
 * name.
 *
 * ## Why the family test needs a second half
 *
 * {@link FAMILY_PATTERNS} matches by NAME, and that is right for a file whose
 * name the app knows. It is not enough for a FRESHLY PROMOTED FOLDER: a folder
 * is a container whose contents the app has not seen, and a name-only rule
 * leaves a hole in it. `Surveys/Anything.csv` matches no pattern, so under a
 * name-only rule it would fall through to the last branch of the storage
 * expression and be stored RAW — a second, unexpected file, a future revision,
 * or a file an attacker added to a folder the app had just learned to read.
 *
 * The second half of the test is therefore the CATEGORY, and it is scoped: a
 * folder opts in as a whole, and every file in it is a family file. A file in
 * one of these categories with no spec stores NOTHING — exactly like
 * `heat_device_info.csv` — and so does a file whose headers match no column of
 * its spec (12-RESEARCH Finding 2, T-12-04).
 *
 * The set holds every Phase 12 folder that is readable: `surveys` (12-02) and
 * the five promoted with it (12-04). `game_forums` is deliberately NOT here
 * (D-02, T-12-10) — it is never promoted, and adding it to this set would be
 * the quiet way to promote it while claiming not to.
 *
 * ## Why the widening is the dangerous direction
 *
 * A category here is a folder whose files are all fail-closed. Adding one is
 * safe; it can only make a file store NOTHING that might otherwise have stored
 * something. Removing one is the act that would let a file in that folder be
 * stored raw again, so the set is the promotion's ledger and is edited only
 * beside the `SUPPORTED` change that made the folder readable.
 *
 * Lower-cased, because classification is case-insensitive
 * (`classifyFolder` compares lower-case) and a category spelled `Surveys` and
 * one spelled `surveys` are the same folder.
 */
export const FAMILY_CATEGORIES: ReadonlySet<string> = new Set([
  'authorized_third_parties',
  'bans',
  'bonus_codes',
  'personal_coupons',
  'subscriptions',
  'surveys',
]);

/**
 * Is this category one whose every file is in the allowlist family?
 *
 * Lower-cases its input, so the caller may pass the folder name as the zip
 * spells it. Membership only: the answer says "treat this file as a family
 * file", never "store it" — the spec lookup and the header match decide that.
 */
export function isFamilyCategory(category: string): boolean {
  return FAMILY_CATEGORIES.has(category.toLowerCase());
}

/** A spec with its columns resolved for matching, keyed by {@link headerKey}. */
export interface AllowlistSpec {
  /** The lower-cased category the spec expects. */
  readonly category: string;
  /** The spec's key, the lower-cased file name. */
  readonly key: string;
  /** `headerKey(header)` -> the column to write. A `Map`, never an object. */
  readonly columns: ReadonlyMap<string, SpecColumn>;
  /** Drop any cell whose VALUE looks like an email address (see {@link looksLikeEmail}). */
  readonly emailGuard: boolean;
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
  return { category: spec.category, key: spec.key, columns, emailGuard: spec.emailGuard === true };
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
 * The longest prefix of an over-long cell that is searched for an at-sign.
 *
 * A cell past {@link MAX_NEW_DATA_CELL} is clamped, and the clamp can cut an
 * address in half (`<190 characters>someone@exa` + `mple.com`), leaving a stored
 * fragment that no longer looks like an email. So an over-long cell is judged on
 * its RAW head instead: an at-sign anywhere in the first 2,000 characters drops
 * it. Bounded, so a 100 MB cell is never scanned whole.
 */
const EMAIL_HEAD_SCAN = 2000;

/** One email shape: local part, an at-sign, a domain with a dot in it. */
const EMAIL_SHAPE = /[^\s@]+@[^\s@]+\.[^\s@]+/;

/**
 * Does this value look like an email address?
 *
 * Non-space characters, an at-sign, non-space characters, a literal dot,
 * non-space characters. `a@b`, a lone at-sign and `someone @ home` do not match.
 * Tested on a string the caller has already bounded, and the character classes
 * exclude the at-sign so the expression cannot be driven into slow backtracking.
 */
export function looksLikeEmail(value: string): boolean {
  return EMAIL_SHAPE.test(value);
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
 * ## The email guard (D-01, T-12-16)
 *
 * With `spec.emailGuard` set, a cell whose VALUE looks like an email is left
 * ABSENT, because a header allowlist cannot see inside an allowlisted column (a
 * service identifier, a ban comment, a third-party contact). The entry still
 * exists; that part simply reads "not reported". The same function serves the
 * import and the in-place narrowing of an existing cache, so the two cannot
 * disagree, and the guarded projection is idempotent: a cell that survived once
 * survives again, so the narrowing is a no-op on its second run.
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
    const cell = raw[key];
    const clamped = clampCell(cell);
    if (spec.emailGuard && clamped !== undefined && cell !== undefined) {
      if (looksLikeEmail(clamped)) continue;
      if (cell.length > MAX_NEW_DATA_CELL && cell.slice(0, EMAIL_HEAD_SCAN).includes('@')) continue;
    }
    out[id] = clamped;
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
