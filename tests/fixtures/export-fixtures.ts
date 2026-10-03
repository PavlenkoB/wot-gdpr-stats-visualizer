import { zipSync } from './pinned-zip.ts';
import type { CategoryStatus } from '../../src/lib/types/worker-messages.ts';
import {
  CURRENCY_HAND_CSV,
  CURRENCY_HAND_ROWS,
  ORDERS_HAND_CSV,
  ORDERS_HAND_ROWS,
  ORDERS_HEADER_12,
  PREMIUM_HAND_CSV,
  PREMIUM_HAND_ROWS,
} from './finance-fixtures.ts';
import {
  PLAYER_STATS_SAMPLE_FILES,
  PLAYER_STATS_SAMPLE_ROW_COUNT,
} from './player-stats-fixtures.ts';
import { SAMPLE_ACCOUNT_ROOT } from './sample-account.ts';

/**
 * Re-exported from the leaf module so the importer surface every existing
 * test already uses is unchanged. The DEFINITION lives in
 * `./sample-account.ts` because a data module (sessions-fixtures, via
 * finance-fixtures) needs it too, and importing it from here would close a
 * cycle through this file's module body. See that file's header.
 */
export { SAMPLE_ACCOUNT_ROOT };

/**
 * Synthetic, PII-free Wargaming-export fixtures, generated in memory.
 *
 * Mirrors the real 2021 sample's folder/column structure (verified
 * against `.planning/PROJECT.md`'s Context section), but every value
 * is fabricated. The Playwright spec feeds these bytes straight to
 * the file input — no zip binary is ever committed to the repo.
 *
 * Line endings are deliberately mixed (CRLF in Account_Info.csv, bare
 * CR in Sessions.csv) so Phase 2's CSV-parsing fixture inherits the
 * real archive's quirk.
 *
 * Fixture policy (see `tests/fixtures/README.md`, fixture=synthetic):
 *   - All bytes are produced by `fflate.zipSync` from these helpers.
 *   - No binary fixture is ever committed.
 *   - Every builder is pure and synchronous (the worker treats them
 *     as data, not as user input).
 */

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

export const RENAMED_ACCOUNT_ROOT = 'renamed-root-2026';

export const EXTRA_UNKNOWN_FOLDER = 'Future_category_2026';

/**
 * Synthetic outer-folder name used by buildWrapperExport() to reproduce
 * the G-01-20 "wrapper around a real export" shape (a user re-zipped a
 * downloaded archive into an extra top-level folder, very common).
 *
 * Pinned to a constant so the G-01-20 regression test asserts the
 * accountRoot that analyzeExport surfaces is the INNER folder
 * (SAMPLE_ACCOUNT_ROOT), not this wrapper name.
 */
export const WRAPPER_FOLDER_NAME = 'personal_data_export';

/**
 * Per-category file counts for the SAMPLE_ACCOUNT_ROOT fixture. The
 * directory is the unit of the badge; the counts ARE the proof the
 * folder was actually opened (D-02).
 *
 * The three Phase 5 folders are DERIVED from the fixture modules that
 * own the data, never typed: a count that is re-typed here is a second
 * answer to a question the module already answers, and the two only
 * agree by accident until one of them is edited (05-RESEARCH Pitfall 3,
 * which is what this rewrite exists to close).
 */
export const SAMPLE_FILE_COUNTS: Record<string, number> = {
  Activity_history: 2,
  Payment_history: 1,
  Player_statistics: Object.keys(PLAYER_STATS_SAMPLE_FILES).length,
  User_Info: 1,
  Financial_data: 2,
  Chat_history: 1,
  Clans: 1,
  Bans: 1,
  Device_info: 1,
};

/**
 * Per-category ROW counts for the SAMPLE_ACCOUNT_ROOT fixture. D-05
 * requires every category badge to display "N rows" — never blank, never
 * omitted — so this map is the single source of truth that both the unit
 * tests (db.test.ts, ingest-worker.test.ts) and the Playwright e2e specs
 * (import-flow.spec.ts test (a), dashboard.spec.ts) assert against.
 *
 * Most categories carry one synthetic data row per file, so their row
 * count still equals their file count. The three Phase 5 folders do not:
 * their rows come from the 05-01 and 05-02 hand fixtures and are
 * therefore computed from those modules' own row arrays —
 *   Player_statistics — 05-02's hand-derived total across 19 files
 *   Financial_data    — 05-01's premium rows plus its currency rows
 *   Payment_history   — 05-01's hand Orders rows
 */
export const SAMPLE_ROW_COUNTS: Record<string, number> = {
  Activity_history: 2,
  Payment_history: ORDERS_HAND_ROWS.length,
  Player_statistics: PLAYER_STATS_SAMPLE_ROW_COUNT,
  User_Info: 1,
  Financial_data: PREMIUM_HAND_ROWS.length + CURRENCY_HAND_ROWS.length,
  Chat_history: 1,
  Clans: 1,
  Bans: 1,
  Device_info: 1,
};

export const SAMPLE_EXPECTED_COUNTS: Record<CategoryStatus, number> = {
  supported: 5,
  'known-deferred': 2,
  unknown: 2,
};

// -----------------------------------------------------------------------------
// Account_Info cell constants (03-01)
// -----------------------------------------------------------------------------
//
// Every phase-3 test that asserts on identity or on the D-18 privacy strip
// needs the sample's Account_Info values by NAME rather than as literals
// copied into each test file — a fixture edit would otherwise have to be
// mirrored in a dozen assertions before it surfaced. The values below are
// the ones ACCOUNT_INFO_ROW has always used; that row now reads them back
// from here so the two cannot drift.
//
// SAMPLE_LOGIN / SAMPLE_BIRTH_DATE are the two values that must never
// appear in IndexedDB, the rendered page, the document title or a console
// line (D-18 / D-21). They are `example.invalid` / a distinctive date on
// purpose: a substring assertion on them cannot false-positive against
// CREATED_AT (2020-01-01), which IS legitimately displayed.

/** `NAME` — the nickname the identity header shows (D-12). */
export const SAMPLE_NICKNAME = 'Synthetic Player';
/** Raw `REGION`, shown untranslated (D-13). */
export const SAMPLE_REGION = 'CA';
/** Raw `CREATED_AT` exactly as the export writes it (D-15). */
export const SAMPLE_CREATED_AT = '2020-01-01 00:00:00';
/** `CREATED_AT` as the header displays it — date only, no timezone shift. */
export const SAMPLE_CREATED_DATE = '2020-01-01';
/** `LOGIN` — the account email. Must never be persisted or rendered. */
export const SAMPLE_LOGIN = 'synthetic.player@example.invalid';
/** The reserved-TLD domain of SAMPLE_LOGIN, for substring leak assertions. */
export const SAMPLE_LOGIN_DOMAIN = 'example.invalid';
/** `BIRTH_DATE` — must never be persisted or rendered. */
export const SAMPLE_BIRTH_DATE = '1990-01-01';
/** `IP` (TEST-NET-1, RFC 5737). D-18 keeps this column stored. */
export const SAMPLE_IP = '192.0.2.10';

/** The email the hostile-header variant fixtures put in their LOGIN cells. */
export const VARIANT_LOGIN = `variant.player@${SAMPLE_LOGIN_DOMAIN}`;

