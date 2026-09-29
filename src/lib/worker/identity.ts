import type { AccountIdentity } from '../types/worker-messages.ts';

/**
 * Sanitise-then-extract for the User_Info category (03-01, D-17/D-18/D-20).
 *
 * Why this exists:
 *   Wargaming's `User_Info/Account_Info.csv` carries the account's email
 *   (LOGIN) and birth data (BIRTH_DATE, BIRTH_DATE_SRC) alongside the
 *   harmless fields the dashboard shows. D-18 drops the three sensitive
 *   columns at WRITE TIME so they never rest in IndexedDB, and D-20 has
 *   the worker compute the three-field identity at import so the main
 *   thread never has to see a row.
 *
 * Both guarantees live here, as pure functions with no worker globals, so
 * they are unit-testable in plain Node and so the enforcement point is one
 * small file rather than a condition sprinkled through the parse loop.
 *
 * The two rules that make the strip actually hold (RESEARCH Q3 probe):
 *
 *   1. MATCH ON A NORMALISED KEY, NOT A LITERAL ONE. PapaParse does not
 *      trim header names (`' LOGIN'` stays padded), does not upper-case
 *      them, and renames a duplicated column to `LOGIN_1`. A strip that
 *      tested `key === 'LOGIN'` would pass all three shapes and leak the
 *      email. So every key goes through `trim().toUpperCase()` first.
 *
 *   2. DROP PAPA'S OVERFLOW BUCKET. When a row carries more cells than the
 *      header declares, the extras land in a `__parsed_extra` array whose
 *      cells the worker never inspects. That array is the single easiest
 *      way for the email to slip past a column-name deny-list, so it goes
 *      with the rest.
 *
 * This is a deny-list, so a column RENAMED to something outside it (say
 * `EMAIL`) is not caught. That residual risk is accepted and recorded
 * (03-01 threat register T-03-03): an allow-list would contradict Phase 2's
 * "store everything" decision, the value never leaves the device, and the
 * UI never renders it.
 */

/** One parsed CSV row, as PapaParse hands it over. */
type UserInfoRow = Record<string, string | undefined>;

/**
 * D-18 deny-list. The `_\d+` alternative covers PapaParse's duplicate-
 * header renaming, where a second `LOGIN` column becomes `LOGIN_1`. The
 * pattern is anchored and has no nested quantifiers, so there is no
 * catastrophic-backtracking shape here.
 */
const DROPPED_COLUMN = /^(LOGIN|BIRTH_DATE|BIRTH_DATE_SRC)(_\d+)?$/;

/**
 * PapaParse's bucket for cells beyond the declared header columns. Its
 * contents are opaque to the worker, so the whole array is dropped rather
 * than filtered.
 */
const OVERFLOW_KEY = '__parsed_extra';

/**
 * Is this category the one whose rows must be stripped? (D-18)
 *
 * The comparison is case-insensitive on purpose: `classifyFolder` in
 * classify.ts lower-cases before it matches, so a folder literally named
 * `user_info` classifies as the supported `User_Info` category and KEEPS
 * that name. A strip keyed on the exact string `'User_Info'` would
 * therefore treat a real export as ordinary rows and write the email
 * straight to IndexedDB.
 */
export function isUserInfoCategory(name: string): boolean {
  return name.toLowerCase() === 'user_info';
}

/**
 * Normalise a header key for comparison: trim the padding PapaParse
 * preserves and upper-case the casing an export may vary.
 */
function normalizeKey(key: string): string {
  return key.trim().toUpperCase();
}

/**
 * D-18: return a NEW row with LOGIN / BIRTH_DATE / BIRTH_DATE_SRC and the
 * overflow bucket removed. Every other column — IP, city, country, NAME,
 * ID — is kept, because D-18 narrows User_Info for those three columns
 * only and Phase 6 still needs the IPs.
 *
 * The row is REBUILT with `Object.fromEntries` rather than copied and
 * `delete`d from. Two reasons: the input is the object PapaParse handed us
 * and must not be mutated (other code may still hold it), and rebuilding
 * produces own data properties only — a header literally named
 * `__proto__` then lands as an ordinary key instead of walking the
 * prototype chain (T-03-04).
 */
export function sanitizeUserInfoRow(data: UserInfoRow): UserInfoRow {
  const entries = Object.entries(data).filter(
    ([key]) => key !== OVERFLOW_KEY && !DROPPED_COLUMN.test(normalizeKey(key)),
  );
  return Object.fromEntries(entries);
}

/**
 * Read one column from a row by its NORMALISED name (the same trim +
 * upper-case rule the strip uses, so padded and lower-case headers work
 * here too). Returns the trimmed value, or null when the column is absent
 * or holds only whitespace. The first matching key wins, which keeps the
 * result stable for a duplicated column.
 */
function pick(row: UserInfoRow, column: string): string | null {
  for (const [key, value] of Object.entries(row)) {
    if (normalizeKey(key) !== column) continue;
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (trimmed !== '') return trimmed;
  }
  return null;
}

/**
 * D-17 + D-20: build the three-field identity from ALREADY-SANITISED
 * User_Info rows.
 *
 * Row choice: the row whose `ID` equals the detected account root, falling
 * back to the first row when none matches (or when there is no account
 * root at all, as for a re-zipped export with no ID folder). `find` keeps
 * the FIRST of several matching rows, so the pick is stable.
 *
 * The caller is responsible for the sanitisation: because this function
 * only ever receives sanitised rows, the email and birth data are not in
 * scope to be read, even accidentally.
 *
 * Returns `null` for an empty row list — the signal that NO User_Info row
 * was parsed, which is what puts the identity header into its D-16
 * fallback. A row whose columns are missing or blank yields an object
 * with `null` slots instead, which renders as "Unknown" per field.
 */
export function extractIdentity(
  rows: readonly UserInfoRow[],
  accountRoot: string,
): AccountIdentity | null {
  if (rows.length === 0) return null;
  const match =
    accountRoot === '' ? undefined : rows.find((row) => pick(row, 'ID') === accountRoot);
  const row = match ?? rows[0]!;
  return {
    nickname: pick(row, 'NAME'),
    region: pick(row, 'REGION'),
    createdAt: pick(row, 'CREATED_AT'),
  };
}
