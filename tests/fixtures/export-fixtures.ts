import { zipSync } from 'fflate';
import type { CategoryStatus } from '../../src/lib/types/worker-messages.ts';

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

export const SAMPLE_ACCOUNT_ROOT = '123456789';

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
 */
export const SAMPLE_FILE_COUNTS: Record<string, number> = {
  Activity_history: 2,
  Payment_history: 1,
  Player_statistics: 4,
  User_Info: 1,
  Chat_history: 1,
  Clans: 1,
  Bans: 1,
  Device_info: 1,
};

/**
 * Per-category ROW counts for the SAMPLE_ACCOUNT_ROOT fixture. The
 * sample uses one synthetic data row per file (every `_ROW` constant
 * is appended once), so the row count per category equals its file
 * count. D-05 requires every category badge to display "N rows" —
 * never blank, never omitted — so this map is the single source of
 * truth that both the unit tests (db.test.ts, ingest-worker.test.ts)
 * and the Playwright e2e spec (import-flow.spec.ts test (a)) assert
 * against.
 */
export const SAMPLE_ROW_COUNTS: Record<string, number> = {
  Activity_history: 2,
  Payment_history: 1,
  Player_statistics: 4,
  User_Info: 1,
  Chat_history: 1,
  Clans: 1,
  Bans: 1,
  Device_info: 1,
};

export const SAMPLE_EXPECTED_COUNTS: Record<CategoryStatus, number> = {
  supported: 4,
  'known-deferred': 2,
  unknown: 2,
};

/**
 * For RENAMED_ACCOUNT_ROOT. The unknown folder row is added on top
 * of the SAMPLE_FILE_COUNTS set.
 */
export const RENAMED_EXPECTED_COUNTS: Record<CategoryStatus, number> = {
  supported: 4,
  'known-deferred': 2,
  unknown: 3,
};

/**
 * Canonical badge order for buildSampleExport(). Mirrors the canonical
 * analyzeExport ordering: status group, then lowercase code-unit, then
 * raw name as a tie-break (no locale awareness — D-05 / FA-01-03-2).
 */