/** Overflow-cell canary for the variant fixture (see buildAccountInfoVariantExport). */
export const VARIANT_OVERFLOW_CANARY = 'CANARY-OVERFLOW-CELL';
export const VARIANT_NICKNAME = 'Variant Player';
export const VARIANT_REGION = 'EU';
export const VARIANT_CREATED_AT = '2021-02-03 04:05:06';

/** Second-row values for buildMultiRowAccountInfoExport (D-17 row choice). */
export const MULTIROW_DECOY_ID = '999999999';
export const MULTIROW_DECOY_NICKNAME = 'Decoy Player';
export const MULTIROW_DECOY_REGION = 'NA';
export const MULTIROW_MATCH_NICKNAME = 'Matched Player';
export const MULTIROW_MATCH_REGION = 'EU';
/** The second non-matching ID used by the no-match variant of the same fixture. */
export const MULTIROW_SECOND_NON_MATCHING_ID = '888888888';

/**
 * The cells buildPartialAccountInfoExport leaves POPULATED. The whole point
 * of that fixture is the cells it blanks, so the ones it keeps are named
 * like the other fixtures' — a test can then assert both halves and catch
 * a regression that blanks the entire row as readily as one that drops a
 * single column.
 */
export const PARTIAL_ROW_NICKNAME = 'Partial Row Player';
export const PARTIAL_ROW_REGION = 'EU';

/**
 * A 70-character unbroken alphanumeric nickname. Long enough that a
 * layout that sets no `overflow-wrap` would push the identity header
 * wider than the viewport; the "unbroken" part is the point — there is no
 * space or hyphen for the browser to break on.
 */
export const LONG_NICKNAME =
  'WolfensteinsVeryLongUnbrokenSyntheticNicknameWithoutAnySpaces01xABCDEF';
/**
 * An unknown-category folder name of at least 60 characters with no
 * whitespace, carrying an unterminated `<b>` tag. A zip entry name can
 * never contain `/` — that is the path separator — so the probe is a
 * half-open tag rather than a `<b>bold</b>` pair: it only becomes bold if
 * a renderer interpolates the folder name as HTML instead of text, which
 * is exactly what the untrusted-zip-string rule in AGENTS.md forbids.
 */
export const LONG_UNKNOWN_FOLDER =
  'Future_category_2026_with_a_deliberately_very_long_unbroken_name_<b>bold_markup';

/**
 * For RENAMED_ACCOUNT_ROOT. The unknown folder row is added on top
 * of the SAMPLE_FILE_COUNTS set.
 */
export const RENAMED_EXPECTED_COUNTS: Record<CategoryStatus, number> = {
  supported: 5,
  'known-deferred': 2,
  unknown: 3,
};

/**
 * Canonical badge order for buildSampleExport(). Mirrors the canonical
 * analyzeExport ordering: status group, then lowercase code-unit, then
 * raw name as a tie-break (no locale awareness — D-05 / FA-01-03-2).
 *
 * `Financial_data` is second because the order is by NAME inside the
 * supported group: `activity_history` < `financial_data` < `payment_history`
 * (`pa`+`y` loses to `pl`+`a`... in code units `l` < `y`). It is not the
 * second SUPPORTED category in `categories.ts`, and not the third section in
 * the D-02 page order — three different orders, deliberately.
 */
export const SAMPLE_BADGE_ORDER: readonly string[] = [
  'Activity_history',
  'Financial_data',
  'Payment_history',
  'Player_statistics',
  'User_Info',
  'Chat_history',
  'Clans',
  'Bans',
  'Device_info',
];

// -----------------------------------------------------------------------------
// Row data (shared by sample / renamed / macOS / backslash / directory fixtures)
// -----------------------------------------------------------------------------

const CRLF = '\r\n';
const CR = '\r';

const ACCOUNT_INFO_HEADER =
  'ID;NAME;CREATED_AT;ACTIVATED_AT;IP;COUNTRY_CODE;REGION;CITY;LOGIN;USER_LANGUAGE;USER_STATED_COUNTRY;BIRTH_DATE;BIRTH_DATE_SRC';

const ACCOUNT_INFO_ROW = [
  SAMPLE_ACCOUNT_ROOT, // ID
  SAMPLE_NICKNAME, // NAME
  SAMPLE_CREATED_AT, // CREATED_AT
  '2020-01-02 00:00:00', // ACTIVATED_AT
  SAMPLE_IP, // IP (TEST-NET-1, RFC 5737)
  'US', // COUNTRY_CODE
  SAMPLE_REGION, // REGION
  'Testville', // CITY
  SAMPLE_LOGIN, // LOGIN (RFC 6761 reserved TLD) — stripped before write (D-18)
  'en', // USER_LANGUAGE
  'US', // USER_STATED_COUNTRY
  SAMPLE_BIRTH_DATE, // BIRTH_DATE — stripped before write (D-18)
  'self', // BIRTH_DATE_SRC — stripped before write (D-18)
].join(';');

const SESSIONS_HEADER = 'SESSION_START;SESSION_END;CLIENT_BUILD;CLIENT_PLATFORM;SERVER_NAME;IP';
const SESSIONS_ROW = [
  '2020-06-01 12:00:00',
  '2020-06-01 13:30:00',
  '1.0.0',
  'win',
  'eu-1',
  '192.0.2.20',
].join(';');

const LOGINS_HEADER = 'LOGIN_DT;IP;COUNTRY_CODE;USER_AGENT';
const LOGINS_ROW = '2020-06-01 12:00:00;192.0.2.30;US;Mozilla/5.0';

const MESSAGES_HEADER = 'MESSAGE_DT;CHANNEL_ID;MESSAGE_BODY';
const MESSAGES_ROW = '2020-08-01 20:00:00;1;Hello from the synthetic fixture.';

const CLAN_MEMBERSHIP_HEADER = 'CLAN_ID;CLAN_NAME;JOINED_AT;LEFT_AT;ROLE';
const CLAN_MEMBERSHIP_ROW = '1;Synthetic Clan;2020-02-01 00:00:00;;member';

const BANS_HEADER = 'BAN_DT;BAN_REASON;BAN_EXPIRES_AT';
const BANS_ROW = '2020-09-01 00:00:00;synthetic_reason;2020-09-08 00:00:00';

const DEVICES_HEADER = 'DEVICE_ID;DEVICE_TYPE;OS;OS_VERSION;FIRST_SEEN;LAST_SEEN';
const DEVICES_ROW = 'device-001;pc;macos;13.0;2020-01-01 00:00:00;2020-12-31 23:59:59';

