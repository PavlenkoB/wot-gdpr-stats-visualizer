import type { AccountIdentity } from '../core/types/worker-messages.ts';
import { parseIp } from '../geo/ip.ts';
import { MAX_ACCOUNT_TEXT_LENGTH, type AccountRecord } from '../features/logins/login-shared.ts';

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
 *      email. So every key goes through ONE normaliser: NFKC, trim,
 *      upper-case, then a bounded Cyrillic / Greek / Turkish-I confusable
 *      fold (02-06, W-1). NFKC alone resolves fullwidth letters; the fold
 *      resolves the capitals UTS #39 lists as ASCII twins. No Cyrillic or
 *      Greek capital is a twin of L or R, and G only via U+050C, so a
 *      native-script column name (the Cyrillic words for name or password)
 *      is neither stripped nor withheld: a fold-triggered match needs a key
 *      that already carries a real ASCII L or R.
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
 * Anything outside ASCII. Written as a Unicode property escape because a
 * literal control-range class trips `no-control-regex`.
 */
const NON_ASCII = /\P{ASCII}/u;

/**
 * Letters, marks and numbers of any script plus the ASCII word characters. A
 * key is split on runs of everything ELSE, so a non-ASCII letter stays inside
 * its token (the resemblance rule needs the token whole).
 */
const RESEMBLANCE_SEPARATOR = /[^A-Z0-9_\p{L}\p{M}\p{N}]+/u;

/**
 * Default_Ignorable_Code_Point: zero-width space and joiners, soft hyphen,
 * variation selectors and the like. Global flag, so it is used ONLY through
 * `replace` — `.test` on a global regex keeps `lastIndex` between calls.
 */
const DEFAULT_IGNORABLE = /\p{Default_Ignorable_Code_Point}/gu;

/** The names the D-18 deny-list is about, spelled out for the resemblance walk. */
const DENIED_NAMES = ['LOGIN', 'BIRTH_DATE', 'BIRTH_DATE_SRC'] as const;

/**
 * Bounded confusable fold: upper-case code point -> the ASCII capital it is a
 * twin of, taken from Unicode UTS #39 confusables.txt v18.0.0 (2026-08-06)
 * when plan 02-06 was written. Nothing is fetched at run time.
 *
 * Deliberately NOT in the table: lower-case-only lookalikes whose capital is
 * not a twin (Cyrillic ghe looks like r, but its capital U+0413 does not look
 * like R and folding it would corrupt ordinary Russian words), soft sign,
 * Greek sigma and the Coptic capitals (historic; the resemblance rule in
 * `hasGluedSensitiveColumn` catches them). Built from numeric code points, not
 * from literal lookalike characters in the source.
 */
const FOLD: ReadonlyMap<string, string> = new Map(
  Object.entries({
    A: [0x0391, 0x0410],
    B: [0x0392, 0x0412],
    C: [0x03f9, 0x0421],
    D: [0x0500],
    E: [0x0395, 0x0415],
    G: [0x050c],
    H: [0x0397, 0x041d, 0x04ba],
    I: [0x0399, 0x0406, 0x04c0, 0x0130],
    N: [0x039d],
    O: [0x039f, 0x041e],
    S: [0x0405],
    T: [0x03a4, 0x0422],
  }).flatMap(([ascii, codePoints]) =>
    codePoints.map((cp) => [String.fromCodePoint(cp), ascii] as const),
  ),
);

/**
 * NFKC, trim, upper-case: the key BEFORE the confusable fold. The resemblance
 * rule reads this form on purpose: the fold replaces an unknown by a certain
 * letter, and the letters that are ambiguous between a capital I and a
 * lower-case l (U+0399, U+0406, U+04C0, U+04CF) would otherwise hide the L of
 * a lower-case `login` behind a confident `I`.
 *
 * A key of printable ASCII (every real header) costs exactly what it cost
 * before: NFKC is the identity on ASCII, so the fast path returns the old
 * `trim().toUpperCase()` unchanged.
 */
function prefoldKey(key: string): string {
  if (!NON_ASCII.test(key)) return key.trim().toUpperCase();
  return key.normalize('NFKC').trim().toUpperCase();
}

/**
 * Normalise a header key for comparison: the {@link prefoldKey} form followed
 * by the bounded confusable fold, applied after upper-casing so lower-case
 * lookalikes fold through their capitals. This is the ONE normaliser the strip,
 * the glued/disguised check and the identity pick share, so the withhold
 * trigger and the strip can never disagree about what a sensitive header is.
 *
 * Invisible characters are deliberately NOT removed here: a key with a
 * zero-width space after `LOGIN` must stay a key the strip does not match, so
 * that `hasGluedSensitiveColumn` withholds the file (02-05 behaviour).
 */
function normalizeKey(key: string): string {
  const pre = prefoldKey(key);
  if (!NON_ASCII.test(pre)) return pre;
  let out = '';
  for (const ch of pre) out += FOLD.get(ch) ?? ch;
  return out;
}