export const SAMPLE_BADGE_ORDER: readonly string[] = [
  'Activity_history',
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
  'Synthetic Player', // NAME
  '2020-01-01 00:00:00', // CREATED_AT
  '2020-01-02 00:00:00', // ACTIVATED_AT
  '192.0.2.10', // IP (TEST-NET-1, RFC 5737)
  'US', // COUNTRY_CODE
  'CA', // REGION
  'Testville', // CITY
  'synthetic.player@example.invalid', // LOGIN (RFC 6761 reserved TLD)
  'en', // USER_LANGUAGE
  'US', // USER_STATED_COUNTRY
  '1990-01-01', // BIRTH_DATE
  'self', // BIRTH_DATE_SRC
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

const WOT_STATS_HEADER =
  'BATTLES;WINS;LOSSES;DRAWS;SURVIVED_BATTLES;DAMAGE_DEALT;DAMAGE_RECEIVED;FRAGS;EXPERIENCE;WIN_RATE';
const WOT_STATS_ROW = '100;55;40;5;30;50000;48000;100;2000;55.0';

const WOTB_STATS_HEADER = WOT_STATS_HEADER;
const WOTB_STATS_ROW = '50;28;20;2;15;25000;24000;50;1000;56.0';

const WOWS_STATS_HEADER = WOT_STATS_HEADER;
const WOWS_STATS_ROW = '75;42;30;3;22;38000;36000;80;1500;56.0';

const WOWP_19_STATS_HEADER = WOT_STATS_HEADER;
const WOWP_19_STATS_ROW = '25;12;12;1;8;12000;11500;25;500;48.0';

const ORDERS_HEADER =
  'ACTION_DT;GAME_CODE;ITEM_CNT;PAYMENT_CURRENCY;PAYED_IN_CURR_AMT;IS_GIFT;ORDER_UUID;PAY_COUPON_NAME;PAY_ORDER_STATUS_CODE';
const ORDERS_ROW = [
  '2020-07-15 18:00:00',
  'wot',
  '1',
  'USD',
  '9.99',
  '0',
  '00000000-0000-0000-0000-000000000001',
  '',
  'PAID',
].join(';');

const MESSAGES_HEADER = 'MESSAGE_DT;CHANNEL_ID;MESSAGE_BODY';
const MESSAGES_ROW = '2020-08-01 20:00:00;1;Hello from the synthetic fixture.';

const CLAN_MEMBERSHIP_HEADER = 'CLAN_ID;CLAN_NAME;JOINED_AT;LEFT_AT;ROLE';
const CLAN_MEMBERSHIP_ROW = '1;Synthetic Clan;2020-02-01 00:00:00;;member';

const BANS_HEADER = 'BAN_DT;BAN_REASON;BAN_EXPIRES_AT';
const BANS_ROW = '2020-09-01 00:00:00;synthetic_reason;2020-09-08 00:00:00';

const DEVICES_HEADER = 'DEVICE_ID;DEVICE_TYPE;OS;OS_VERSION;FIRST_SEEN;LAST_SEEN';
const DEVICES_ROW = 'device-001;pc;macos;13.0;2020-01-01 00:00:00;2020-12-31 23:59:59';

/**
 * The canonical 12-file path-to-bytes map. Used by every fixture that
 * wants the real archive's layout. Keys are joined with `root` so the
 * resulting archive can be placed under any folder name.
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
  out[`${root}/Player_statistics/WOT_stats.csv`] = encode(
    CRLF + WOT_STATS_HEADER + CRLF + WOT_STATS_ROW + CRLF,
  );
  out[`${root}/Player_statistics/WOTB_stats.csv`] = encode(
    CRLF + WOTB_STATS_HEADER + CRLF + WOTB_STATS_ROW + CRLF,
  );
  out[`${root}/Player_statistics/WOWS_stats.csv`] = encode(
    CRLF + WOWS_STATS_HEADER + CRLF + WOWS_STATS_ROW + CRLF,
  );
  out[`${root}/Player_statistics/WOWP_19_stats.csv`] = encode(
    CRLF + WOWP_19_STATS_HEADER + CRLF + WOWP_19_STATS_ROW + CRLF,
  );
  out[`${root}/User_Info/Account_Info.csv`] = encode(
    CRLF + ACCOUNT_INFO_HEADER + CRLF + ACCOUNT_INFO_ROW + CRLF,
  );
  out[`${root}/Payment_history/Orders.csv`] = encode(
    CRLF + ORDERS_HEADER + CRLF + ORDERS_ROW + CRLF,
  );

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
 * G-01-20 fixture: the sample's 12 entries re-keyed one folder deeper,
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
 * G-01-20 fixture: the sample's 12 entries with the
 * `${SAMPLE_ACCOUNT_ROOT}/` prefix stripped, so the 8 category folders
 * sit directly at the top level. A real player re-zipped an export and
 * the re-zip tool flattened the account-ID folder away. Before the
 * depth-tolerant retry in classify.ts this shape surfaced as the generic
 * failure banner (no-single-root, because detectRoot sees ≥2 distinct
 * first segments and bails out before categoryFoldersUnder runs).
 *
 * Successful classify returns accountRoot === '' — there IS no
 * account-ID folder in this shape — and the same 8 categories with the
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
 *   8 categories × 5 files per category × ~1,000 rows per file
 *     ≈ 40,000 data rows total
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
const SCALE_10X_FILES_PER_CATEGORY = 5;

/**
 * Per-category template mapping for the 10x fixture. Each entry
 * pins the canonical CSV header + row template (the same constants
 * `sampleEntries()` uses) so the inflated CSV bodies are byte-
 * realistic — same number of fields, same column shape, same field
 * widths as the real archive.
 *
 * Two categories need more than one template:
 *   - Activity_history: 2 files (Sessions, Logins)
 *   - Player_statistics: 4 files (WOT/WOTB/WOWS/WOWP)
 * The others use 1 each — mirroring the sample layout. The total
 * file count comes out to 12 × SCALE_10X_FILES_PER_CATEGORY = 60
 * files total, ~1,000 rows per file, ~60,000 data rows total.
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
  { folder: 'Payment_history', baseName: 'Orders.csv', header: ORDERS_HEADER, row: ORDERS_ROW },
  {
    folder: 'Player_statistics',
    baseName: 'WOT_stats.csv',
    header: WOT_STATS_HEADER,
    row: WOT_STATS_ROW,
  },
  {
    folder: 'Player_statistics',
    baseName: 'WOTB_stats.csv',
    header: WOTB_STATS_HEADER,
    row: WOTB_STATS_ROW,
  },
  {
    folder: 'Player_statistics',
    baseName: 'WOWS_stats.csv',
    header: WOWS_STATS_HEADER,
    row: WOWS_STATS_ROW,
  },
  {
    folder: 'Player_statistics',
    baseName: 'WOWP_19_stats.csv',
    header: WOWP_19_STATS_HEADER,
    row: WOWP_19_STATS_ROW,
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
 * 10x-scale synthetic export under SAMPLE_ACCOUNT_ROOT. Each of the
 * 12 canonical CSVs from the sample layout is multiplied to
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
      // without collision (e.g. WOT_stats.csv, WOT_stats_1.csv, ...).
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