// -----------------------------------------------------------------------------
// The Phase 5 folders (05-06, D-03/D-04)
// -----------------------------------------------------------------------------
//
// The three folders this phase owns are no longer assembled from literals
// here. Each is written EXACTLY as its owning fixture module renders it:
//
//   Player_statistics — `PLAYER_STATS_SAMPLE_FILES`, plan 05-02's nineteen
//     real-named files with the real per-title headers
//   Financial_data    — `PREMIUM_HAND_CSV` and `CURRENCY_HAND_CSV`, plan
//     05-01's hand fixtures under the export's own file names
//   Payment_history   — `ORDERS_HAND_CSV`, the full 12-column Orders file
//
// Two consequences follow, and both are the point of the rewrite:
//
//   1. THE PHYSICAL SHAPE IS THE REAL ONE. These files are written in the
//      export's payments-era format: an unquoted header line, quote-all
//      data cells, and a BARE CR terminator with no line feed anywhere.
//      The other sample files keep their CRLF style, so the sample carries
//      BOTH shapes at once — which is what the real archive does, and what
//      Phase 2's parser was built to handle. A CRLF re-wrap here would make
//      a green suite prove nothing about the format it stands in for.
//
//   2. THE COUNTS FOLLOW THE DATA. `SAMPLE_FILE_COUNTS` and
//      `SAMPLE_ROW_COUNTS` above are computed from these modules, so adding
//      a row to a hand fixture cannot leave a stale count behind.
//
// THE MODULE ORDER IS A LEAF RULE, NOT AN ACCIDENT: the data modules import
// nothing from this file, so this builder may import them. (`05-03` could
// not do this and transcribed the two finance headers by hand, with a
// lockstep test to hold the copy honest; the duplication is gone.)

/**
 * The canonical 29-file path-to-bytes map. Used by every fixture that
 * wants the real archive's layout. Keys are joined with `root` so the
 * resulting archive can be placed under any folder name.
 *
 * Nine folders: five supported (Activity_history, Player_statistics,
 * Financial_data, Payment_history, User_Info), two known-deferred
 * (Chat_history, Clans) and two unknown (Bans, Device_info).
 *
 * IMPORTANT: keep this list stable — 01-01's zero-network Playwright
 * spec depends on the exact set of names produced by buildSampleExport().
 */
function sampleEntries(root: string): Record<string, Uint8Array> {
  const encode = (s: string): Uint8Array => new TextEncoder().encode(s);
  const out: Record<string, Uint8Array> = {};

  // supported
  out[`${root}/Activity_history/Sessions.csv`] = encode(SESSIONS_HEADER + CR + SESSIONS_ROW + CR);
  out[`${root}/Activity_history/Logins.csv`] = encode(
    CRLF + LOGINS_HEADER + CRLF + LOGINS_ROW + CRLF,
  );
  // Player_statistics: 05-02's nineteen real-named files, verbatim. Encoded
  // without any CRLF wrapping — the module already renders the export's own
  // bare-CR terminator, and re-wrapping would silently replace the format
  // this file exists to exercise.
  for (const [fileName, csv] of Object.entries(PLAYER_STATS_SAMPLE_FILES)) {
    out[`${root}/Player_statistics/${fileName}`] = encode(csv);
  }
  out[`${root}/User_Info/Account_Info.csv`] = encode(
    CRLF + ACCOUNT_INFO_HEADER + CRLF + ACCOUNT_INFO_ROW + CRLF,
  );
  out[`${root}/Payment_history/Orders.csv`] = encode(ORDERS_HAND_CSV);
  out[`${root}/Financial_data/Operations_with_Premium_Days.csv`] = encode(PREMIUM_HAND_CSV);
  out[`${root}/Financial_data/Virtual_Currencies_Operations.csv`] = encode(CURRENCY_HAND_CSV);

  // known-deferred
  out[`${root}/Chat_history/Messages.csv`] = encode(
    CRLF + MESSAGES_HEADER + CRLF + MESSAGES_ROW + CRLF,
  );
  out[`${root}/Clans/Clan_membership.csv`] = encode(
    CRLF + CLAN_MEMBERSHIP_HEADER + CRLF + CLAN_MEMBERSHIP_ROW + CRLF,
  );

  // unknown (not in either list)
  out[`${root}/Bans/Bans.csv`] = encode(CRLF + BANS_HEADER + CRLF + BANS_ROW + CRLF);
  out[`${root}/Device_info/Devices.csv`] = encode(
    CRLF + DEVICES_HEADER + CRLF + DEVICES_ROW + CRLF,
  );

  return out;
}

// -----------------------------------------------------------------------------
// Builders
// -----------------------------------------------------------------------------

export function buildSampleExport(): Uint8Array {
  return zipSync(sampleEntries(SAMPLE_ACCOUNT_ROOT));
}

/**
 * Per-category file count for `buildLargeExport()` (D-10 / success
 * criterion 3: the responsiveness bound at 20,000 entries).
 *
 * With 8 categories in the sample layout, the default
 * LARGE_EXPORT_FILES_PER_CATEGORY * 8 = 20,000 total entries. The
 * classifier must stay responsive (no 250 ms+ main-thread long task)
 * while the worker enumerates them.
 *
 * Lower values are useful for fast local iteration; the 20k default
 * is what the Playwright spec asserts against.
 */
export const LARGE_EXPORT_FILES_PER_CATEGORY = 2500;

/**
 * Synthetic 20,000-entry export under SAMPLE_ACCOUNT_ROOT, used by
 * the responsiveness Playwright spec. Same 8 category folders as the
 * sample, but each populated with `filesPerCategory` tiny fabricated
 * CSV files named `part-00001.csv` through `part-<n>.csv`.
 *
 * Every entry is fabricated — no real account data. The archive is
 * built in memory with `fflate.zipSync`, so the binary is never
 * committed to disk.
 */
export function buildLargeExport(
  filesPerCategory: number = LARGE_EXPORT_FILES_PER_CATEGORY,
): Uint8Array {
  const root = SAMPLE_ACCOUNT_ROOT;
  const categories = [
    'Activity_history',
    'Payment_history',
    'Player_statistics',
    'User_Info',
    'Chat_history',
    'Clans',
    'Bans',
    'Device_info',
  ];
  const entries: Record<string, Uint8Array> = {};

  for (const category of categories) {
    for (let i = 1; i <= filesPerCategory; i++) {
      const padded = String(i).padStart(5, '0');
      entries[`${root}/${category}/part-${padded}.csv`] = new TextEncoder().encode(
        `PART_ID;VALUE\n${padded};synthetic\n`,
      );
    }
  }

  return zipSync(entries);
}

/**
 * Sample under RENAMED_ACCOUNT_ROOT plus two one-line CSVs inside
 * EXTRA_UNKNOWN_FOLDER. Proves the classifier is not hard-coded to
 * the literal `123456789` root (IMPORT-02).
 */
export function buildRenamedRootExport(): Uint8Array {
  const entries = sampleEntries(RENAMED_ACCOUNT_ROOT);
  entries[`${RENAMED_ACCOUNT_ROOT}/${EXTRA_UNKNOWN_FOLDER}/Tickets.csv`] = new TextEncoder().encode(
    'TICKET_ID;SUBJECT\n1;synthetic\n',
  );
  entries[`${RENAMED_ACCOUNT_ROOT}/${EXTRA_UNKNOWN_FOLDER}/Notes.csv`] = new TextEncoder().encode(
    'NOTE_ID;BODY\n1;synthetic\n',
  );
  return zipSync(entries);
}

/**
 * Sample with macOS-style OS metadata noise: __MACOSX sidecar,
 * .DS_Store, Thumbs.db. All should be filtered before classify.
 */