/**
 * Does this row carry a header the D-18 deny-list names? (CR-01 layer 2,
 * plan 01-13)
 *
 * Why the strip is keyed on the HEADER and not only on the folder: the folder
 * a CSV is filed under is attacker-controlled, and classification can be wrong
 * (a renamed folder, a nest under an unknown folder, a misfiled copy, a shape
 * the classifier misreads). A strip that ran only for `isUserInfoCategory`
 * would let LOGIN / BIRTH_DATE / BIRTH_DATE_SRC rest in IndexedDB for any such
 * file. 03-CONTEXT D-18 names the three COLUMNS, so the enforcement point
 * tests the thing D-18 names: a row that carries one of those headers is
 * sanitised wherever it was filed.
 *
 * Own enumerable keys only, through the same `normalizeKey` and the same
 * `DROPPED_COLUMN` the strip uses, so the trigger and the strip can never
 * disagree about what counts as a sensitive header. It does not treat the
 * overflow key alone as a trigger (a row with no deny-listed header keeps its
 * bucket: Phase 2 stores everything outside D-18's three columns) and it
 * never reads a value.
 */
export function hasSensitiveColumn(data: UserInfoRow): boolean {
  for (const key of Object.keys(data)) {
    if (DROPPED_COLUMN.test(normalizeKey(key))) return true;
  }
  return false;
}

/** Does any token of `text`, split on runs outside A-Z, 0-9 and `_`, match the deny-list? */
function hasDeniedToken(text: string): boolean {
  for (const token of text.split(/[^A-Z0-9_]+/)) {
    if (token !== '' && DROPPED_COLUMN.test(token)) return true;
  }
  return false;
}

/**
 * Can `candidate` be read as one of the deny-listed names when every non-ASCII
 * code point is taken as an UNKNOWN that stands for zero or one character and
 * every ASCII character must match the name in order?
 *
 * A walk over the set of target positions reached so far, held as a bit mask
 * (the longest name is 14 characters, so a position and the end fit in 15
 * bits): linear in the candidate length times at most three names. No RegExp is
 * ever built from key text, so a hostile key cannot cost more than that.
 */
function resemblesDeniedName(candidate: string): boolean {
  for (const target of DENIED_NAMES) {
    const full = (1 << (target.length + 1)) - 1;
    let reached = 1; // position 0
    for (const ch of candidate) {
      if (ch.codePointAt(0)! < 0x80) {
        let next = 0;
        for (let p = 0; p < target.length; p++) {
          if ((reached & (1 << p)) !== 0 && target[p] === ch) next |= 1 << (p + 1);
        }
        reached = next;
      } else {
        reached = (reached | (reached << 1)) & full;
      }
      if (reached === 0) break;
    }
    if ((reached & (1 << target.length)) !== 0) return true;
  }
  return false;
}

/**
 * Does any header key HIDE a deny-listed column name, inside a longer key or
 * behind letters the fold cannot resolve? (CR-03 of 02-05, widened by W-1 of
 * 02-06.)
 *
 * Why this exists: `hasSensitiveColumn` / `sanitizeUserInfoRow` are anchored on
 * the WHOLE normalised key, so they only hold when the parser split the header
 * correctly AND the key is spelled in a way the normaliser can resolve. A
 * header whose delimiter was misjudged (`LOGIN;BIRTH_DATE` read as one
 * comma-less cell), a quoted header cell, or a key that mixes ASCII letters
 * with a letter the fold cannot resolve arrives as a single key that the
 * anchored pattern does not match, and the values under it would rest in
 * IndexedDB unredacted. The parser calls this on the parsed keys and withholds
 * the whole file when it is true, which makes the guarantee a property of the
 * KEYS and not of any delimiter heuristic.
 *
 * It shares `normalizeKey` and `DROPPED_COLUMN` with the strip, so the trigger
 * and the strip can never disagree about what a sensitive header is.
 *
 * Policy:
 *   - The predicate is ADDITIVE. The 02-05 rule runs unchanged on the trim and
 *     upper-case of the RAW key (before NFKC, because NFKC can turn a
 *     separator into a word character) and is OR-ed with the later rules, so
 *     nothing 02-05 withheld is released.
 *   - A key the fold resolves to an exact name (fullwidth, Cyrillic or Greek
 *     lookalikes, the Turkish dotted I) is SKIPPED: the strip removes it like
 *     the ASCII name.
 *   - A key that becomes a glued pair only after folding, or whose name is
 *     exposed by removing invisible characters, withholds the file.
 *   - A key that still mixes an ASCII anchor letter with unresolved non-ASCII
 *     letters and can be read as a deny-listed name withholds the file. This
 *     reads the PRE-fold form, so an I/l-ambiguous letter (U+0399, U+0406,
 *     U+04C0, U+04CF) standing for the L of a lower-case `login` is still
 *     caught, while the same letters standing for the I of LOGIN already ended
 *     at the exact-name check.
 *   - `LOGIN_DT` (the real Logins.csv column), `USER_LOGIN`, `LOGIN_NAME` and
 *     `BIRTH_DATE_1` style names are NOT flagged: underscore is a word
 *     character, so they stay one token and the anchored pattern rejects them.
 *   - A key written ENTIRELY in a script outside the fold table (Cherokee,
 *     Latin small capitals) and translated names (the Cyrillic word for
 *     login) are neither stripped nor withheld: an accepted residual
 *     (02-06 T-02-22, the same class as T-03-03; a deny-list matches names,
 *     not meanings).
 *
 * It never reads a cell value and never throws.
 */
export function hasGluedSensitiveColumn(keys: readonly string[]): boolean {
  for (const key of keys) {
    // 02-05 rule, verbatim, on the raw key.
    const raw = key.trim().toUpperCase();
    if (!DROPPED_COLUMN.test(raw) && hasDeniedToken(raw)) return true;

    // An exact name after the fold is removed by the strip, not withheld.
    const folded = normalizeKey(key);
    if (DROPPED_COLUMN.test(folded)) continue;

    // Glued only after folding.
    if (hasDeniedToken(folded)) return true;

    // Printable-ASCII keys have nothing more to hide.
    if (!NON_ASCII.test(key)) continue;

    // An invisible character inside the name hides it.
    const visible = folded.replace(DEFAULT_IGNORABLE, '');
    if (visible !== folded && DROPPED_COLUMN.test(visible)) return true;

    // Resemblance, on the PRE-fold form with invisible characters removed.
    const pre = prefoldKey(key).replace(DEFAULT_IGNORABLE, '');
    for (const token of pre.split(RESEMBLANCE_SEPARATOR)) {
      if (token === '' || !NON_ASCII.test(token) || !/[A-Z]/.test(token)) continue;
      if (resemblesDeniedName(token)) return true;
      const stripped = token.replace(/_\p{Nd}+$/u, '');
      if (stripped !== token && resemblesDeniedName(stripped)) return true;
    }
  }
  return false;
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

/**
 * Cut one untrusted text cell to the bound {@link MAX_ACCOUNT_TEXT_LENGTH}.
 *
 * A cell of an archive can be any length at all, and a 100 KB city name would
 * be stored, structured-cloned to the main thread and rendered — so the cut is
 * a `slice`, never a validation: the account file's own text is shown as
 * written (D-02), and a value that is too long is a value the export made
 * longer than the app will carry rather than one the app decides to reject.
 */
function cutText(value: string | null): string | null {
  return value === null ? null : value.slice(0, MAX_ACCOUNT_TEXT_LENGTH);
}

/**
 * D-02: build the one labelled "Account record" entry from ALREADY-SANITISED
 * User_Info rows — the `Account_Info.csv` row's own IP, country and city, as
 * recorded.
 *
 * ## Why it sits beside `extractIdentity` and not inside it
 *
 * Two guarantees, two functions, and the boundary is the point:
 *
 *   - the IDENTITY HEADER stays three fields (Phase 3 D-18 to D-20), and this
 *     function's output never reaches it;
 *   - the three sensitive columns are already gone, because the pool handed in
 *     has been through `sanitizeUserInfoRow` at the parse loop. There is no
 *     second strip here, and no column allow-list that could drift from it.
 *
 * `extractIdentity` is left byte-identical: a shared private row-chooser would
 * have been tidier, and it is exactly the edit that would let a change to the
 * identity pick reach the account record and a change to the account record
 * reach the identity. Three lines of the same rule are cheaper than one
 * function two privacy guarantees share.
 *
 * ## The row choice is the SAME one, deliberately re-stated
 *
 * The row whose `ID` equals the account root, else the first, and null for an
 * empty pool — so the account record describes the same account the identity
 * does. An export with no User_Info row at all yields `null`, which the login
 * history shows as "no account record" rather than as a row with three blanks.
 *
 * ## Why the address goes through `parseIp`
 *
 * The cell is the user's data and the app is a privacy tool: a value that does
 * not parse is never STORED as text, because a stored cell would be a cell a
 * later renderer could put on a screen, and Phase 3 D-21 keeps dataset text off
 * the screen. The three states are three different facts about the user's own
 * export and are carried as three:
 *
 *   - `readable` — it parsed; `ip` holds the CANONICAL spelling;
 *   - `unreadable` — a non-blank cell that does not parse; `ip` is null and the
 *     cell itself is nowhere;
 *   - `blank` — the cell is absent or holds only whitespace.
 *
 * Collapsing `unreadable` into `blank` would tell a user their export has no
 * address where it has one this build cannot read, and the two render as two
 * different sentences.
 */
export function extractAccountRecord(
  rows: readonly UserInfoRow[],
  accountRoot: string,
): AccountRecord | null {
  if (rows.length === 0) return null;
  const match =
    accountRoot === '' ? undefined : rows.find((row) => pick(row, 'ID') === accountRoot);
  const row = match ?? rows[0]!;

  // `pick` already trims and answers null for absent/blank, so a null here is
  // the BLANK fact and never the unreadable one.
  const rawIp = pick(row, 'IP');
  const parsed = rawIp === null ? null : parseIp(rawIp);
  return {
    ip: parsed === null ? null : parsed.canonical,
    ipState: rawIp === null ? 'blank' : parsed === null ? 'unreadable' : 'readable',
    countryCode: cutText(pick(row, 'COUNTRY_CODE')),
    city: cutText(pick(row, 'CITY')),
  };
}