export function buildMacRezippedExport(): Uint8Array {
  const entries = sampleEntries(SAMPLE_ACCOUNT_ROOT);
  const root = SAMPLE_ACCOUNT_ROOT;
  const empty = new Uint8Array(0);
  entries[`__MACOSX/${root}/Activity_history/._Sessions.csv`] = empty;
  entries[`${root}/.DS_Store`] = empty;
  entries[`${root}/Activity_history/.DS_Store`] = empty;
  entries[`${root}/User_Info/Thumbs.db`] = empty;
  return zipSync(entries);
}

/**
 * Sample whose keys use backslashes instead of forward slashes.
 * Classify must normalize; the lister must NOT (entry names come
 * back verbatim).
 */
export function buildBackslashExport(): Uint8Array {
  const src = sampleEntries(SAMPLE_ACCOUNT_ROOT);
  const out: Record<string, Uint8Array> = {};
  for (const [k, v] of Object.entries(src)) {
    out[k.replace(/\//g, '\\')] = v;
  }
  return zipSync(out);
}

/**
 * Sample with explicit directory entries. The empty `Bonus_codes/`
 * folder must still appear with fileCount 0.
 */
export function buildDirectoryEntriesExport(): Uint8Array {
  const entries = sampleEntries(SAMPLE_ACCOUNT_ROOT);
  const root = SAMPLE_ACCOUNT_ROOT;
  const empty = new Uint8Array(0);
  entries[`${root}/`] = empty;
  entries[`${root}/Clans/`] = empty;
  entries[`${root}/Bonus_codes/`] = empty;
  return zipSync(entries);
}

/**
 * A zip with photo data but no recognizable Wargaming category.
 * Triggers no-recognized-category.
 */
export function buildNoRecognizedCategoryZip(): Uint8Array {
  const fake = (s: string): Uint8Array => new TextEncoder().encode(s);
  return zipSync({
    'holiday-photos/2019/beach.jpg': fake('ffd8ffe000104a464946'),
    'holiday-photos/2020/snow.jpg': fake('ffd8ffe000104a464946'),
  });
}

/**
 * Two root folders side-by-side. Triggers no-single-root.
 */
export function buildMultiRootZip(): Uint8Array {
  const data = new TextEncoder().encode('ID;NAME\n1;x\n');
  return zipSync({
    '123456789/User_Info/Account_Info.csv': data,
    '987654321/User_Info/Account_Info.csv': data,
  });
}

/**
 * A lone top-level file. Triggers no-single-root (a single file
 * is NOT a root folder).
 */
export function buildSingleFileZip(): Uint8Array {
  return zipSync({
    'document.pdf': new TextEncoder().encode('%PDF-1.4\n%fake\n'),
  });
}

/**
 * Files directly under the root, no category folders. Triggers
 * no-category-folders.
 */
export function buildFilesOnlyUnderRootZip(): Uint8Array {
  return zipSync({
    '123456789/readme.txt': new TextEncoder().encode('hello\n'),
    '123456789/notes.txt': new TextEncoder().encode('world\n'),
  });
}

/**
 * A valid, empty zip (zipSync of {}). unzipSync returns without
 * throwing; the filter sees zero entries.
 */
export function buildEmptyZip(): Uint8Array {
  return zipSync({});
}

/**
 * G-01-20 fixture: the sample's entries re-keyed one folder deeper,
 * under `${WRAPPER_FOLDER_NAME}/${SAMPLE_ACCOUNT_ROOT}/...`. A real
 * player re-zipped their downloaded archive into an extra top-level
 * folder; before the depth-tolerant retry in classify.ts this shape
 * surfaced as the generic failure banner (no-recognized-category,
 * because the inner account-ID folder was mis-classified as a category).
 *
 * Uses the same internal `sampleEntries(root)` helper as buildSampleExport
 * so the per-category row data is identical — only the nesting depth
 * differs. The wrapper folder name itself carries no semantics: a
 * successful classify returns the INNER accountRoot (SAMPLE_ACCOUNT_ROOT),
 * not the wrapper.
 */
export function buildWrapperExport(): Uint8Array {
  const wrappedRoot = `${WRAPPER_FOLDER_NAME}/${SAMPLE_ACCOUNT_ROOT}`;
  return zipSync(sampleEntries(wrappedRoot));
}

/**
 * G-01-20 fixture: the sample's entries with the
 * `${SAMPLE_ACCOUNT_ROOT}/` prefix stripped, so the 9 category folders
 * sit directly at the top level. A real player re-zipped an export and
 * the re-zip tool flattened the account-ID folder away. Before the
 * depth-tolerant retry in classify.ts this shape surfaced as the generic
 * failure banner (no-single-root, because detectRoot sees ≥2 distinct
 * first segments and bails out before categoryFoldersUnder runs).
 *
 * Successful classify returns accountRoot === '' — there IS no
 * account-ID folder in this shape — and the same 9 categories with the
 * same counts as the sample.
 */
export function buildRootlessExport(): Uint8Array {
  const prefix = `${SAMPLE_ACCOUNT_ROOT}/`;
  const src = sampleEntries(SAMPLE_ACCOUNT_ROOT);
  const out: Record<string, Uint8Array> = {};
  for (const [k, v] of Object.entries(src)) {
    if (!k.startsWith(prefix)) {
      // Defensive: every sampleEntries key starts with `${root}/`, so
      // this branch is unreachable in practice. Kept explicit so any
      // future change to sampleEntries that violates the invariant
      // surfaces as a wrong-keyed entry rather than a silent skip.
      out[k] = v;
      continue;
    }
    out[k.slice(prefix.length)] = v;
  }
  return zipSync(out);
}

/**
 * Plain UTF-8 English sentence — not a zip at all.
 */
export function buildNotAZipBytes(): Uint8Array {
  return new TextEncoder().encode('This is not a zip file. It is plain text.');
}

/**
 * First 60% of a valid sample's bytes. fflate throws on truncated
 * zip data (RESEARCH A2, locked by tests).
 */
export function buildTruncatedExport(): Uint8Array {
  const bytes = buildSampleExport();
  return bytes.slice(0, Math.floor(bytes.length * 0.6));
}

/**
 * An archive whose first local file's deflate stream is corrupt.
 * The lister must still report every entry name (A2 + 01-01 T-01-04
 * "list, don't inflate" proof hand-off). The full unzipSync must
 * throw, proving the bytes really are corrupt.
 *
 * Local file header layout (PKZIP spec):
 *   bytes  0..3   : signature 0x04034b50
 *   bytes  4..5   : version needed
 *   bytes  6..7   : flags
 *   bytes  8..9   : compression method (u16 LE)
 *   bytes 26..27  : file-name length (u16 LE)
 *   bytes 28..29  : extra-field length (u16 LE)
 *   bytes 30..    : file-name (length above)
 *                     extra-field (length above)
 *                     data
 *
 * zipSync writes entries in insertion order, so the FIRST OBJECT
 * KEY inserted is the first entry on disk (offset 0). To make the
 * trap actually corrupt, that entry MUST be deflate-compressed
 * (method 8); store (method 0) bytes overwrite would be a no-op.
 */
export function buildInflateTrapExport(): Uint8Array {
  const inflateContent = inflateTrapContent();
  const entries: Record<string, Uint8Array> = {
    [`${SAMPLE_ACCOUNT_ROOT}/Activity_history/Sessions.csv`]: inflateContent,
  };

  // Append the rest of the sample (any order is fine; only the
  // first local header is being corrupted).
  const rest = sampleEntries(SAMPLE_ACCOUNT_ROOT);
  for (const [k, v] of Object.entries(rest)) {
    if (k === `${SAMPLE_ACCOUNT_ROOT}/Activity_history/Sessions.csv`) continue;
    entries[k] = v;
  }

  const zip = zipSync(entries);

  // Verify the first local header really IS the trap entry and
  // really is deflate-compressed (method 8). Bail loudly otherwise
  // so the trap can never silently become a no-op.
  if (zip.length < 30) {
    throw new Error('inflate trap: zip too short to contain a local header');
  }
  if (zip[0] !== 0x50 || zip[1] !== 0x4b || zip[2] !== 0x03 || zip[3] !== 0x04) {
    throw new Error('inflate trap: missing PK\\x03\\x04 local file signature at offset 0');
  }
  const method = (zip[8] ?? 0) | ((zip[9] ?? 0) << 8);
  if (method !== 8) {
    throw new Error(`inflate trap: expected compression method 8 (deflate), got ${method}`);
  }

  const nameLen = (zip[26] ?? 0) | ((zip[27] ?? 0) << 8);
  const extraLen = (zip[28] ?? 0) | ((zip[29] ?? 0) << 8);
  const dataOffset = 30 + nameLen + extraLen;
  if (dataOffset + 8 > zip.length) {
    throw new Error('inflate trap: not enough bytes to overwrite 8-byte deflate window');
  }

  // Overwrite 8 bytes of the deflate stream with 0xFF. A real
  // deflate stream cannot start (or resume from) such a window,
  // so a full unzipSync will throw "invalid block type"; the
  // lister, which never calls inflate, will not notice.
  for (let i = 0; i < 8; i++) {
    zip[dataOffset + i] = 0xff;
  }

  return zip;
}

/**
 * ~4 KB of repeated fabricated CSV rows. Long enough that the
 * inflated output comfortably exceeds the in-memory buffer that
 * deflate's sliding window needs to keep its state coherent — which
 * is why overwriting 8 bytes near the start reliably corrupts the
 * stream regardless of the compressor's internal strategy.
 */
function inflateTrapContent(): Uint8Array {
  const row = SESSIONS_ROW + ';' + '\n';
  const target = 4096;
  let s = '';
  while (s.length < target) s += row;
  return new TextEncoder().encode(s);
}

// -----------------------------------------------------------------------------
// Mojibake fixture — the documented CONTEXT.md double-UTF8 Cyrillic byte
// pattern, applied to one CSV cell so the worker pipeline is forced to
// exercise fixMojibake on a real mojibake input (not just a synthetic
// round-trip on a pure-ASCII field).
// -----------------------------------------------------------------------------

/**
 * The original UTF-8 Cyrillic source string for the mojibake fixture.
 * The CLAN_NAME field in buildMojibakeExport() is written to the CSV
 * as the inverse — bytes of this string reinterpreted as Latin-1
 * code points — so the field the worker sees is the "double-UTF8"
 * shape that fixMojibake() is designed to undo.
 *
 * PII-free fabricated name (Latin-1 transcription of a Cyrillic
 * phrase meaning "synthetic mojibake test clan"), used only to
 * verify the round-trip of fixMojibake on the documented byte
 * pattern from CONTEXT.md / RESEARCH.md Assumption A2.
 */
export const MOJIBAKE_CLAN_NAME_CORRECTED = 'Синтетический_клан';

/**
 * Helper: inverse of fixMojibake(). Given a UTF-8 source string,
 * returns the string that results from encoding its bytes as Latin-1
 * code points — i.e. the "double-UTF8" mojibake form. Every character
 * of the returned string has a code unit ≤ 0xff, so a follow-up call
 * to fixMojibake() should recover the original.
 */
function toMojibake(original: string): string {
  const bytes = new TextEncoder().encode(original);
  let s = '';
  for (let i = 0; i < bytes.length; i++) {
    s += String.fromCharCode(bytes[i]!);
  }
  return s;
}

/**
 * Same layout as buildSampleExport() but the CLAN_NAME cell in
 * Clans/Clan_membership.csv is written in the mojibake form — the
 * "double-UTF8" byte pattern that real Wargaming exports from 2021
 * exhibited (CONTEXT.md). After the worker parses this file, every
 * CLAN_NAME value in the resulting rows should equal
 * MOJIBAKE_CLAN_NAME_CORRECTED, proving fixMojibake() ran in the
 * parse loop.
 */
export function buildMojibakeExport(): Uint8Array {
  const mojibakeName = toMojibake(MOJIBAKE_CLAN_NAME_CORRECTED);
  // Rebuild only the Clans row with the mojibake field. The header
  // and remaining columns stay as in the sample; only CLAN_NAME
  // (column 2) is replaced.
  const mojibakeClanRow = ['1', mojibakeName, '2020-02-01 00:00:00', '', 'member'].join(';');
  const encode = (s: string): Uint8Array => new TextEncoder().encode(s);
  const CRLF = '\r\n';

  const entries = sampleEntries(SAMPLE_ACCOUNT_ROOT);
  entries[`${SAMPLE_ACCOUNT_ROOT}/Clans/Clan_membership.csv`] = encode(
    CRLF + CLAN_MEMBERSHIP_HEADER + CRLF + mojibakeClanRow + CRLF,
  );
  return zipSync(entries);
}

// -----------------------------------------------------------------------------
// Malformed-rows fixture — proves the D-04 skip-count path end-to-end.
// -----------------------------------------------------------------------------

/**
 * A synthetic export identical to buildSampleExport() except that
 * `Bans/Bans.csv` carries THREE valid rows + ONE row with an
 * unbalanced quote character in the BAN_REASON field (missing its
 * closing quote). The unbalanced quote triggers a 'Quotes'-type
 * PapaParse error tied to that row — the worker routes the error
 * through `parseCsvFile`'s skip path, the row is dropped from
 * `rows`, and `skippedRowCount` for the Bans category becomes 1.
 *
 * The fixture is intentionally minimal (1 row skipped, 3 rows
 * surviving) so the unit test can assert exact counts rather than
 * ranges; the constants below pin the expected values so future
 * changes to `sampleEntries()` or PapaParse's behaviour surface
 * here first, not silently.
 */
export const MALFORMED_ROW_EXPECTED_SKIPPED_COUNT = 1;
export const MALFORMED_ROW_EXPECTED_ROW_COUNT = 3;

export function buildMalformedRowsExport(): Uint8Array {
  const encode = (s: string): Uint8Array => new TextEncoder().encode(s);
  const CRLF = '\r\n';

  // Three well-formed rows + one row whose BAN_REASON field is
  // `"unterminated` (no closing quote). The unterminated quote is
  // the LAST row so PapaParse does not merge subsequent lines into
  // it — its row boundary is preserved and the Quotes error is
  // reported against that row's 1-based data index.
  const validBansRow1 = ['2020-09-01 00:00:00', 'reason_alpha', '2020-09-08 00:00:00'].join(';');
  const validBansRow2 = ['2020-09-02 00:00:00', 'reason_beta', '2020-09-09 00:00:00'].join(';');
  const validBansRow3 = ['2020-09-03 00:00:00', 'reason_gamma', '2020-09-10 00:00:00'].join(';');
  const malformedBansRow = ['2020-09-04 00:00:00', '"unterminated', '2020-09-11 00:00:00'].join(
    ';',
  );

  const entries = sampleEntries(SAMPLE_ACCOUNT_ROOT);
  // No leading CRLF: PapaParse's `error.row` includes every line
  // (including empty lines) when computing the row index, so a
  // leading blank shifts the mapping by 1 and breaks the off-by-one
  // fix in csv-parse.ts. The malformed-row fixture must start
  // directly with the header for the skip to land on the right
  // data index.
  entries[`${SAMPLE_ACCOUNT_ROOT}/Bans/Bans.csv`] = encode(
    BANS_HEADER +
      CRLF +
      validBansRow1 +
      CRLF +
      validBansRow2 +
      CRLF +
      validBansRow3 +
      CRLF +
      malformedBansRow +
      CRLF,
  );
  return zipSync(entries);
}

// -----------------------------------------------------------------------------
// 10x-scale fixture — realistic row VOLUME through CSV-parse/mojibake/bulkPut.
// -----------------------------------------------------------------------------

/**
 * Rows-per-file for `buildScaleExport()`. Sized so the resulting
 * archive carries realistic row content at roughly 10x the 2021
 * sample's ~4,200 data rows:
 *
 *   14 templates × 5 files per template × ~1,000 rows per file
 *     ≈ 70,000 data rows total
 *
 * (The template count is `SCALE_ROW_TEMPLATES.length`; it was 12 before
 * 05-06 gave the scale export its two Financial_data templates and the real
 * per-title vehicle file names.)
 *
 * Distinct from `buildLargeExport()` (Phase 1), which inflates file
 * COUNT to 20,000 (one row per file) to stress fflate's per-entry
 * overhead. The 10x fixture stresses the CSV-parse + mojibake +
 * Dexie bulkPut path with realistic per-file row counts — the
 * surface that Phase 2 actually scales.
 *
 * The value is tuned so the responsive-imports e2e test (c) lands
 * inside its 60 s budget on a developer machine while still pushing
 * enough rows through the parser to make a ≥1000 ms main-thread
 * long task detectable. The test is intentionally well below the
 * 60 s ceiling, so the budget is a safety net, not the gating
 * assertion.
 */
export const SCALE_10X_ROWS_PER_FILE = 1000;

/**
 * How many copies of each template the 10x export writes.
 *
 * Exported (05-06) because the responsive-imports e2e test asserts a
 * category's inflated row count, and the multiplier is one of the three
 * factors in that number. It was a private constant, so the test could
 * only reach the total by typing `5` beside `SCALE_10X_ROWS_PER_FILE` —
 * a second answer to a question this module already owns.
 */
export const SCALE_10X_FILES_PER_CATEGORY = 5;

/**
 * Take a fixture module's rendered CSV text and return the header line and
 * the first data row, which are exactly the two lines a template needs.
 *
 * The fixture modules render with a BARE CR terminator, so splitting on `CR`
 * yields the cells already quote-wrapped and semicolon-joined — the same
 * bytes the parser will see at scale. Reading the template out of the
 * rendered text rather than retyping a header and a row is what keeps this
 * list from becoming a second, silently-diverged copy of the data.
 */
function templateOf(csv: string): { header: string; row: string } {
  const [header = '', row = ''] = csv.split(CR);
  return { header, row };
}

/**
 * Per-category template mapping for the 10x fixture. Each entry pins the
 * canonical CSV header + row template so the inflated CSV bodies are
 * byte-realistic — same number of fields, same column shape, same field
 * widths as the real archive.
 *
 * The four non-Phase-5 templates use this file's own header/row constants.
 * The seven Phase-5 ones take theirs from the owning fixture module's
 * rendered text via `templateOf`, so the scale export carries the REAL file
 * names and the REAL columns: before 05-06 this list named four invented
 * `*_stats.csv` files with a ten-column header that matches no export.
 *
 * Several categories need more than one template — Activity_history has
 * Sessions and Logins, Player_statistics has the four per-title main files,
 * and Financial_data has its two operations files. The file count is
 * `SCALE_ROW_TEMPLATES.length × SCALE_10X_FILES_PER_CATEGORY`; the array
 * length is the single source of that number rather than a comment's
 * arithmetic.
 */
const SCALE_ROW_TEMPLATES: ReadonlyArray<{
  folder: string;
  baseName: string;
  header: string;
  row: string;
}> = [
  {
    folder: 'Activity_history',
    baseName: 'Sessions.csv',
    header: SESSIONS_HEADER,
    row: SESSIONS_ROW,
  },
  { folder: 'Activity_history', baseName: 'Logins.csv', header: LOGINS_HEADER, row: LOGINS_ROW },
  {
    folder: 'Payment_history',
    baseName: 'Orders.csv',
    ...templateOf(ORDERS_HAND_CSV),
  },
  {
    folder: 'Financial_data',
    baseName: 'Operations_with_Premium_Days.csv',
    ...templateOf(PREMIUM_HAND_CSV),
  },
  {
    folder: 'Financial_data',
    baseName: 'Virtual_Currencies_Operations.csv',
    ...templateOf(CURRENCY_HAND_CSV),
  },
  {
    folder: 'Player_statistics',
    baseName: 'WOT_Vehicle_Statistics.csv',
    ...templateOf(PLAYER_STATS_SAMPLE_FILES['WOT_Vehicle_Statistics.csv']!),
  },
  {
    folder: 'Player_statistics',
    baseName: 'WOTB_Vehicle_Statistics.csv',
    ...templateOf(PLAYER_STATS_SAMPLE_FILES['WOTB_Vehicle_Statistics.csv']!),
  },
  {
    folder: 'Player_statistics',
    baseName: 'WOWS_Ship_Statistics.csv',
    ...templateOf(PLAYER_STATS_SAMPLE_FILES['WOWS_Ship_Statistics.csv']!),
  },
  {
    folder: 'Player_statistics',
    baseName: 'WOWP_19_Plane_Statistics.csv',
    ...templateOf(PLAYER_STATS_SAMPLE_FILES['WOWP_19_Plane_Statistics.csv']!),
  },
  {
    folder: 'User_Info',
    baseName: 'Account_Info.csv',
    header: ACCOUNT_INFO_HEADER,
    row: ACCOUNT_INFO_ROW,
  },
  { folder: 'Chat_history', baseName: 'Messages.csv', header: MESSAGES_HEADER, row: MESSAGES_ROW },
  {
    folder: 'Clans',
    baseName: 'Clan_membership.csv',
    header: CLAN_MEMBERSHIP_HEADER,
    row: CLAN_MEMBERSHIP_ROW,
  },
  { folder: 'Bans', baseName: 'Bans.csv', header: BANS_HEADER, row: BANS_ROW },
  { folder: 'Device_info', baseName: 'Devices.csv', header: DEVICES_HEADER, row: DEVICES_ROW },
];

/**
 * How many TEMPLATES each folder contributes to the 10x export — so a test
 * can compute a category's inflated row total as
 * `templates × SCALE_10X_FILES_PER_CATEGORY × SCALE_10X_ROWS_PER_FILE`
 * without knowing the template list.
 *
 * Counted with a `Map` rather than an object literal: 05-02's answer key hit
 * the `__proto__` trap the moment a hostile key met a plain object, and this
 * map is keyed on folder names that come from fixture data.
 */
export const SCALE_TEMPLATES_BY_FOLDER: ReadonlyMap<string, number> = new Map(
  SCALE_ROW_TEMPLATES.reduce((counts, template) => {
    counts.set(template.folder, (counts.get(template.folder) ?? 0) + 1);
    return counts;
  }, new Map<string, number>()),
);

/**
 * 10x-scale synthetic export under SAMPLE_ACCOUNT_ROOT. Each of the
 * canonical CSVs from the sample layout is multiplied to
 * SCALE_10X_FILES_PER_CATEGORY files, each carrying
 * SCALE_10X_ROWS_PER_FILE rows of the canonical row template.
 *
 * Designed for the responsiveness e2e test (c) — proves the parse /
 * mojibake / Dexie bulkPut pipeline stays under 1 s of main-thread
 * time at a row VOLUME 10x the real sample. Distinct from
 * `buildLargeExport()`'s file-count stress test.
 */
export function buildScaleExport(): Uint8Array {
  const encode = (s: string): Uint8Array => new TextEncoder().encode(s);
  const root = SAMPLE_ACCOUNT_ROOT;
  const entries: Record<string, Uint8Array> = {};

  for (const { folder, baseName, header, row } of SCALE_ROW_TEMPLATES) {
    for (let f = 0; f < SCALE_10X_FILES_PER_CATEGORY; f++) {
      // Suffix variant file names so they coexist in the same folder
      // without collision (the real file name, then the same name with
      // `_1`, `_2`, ... before the extension).
      const fileName = f === 0 ? baseName : baseName.replace(/\.csv$/, `_${f}.csv`);
      let body = header;
      for (let r = 0; r < SCALE_10X_ROWS_PER_FILE; r++) {
        body += CRLF + row;
      }
      body += CRLF;
      entries[`${root}/${folder}/${fileName}`] = encode(body);
    }
  }

  return zipSync(entries);
}

// -----------------------------------------------------------------------------
// Phase 3 (03-01) — customisable export builders
// -----------------------------------------------------------------------------
//
// Phase 3 needs exports that vary ALONG ONE AXIS each: one folder missing,
// one CSV emptied, one header shape made hostile. Building a bespoke
// `zipSync` literal per case would duplicate the other eleven files of the
// sample every time, and a change to the canonical layout would then have
// to be mirrored in each copy. So every builder below derives from
// `sampleEntries()` through `buildCustomExport`, which can drop folders and
// overlay individual files.
//
// The builders stay pure and synchronous like the rest of this module, and
// the bytes are still produced in memory — no archive is ever committed.

export interface CustomExportOptions {
  /** Account-root folder name. Defaults to SAMPLE_ACCOUNT_ROOT. */
  root?: string;
  /**
   * First path segments under the root to leave out, matched
   * case-SENSITIVELY (the classifier's own match is case-insensitive, but
   * omitting `user_info` should not silently drop `User_Info` when a test
   * means a specific folder).
   */
  omitFolders?: readonly string[];
  /**
   * Files to write under the root, keyed by a path RELATIVE to the root.
   * Applied AFTER the omissions and able to ADD files as well as replace
   * them, so one override can introduce a whole new folder. Values may be
   * a string (encoded as UTF-8) or raw bytes.
   */
  overrides?: Record<string, string | Uint8Array>;
  /**
   * Individual files to leave out, as paths RELATIVE to the root, matched
   * case-SENSITIVELY against the sample's own file names.
   *
   * Why this exists alongside `omitFolders`: a folder-level omission is the
   * only kind the sample export's other builders needed, and it cannot
   * express "Player_statistics is present but holds ONE of its four titles".
   * Plan 05-12 Task 3 has to — D-05's `not-in-export` and `no-rows` states
   * are two DIFFERENT facts about the same folder, and the only way to reach
   * `not-in-export` for a title is for that title's files to be ABSENT while
   * its siblings are not. Overriding a file with a header-only CSV reaches
   * `no-rows` but not `not-in-export`, so the two states would have been
   * tested by one builder that only proves one of them.
   *
   * Applied before `overrides`, so an override of an omitted file puts it
   * back — the order the reader expects from the option list.
   */
  omitFiles?: readonly string[];
}

export function buildCustomExport(options: CustomExportOptions = {}): Uint8Array {
  const { root = SAMPLE_ACCOUNT_ROOT, omitFolders = [], overrides = {}, omitFiles = [] } = options;
  const omitted = new Set(omitFolders);
  const omittedFiles = new Set(omitFiles);
  const entries: Record<string, Uint8Array> = {};

  for (const [path, bytes] of Object.entries(sampleEntries(root))) {
    const relative = path.slice(root.length + 1);
    const folder = relative.slice(0, relative.indexOf('/'));
    if (omitted.has(folder)) continue;
    if (omittedFiles.has(relative)) continue;
    entries[path] = bytes;
  }

  for (const [relative, value] of Object.entries(overrides)) {
    entries[`${root}/${relative}`] =
      typeof value === 'string' ? new TextEncoder().encode(value) : value;
  }

  return zipSync(entries);
}

/**
 * Render one CSV using this file's CRLF convention: a leading CRLF, then
 * the header, then one CRLF-prefixed row per data row, then a trailing
 * CRLF. Passing no rows yields a header-only file, which PapaParse
 * reports as zero data rows — the `empty` section state.
 */
function renderCsv(header: string, rows: readonly (readonly string[])[]): string {
  let out = CRLF + header + CRLF;
  for (const row of rows) out += CRLF + row.join(';') + CRLF;
  return out;
}

/** User_Info omitted entirely: the identity header takes its D-16 fallback. */
export function buildMissingUserInfoExport(): Uint8Array {
  return buildCustomExport({ omitFolders: ['User_Info'] });
}

/** Payment_history omitted: the absent-category half of DATA-04. */
export function buildMissingPaymentHistoryExport(): Uint8Array {
  return buildCustomExport({ omitFolders: ['Payment_history'] });
}

/** Payment_history present but holding a header-only CSV: the empty half of DATA-04. */
export function buildZeroRowPaymentExport(): Uint8Array {
  return buildCustomExport({
    overrides: { 'Payment_history/Orders.csv': renderCsv(ORDERS_HEADER_12.join(';'), []) },
  });
}

/** Only the five supported categories: the "nothing detected but unsupported" state. */
export function buildOnlySupportedExport(): Uint8Array {
  return buildCustomExport({
    omitFolders: ['Chat_history', 'Clans', 'Bans', 'Device_info'],
  });
}

/**
 * Account_Info.csv holding a DECOY row before the real one, so the D-17 row
 * choice is observable rather than incidental.
 *
 * With `matchingRow` (the default) the second row's ID is the account root,
 * so the identity must come from it. Without it, no row matches and the
 * first row wins by the documented fallback.
 */
export function buildMultiRowAccountInfoExport({
  matchingRow = true,
}: { matchingRow?: boolean } = {}): Uint8Array {
  const decoy = [
    MULTIROW_DECOY_ID,
    MULTIROW_DECOY_NICKNAME,
    SAMPLE_CREATED_AT,
    SAMPLE_IP,
    'NA',
    VARIANT_CREATED_AT,
  ];
  const second = matchingRow
    ? [
        SAMPLE_ACCOUNT_ROOT,
        MULTIROW_MATCH_NICKNAME,
        VARIANT_CREATED_AT,
        SAMPLE_IP,
        MULTIROW_MATCH_REGION,
      ]
    : [
        MULTIROW_SECOND_NON_MATCHING_ID,
        'Second Non-Matching Player',
        SAMPLE_CREATED_AT,
        SAMPLE_IP,
        'EU',
      ];

  // A reduced header keeps the fixture readable while still carrying the
  // three columns the identity reads, plus the two that must be stripped.
  const header = 'ID;NAME;CREATED_AT;IP;REGION;LOGIN';
  return buildCustomExport({
    overrides: { 'User_Info/Account_Info.csv': renderCsv(header, [decoy, second]) },
  });
}

/**
 * The hostile-header shape from RESEARCH Q3's probe, as one real export.
 * Its Account_Info.csv header is
 *
 *   ID; NAME ;CREATED_AT;IP;LOGIN;LOGIN;BIRTH_DATE ;region
 *
 * which is everything a naive strip gets wrong at once:
 *   - ` NAME ` and `BIRTH_DATE ` are PADDED (PapaParse does not trim
 *     headers, so `' LOGIN' === 'LOGIN'` would be false),
 *   - `region` is LOWER-CASE (so `row.REGION` would be undefined),
 *   - the header declares EIGHT columns and the row carries NINE, so
 *     PapaParse puts the ninth cell in `__parsed_extra` — a container no
 *     column deny-list inspects,
 *   - the duplicated `LOGIN` is renamed `LOGIN_1` by PapaParse.
 *
 * The overflow cell holds VARIANT_OVERFLOW_CANARY so a leak is assertable
 * by value, not only by key name.
 */
export function buildAccountInfoVariantExport(): Uint8Array {
  const header = 'ID; NAME ;CREATED_AT;IP;LOGIN;LOGIN;BIRTH_DATE ;region';
  const row = [
    SAMPLE_ACCOUNT_ROOT,
    VARIANT_NICKNAME,
    VARIANT_CREATED_AT,
    SAMPLE_IP,
    VARIANT_LOGIN,
    VARIANT_LOGIN,
    SAMPLE_BIRTH_DATE,
    VARIANT_REGION,
    VARIANT_OVERFLOW_CANARY,
  ];
  return buildCustomExport({
    overrides: { 'User_Info/Account_Info.csv': renderCsv(header, [row]) },
  });
}

/**
 * The sample with its `User_Info` folder re-keyed to `user_info`. The
 * classifier matches folder names case-insensitively, so this classifies as
 * the same supported category while KEEPING the lower-case name — the shape
 * a strip keyed on the literal string 'User_Info' would silently pass over.
 */
export function buildLowercaseUserInfoFolderExport(): Uint8Array {
  const entries: Record<string, Uint8Array> = {};
  for (const [path, bytes] of Object.entries(sampleEntries(SAMPLE_ACCOUNT_ROOT))) {
    entries[path.replace('/User_Info/', '/user_info/')] = bytes;
  }
  return zipSync(entries);
}

/**
 * BOTH `User_Info` and `user_info` in one archive, each holding a login
 * column, plus a lower-case `bans/` folder. Proves the strip covers every
 * entry of the family rather than one of them, and that a case-variant
 * UNKNOWN folder still classifies as unknown.
 */
export function buildCaseVariantFoldersExport(): Uint8Array {
  return buildCustomExport({
    overrides: {
      'user_info/Extra.csv': renderCsv('ID;NAME;LOGIN', [
        [SAMPLE_ACCOUNT_ROOT, 'Extra Synthetic Player', `extra.${SAMPLE_LOGIN_DOMAIN}`],
      ]),
      'bans/Bans.csv': renderCsv('BAN_DT;BAN_REASON;BAN_EXPIRES_AT', [
        ['2020-09-01 00:00:00', 'synthetic_reason', '2020-09-08 00:00:00'],
      ]),
    },
  });
}

/** Account_Info.csv holding only its header: a present category with zero data rows. */
export function buildEmptyAccountInfoExport(): Uint8Array {
  return buildCustomExport({
    overrides: { 'User_Info/Account_Info.csv': renderCsv(ACCOUNT_INFO_HEADER, []) },
  });
}

/**
 * S-1 fixture: an Account_Info.csv whose row PARSED but carries a BLANK
 * cell. This is the shape the D-16 "Unknown" placeholder exists for, and
 * until now no suite ever rendered it: the header-only fixture takes the
 * `fallback` variant and never shows the three-field card at all, so
 * `valueOrUnknown()` ran only over unit-tested inputs and a regression
 * rendering an empty `<dd>` — or a blank nickname heading — passed the
 * entire project.
 *
 * A blank cell and an absent column are the same thing to the worker
 * (`pick()` returns null either way), so the cell is left empty here
 * rather than dropped from the header, which is the case a real export
 * with a partially-filled row produces.
 *
 * `blankRegion` / `blankNickname` select which columns are empty, so one
 * builder covers both the fully-blank row and the single-missing-column
 * row that a real export more often carries. The other columns keep the
 * sample's values.
 */
export function buildPartialAccountInfoExport({
  blankRegion = true,
  blankNickname = true,
}: { blankRegion?: boolean; blankNickname?: boolean } = {}): Uint8Array {
  const header = 'ID;NAME;CREATED_AT;IP;REGION;LOGIN';
  const row = [
    SAMPLE_ACCOUNT_ROOT,
    blankNickname ? '' : PARTIAL_ROW_NICKNAME,
    SAMPLE_CREATED_AT,
    SAMPLE_IP,
    blankRegion ? '' : PARTIAL_ROW_REGION,
    VARIANT_LOGIN,
  ];
  return buildCustomExport({
    overrides: { 'User_Info/Account_Info.csv': renderCsv(header, [row]) },
  });
}

/**
 * Overflow and wrapping fixture: a 70-character unbroken nickname, and an
 * unknown-category folder whose name is long, unbroken, and carries an
 * unterminated `<b>` tag. A layout with no `overflow-wrap` blows out on the
 * nickname; a renderer that interpolates the folder name as HTML rather
 * than text turns the second one into real bold text.
 */
export function buildLongTextExport(): Uint8Array {
  const header = 'ID;NAME;CREATED_AT;IP;REGION';
  const row = [SAMPLE_ACCOUNT_ROOT, LONG_NICKNAME, SAMPLE_CREATED_AT, SAMPLE_IP, SAMPLE_REGION];
  return buildCustomExport({
    overrides: {
      'User_Info/Account_Info.csv': renderCsv(header, [row]),
      [`${LONG_UNKNOWN_FOLDER}/Synthetic.csv`]: renderCsv('PART_ID;VALUE', [['1', 'synthetic']]),
    },
  });
}
