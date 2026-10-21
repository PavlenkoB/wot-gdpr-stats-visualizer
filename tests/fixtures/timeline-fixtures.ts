// =============================================================================
// timeline-fixtures.ts — the multi-account Account timeline archive and its
// hand-derived oracle (plan 12-11)
// =============================================================================
//
// A LEAF data module (tests/fixtures/README.md): its only imports are the pinned
// zip helper and the captured headers, never a shared archive builder, so
// `export-fixtures.ts` could import it without closing a cycle.
//
// Every row VALUE below is hand-typed and fabricated: emails use the reserved
// `.example.invalid` host, addresses sit in TEST-NET (RFC 5737). Column NAMES come
// from the captured headers (`headersOf`), so the archive stays correct if a later
// capture renames one.
//
// Which files exist is decided by the plan 12-01 Pane mapping: a timeline kind the
// user removed at the completeness gate has a `removed` PANE_MAPPING row, writes NO
// file here, and drops out of `TL_EXPECTED` by construction. Nothing below assumes
// all five files are mapped, and no count of five files or six kinds is written
// down: every total is summed over the files that are present.
//
// The oracle holds LITERALS derived by hand from the rows, never a value computed
// by the builder under test. The derivation sits beside each block.
//
// ## One guess, named
//
// The capture records THAT `Language_And_Country_History.NAME` discriminates
// language from country, not WHAT it contains. The rows below write the words
// `language` and `country`; the builder reads any text carrying `lang` or `countr`.
// If the real tokens differ, this is the one place a real export would show it.
// =============================================================================

import { CAPTURED_FILES, DATE_SHAPES, PANE_MAPPING, headersOf } from './new-data-headers.ts';
import { zipSync } from './pinned-zip.ts';

/** The three account roots: numeric folder names of four or more digits. */
export const TL_ROOT_A = '640000001';
export const TL_ROOT_B = '640000002';
export const TL_ROOT_C = '640000003';

/** An email planted as the VALUE of an allowlisted cell; one per kind of cell. */
export const TL_EMAIL_OLD_NAME = 'timeline-oldname-canary@tl.example.invalid';
export const TL_EMAIL_OPERATION = 'timeline-operation-canary@tl.example.invalid';
export const TL_EMAIL_VALUE = 'timeline-value-canary@tl.example.invalid';
export const TL_EMAIL_STATUS = 'timeline-status-canary@tl.example.invalid';
export const TL_EMAIL_SITE = 'timeline-site-canary@tl.example.invalid';

/** An email planted in the EXCLUDED `UID` column of the services file. */
export const TL_EMAIL_UID = 'timeline-uid-canary@tl.example.invalid';

/** A TEST-NET-2 address planted in the EXCLUDED `IP` columns of the history files. */
export const TL_ADDRESS_CANARY = '198.51.100.77';

/** Free text planted in the EXCLUDED `DESCRIPTION` and `REASON` columns of Bans. */
export const TL_DESCRIPTION_CANARY = 'CANARY-DESCRIPTION-TIMELINE';
export const TL_REASON_CANARY = 'CANARY-REASON-TIMELINE';

/** The account nickname, planted in an Account_Info.csv of the archive. */
export const TL_NICKNAME_CANARY = 'CANARY-NICKNAME-TIMELINE';

/** Every string that must appear nowhere at rest and nowhere in a posted view. */
export const TL_CANARIES: readonly string[] = [
  TL_EMAIL_OLD_NAME,
  TL_EMAIL_OPERATION,
  TL_EMAIL_VALUE,
  TL_EMAIL_STATUS,
  TL_EMAIL_SITE,
  TL_EMAIL_UID,
  TL_ADDRESS_CANARY,
  TL_DESCRIPTION_CANARY,
  TL_REASON_CANARY,
  TL_NICKNAME_CANARY,
];

// -----------------------------------------------------------------------------
// The files
// -----------------------------------------------------------------------------

/** The five timeline file ids, in file order. */
export type TlFileId = 'name' | 'service' | 'languageCountry' | 'bans' | 'thirdParties';

const FILE_ORDER: readonly TlFileId[] = [
  'name',
  'service',
  'languageCountry',
  'bans',
  'thirdParties',
];

/** The PANE_MAPPING `cardOrKind` label of each file. */
const LABELS: Readonly<Record<TlFileId, string>> = {
  name: 'Name',
  service: 'Service',
  languageCountry: 'Language and country',
  bans: 'Ban',
  thirdParties: 'Third party',
};

/** The file key of one file, or null when it was removed at the gate. */
function fileKeyOf(file: TlFileId): string | null {
  const row = PANE_MAPPING.find((r) => r.pane === 'timeline' && r.cardOrKind === LABELS[file]);
  if (row === undefined || row.status !== 'mapped') return null;
  return row.fileKey;
}

/** The ordered ids of the files PANE_MAPPING marks mapped. */
const FILES_PRESENT: readonly TlFileId[] = FILE_ORDER.filter((file) => fileKeyOf(file) !== null);

/** The file key of a file that is present; a removed file has none and never gets here. */
export function tlFileKey(file: TlFileId): string {
  const key = fileKeyOf(file);
  if (key === null) throw new Error(`file ${file} is not mapped`);
  return key;
}

/** The folder and file name the capture printed for one file key. */
function locationOf(key: string): { readonly folder: string; readonly fileName: string } {
  const file = CAPTURED_FILES.find((entry) => entry.key === key);
  if (file === undefined) throw new Error(`no capture for ${key}`);
  return { folder: file.folder, fileName: file.fileName };
}

/** The folder and file name of a present file, for tests that write a variant of it. */
export function tlLocation(file: TlFileId): { readonly folder: string; readonly fileName: string } {
  return locationOf(tlFileKey(file));
}

/**
 * A date in the shape the capture records for that column. Only the one recorded
 * shape has a writer here; a capture that records another fails this fixture by
 * file, column and shape instead of writing a date the parser was never asked to
 * read.
 */
function stamp(fileKey: string, column: string, text: string): string {
  const recorded = DATE_SHAPES.find((row) => row.fileKey === fileKey && row.column === column);
  if (recorded === undefined || !recorded.shape.startsWith('YYYY-MM-DD HH:MM:SS.mmm')) {
    throw new Error(`no timeline fixture writer for ${fileKey} ${column} (${recorded?.shape})`);
  }
  return text;
}

// -----------------------------------------------------------------------------
// The CSV helper
// -----------------------------------------------------------------------------

/**
 * Mix the three terminators across a file's lines, as the Phase 11 fixtures do:
 * the header ends CRLF and the body rows cycle CRLF, bare CR, LF.
 */
function withMixedTerminators(header: string, rows: readonly string[]): string {
  const terminators = ['\r\n', '\r', '\n'];
  return header + '\r\n' + rows.map((row, index) => row + terminators[index % 3]!).join('');
}

/**
 * A comma-delimited CSV in the CAPTURED header order from rows keyed by header.
 * A key a row does not give becomes an empty cell. No cell may hold a comma, a
 * quote or a line break (every value in this module is plain text).
 */
export function tlCsvFor(key: string, rows: readonly Readonly<Record<string, string>>[]): string {
  const headers = headersOf(key)?.headers;
  if (headers === undefined) throw new Error(`no captured header for ${key}`);
  const body = rows.map((row) => headers.map((header) => row[header] ?? '').join(','));
  return withMixedTerminators(headers.join(','), body);
}

// -----------------------------------------------------------------------------
// The rows, by account
// -----------------------------------------------------------------------------

type TlRow = Readonly<Record<string, string>>;

/** The date literals used below, one place each. */
const T = {
  nameA: '2024-02-10 09:00:00.000',
  nameB2: '2023-11-01 10:00:00.000',
  svcLink: '2024-04-01 12:00:00.000',
  svcUnlink: '2024-05-01 08:30:00.000',
  svcDiscord: '2024-04-20 17:45:00.000',
  svcEmailOp: '2024-04-02 09:00:00.000',
  lang: '2024-01-15 07:00:00.000',
  langTz: '2023-12-24 18:00:00.000',
  langEmail: '2023-12-01 12:00:00.000',
  banActive: '2024-03-05 20:00:00.000',
  banOldStart: '2022-07-01 00:00:00.000',
  banOldEnd: '2022-07-08 00:00:00.000',
  banSecond: '2022-08-01 00:00:00.000',
  site: '2024-06-01 10:00:00.000',
  siteOld: '2021-05-05 05:05:05.000',
};

/**
 * Name history. `IP` is excluded and carries the address canary.
 *
 *   A: 2024-02-10 AlphaOld -> AlphaNew, and an undated AlphaUndated -> AlphaUndated2
 *   B: 2024-02-10 BravoOld -> BravoNew (the same instant as A's: a tie), and
 *      2023-11-01 with an EMAIL as OLD_NAME (dropped by the guard) -> BravoSecond
 */
function nameRows(key: string): Readonly<Record<string, readonly TlRow[]>> {
  const at = (text: string): string => stamp(key, 'CREATED_AT', text);
  return {
    [TL_ROOT_A]: [
      {
        CREATED_AT: at(T.nameA),
        IP: TL_ADDRESS_CANARY,
        OLD_NAME: 'AlphaOld',
        NEW_NAME: 'AlphaNew',
      },
      {
        CREATED_AT: '',
        IP: TL_ADDRESS_CANARY,
        OLD_NAME: 'AlphaUndated',
        NEW_NAME: 'AlphaUndated2',
      },
    ],
    [TL_ROOT_B]: [
      {
        CREATED_AT: at(T.nameA),
        IP: TL_ADDRESS_CANARY,
        OLD_NAME: 'BravoOld',
        NEW_NAME: 'BravoNew',
      },
      {
        CREATED_AT: at(T.nameB2),
        IP: TL_ADDRESS_CANARY,
        OLD_NAME: TL_EMAIL_OLD_NAME,
        NEW_NAME: 'BravoSecond',
      },
    ],
  };
}

/**
 * External services. `IP` and `UID` are excluded (the UID is an email).
 *
 *   A: LINK steam 2024-04-01, UNLINK steam 2024-05-01
 *   B: the same LINK steam row (another IP and UID), LINK discord 2024-04-20
 *   C: the same LINK steam row again, and 2024-04-02 with an EMAIL as OPERATION
 *      (dropped by the guard) and NAME steam
 */
function serviceRows(key: string): Readonly<Record<string, readonly TlRow[]>> {
  const at = (text: string): string => stamp(key, 'CREATED_AT', text);
  const link = (ip: string): TlRow => ({
    CREATED_AT: at(T.svcLink),
    IP: ip,
    OPERATION: 'LINK',
    NAME: 'steam',
    UID: TL_EMAIL_UID,
  });
  return {
    [TL_ROOT_A]: [
      link(TL_ADDRESS_CANARY),
      {
        CREATED_AT: at(T.svcUnlink),
        IP: TL_ADDRESS_CANARY,
        OPERATION: 'UNLINK',
        NAME: 'steam',
        UID: TL_EMAIL_UID,
      },
    ],
    [TL_ROOT_B]: [
      link('198.51.100.78'),
      {
        CREATED_AT: at(T.svcDiscord),
        IP: TL_ADDRESS_CANARY,
        OPERATION: 'LINK',
        NAME: 'discord',
        UID: TL_EMAIL_UID,
      },
    ],
    [TL_ROOT_C]: [
      link('198.51.100.79'),
      {
        CREATED_AT: at(T.svcEmailOp),
        IP: TL_ADDRESS_CANARY,
        OPERATION: TL_EMAIL_OPERATION,
        NAME: 'steam',
        UID: TL_EMAIL_UID,
      },
    ],
  };
}

/**
 * Language and country. `NAME` says which of language or country `VALUE` holds.
 *
 *   B: language uk and country UA (both 2024-01-15), a timezone row (no entry),
 *      and a language row whose VALUE is an EMAIL (dropped by the guard, so no entry)
 *   C: the same language and country rows as B
 */
function languageRows(key: string): Readonly<Record<string, readonly TlRow[]>> {
  const at = (text: string): string => stamp(key, 'CREATED_AT', text);
  const language: TlRow = {
    CREATED_AT: at(T.lang),
    OPERATION: 'SET',
    NAME: 'language',
    VALUE: 'uk',
  };
  const country: TlRow = { CREATED_AT: at(T.lang), OPERATION: 'SET', NAME: 'country', VALUE: 'UA' };
  return {
    [TL_ROOT_B]: [
      language,
      country,
      { CREATED_AT: at(T.langTz), OPERATION: 'SET', NAME: 'timezone', VALUE: 'UTC' },
      { CREATED_AT: at(T.langEmail), OPERATION: 'SET', NAME: 'language', VALUE: TL_EMAIL_VALUE },
    ],
    [TL_ROOT_C]: [language, country],
  };
}

/**
 * Bans. `DESCRIPTION` and `REASON` are excluded free text. `EXPIRED_AT` holds the
 * export's null marker for an open ban; it is stored but is not an entry date.
 *
 *   A: an open ban started 2024-03-05, status ACTIVE
 *   B: EXPIRED 2022-07-01..2022-07-08, and 2022-08-01 with an EMAIL as STATUS
 *   C: the same open ban as A's (bans never merge: two entries)
 */
function banRows(key: string): Readonly<Record<string, readonly TlRow[]>> {
  const at = (text: string): string => stamp(key, 'STARTED_AT', text);
  const open: TlRow = {
    DESCRIPTION: TL_DESCRIPTION_CANARY,
    STARTED_AT: at(T.banActive),
    EXPIRED_AT: '\\N',
    REASON: TL_REASON_CANARY,
    STATUS: 'ACTIVE',
  };
  return {
    [TL_ROOT_A]: [open],
    [TL_ROOT_B]: [
      {
        DESCRIPTION: TL_DESCRIPTION_CANARY,
        STARTED_AT: at(T.banOldStart),
        EXPIRED_AT: T.banOldEnd,
        REASON: TL_REASON_CANARY,
        STATUS: 'EXPIRED',
      },
      {
        DESCRIPTION: TL_DESCRIPTION_CANARY,
        STARTED_AT: at(T.banSecond),
        EXPIRED_AT: T.banSecond,
        REASON: TL_REASON_CANARY,
        STATUS: TL_EMAIL_STATUS,
      },
    ],
    [TL_ROOT_C]: [open],
  };
}

/**
 * Authorized third parties.
 *
 *   A: ExampleSite 2024-06-01
 *   B: the same ExampleSite 2024-06-01 (never merged), and 2021-05-05 with an
 *      EMAIL as THIRD_PARTY_SITE (dropped by the guard)
 */
function thirdPartyRows(key: string): Readonly<Record<string, readonly TlRow[]>> {
  const at = (text: string): string => stamp(key, 'CREATED_AT', text);
  const site: TlRow = { THIRD_PARTY_SITE: 'ExampleSite', CREATED_AT: at(T.site) };
  return {
    [TL_ROOT_A]: [site],
    [TL_ROOT_B]: [site, { THIRD_PARTY_SITE: TL_EMAIL_SITE, CREATED_AT: at(T.siteOld) }],
  };
}

const ROWS_BY_FILE: Readonly<
  Record<TlFileId, (key: string) => Readonly<Record<string, readonly TlRow[]>>>
> = {
  name: nameRows,
  service: serviceRows,
  languageCountry: languageRows,
  bans: banRows,
  thirdParties: thirdPartyRows,
};

// -----------------------------------------------------------------------------
// The archive
// -----------------------------------------------------------------------------

/**
 * The three-account timeline archive: per root, the file of every kind that
 * PANE_MAPPING marks mapped and that the root holds rows for, plus an
 * Account_Info.csv for the FIRST root carrying the nickname canary (the first
 * root, so its place in the identity header's order cannot change a tie).
 */
export function buildTimelineThreeAccountExport(): Uint8Array {
  const entries: Record<string, Uint8Array> = {};
  const encode = (text: string): Uint8Array => new TextEncoder().encode(text);
  for (const file of FILES_PRESENT) {
    const key = tlFileKey(file);
    const { folder, fileName } = locationOf(key);
    for (const [root, rows] of Object.entries(ROWS_BY_FILE[file](key))) {
      entries[`${root}/${folder}/${fileName}`] = encode(tlCsvFor(key, rows));
    }
  }
  entries[`${TL_ROOT_A}/User_Info/Account_Info.csv`] = encode(
    `ID;NAME;CREATED_AT;REGION\r\n${TL_ROOT_A};${TL_NICKNAME_CANARY};2020-01-01 00:00:00;EU\r\n`,
  );
  return zipSync(entries);
}

// -----------------------------------------------------------------------------
// The oracle
// -----------------------------------------------------------------------------

/** One expected entry: its kind, date text, parts and the roots it names. */
export interface TlExpectedEntry {
  readonly file: TlFileId;
  readonly kind: 'name' | 'service' | 'language' | 'country' | 'ban' | 'thirdParty';
  /** The export's own date text, or null for an undated entry. */
  readonly date: string | null;
  /** The part cells in order: the primary, then the secondary values shown. */
  readonly parts: readonly (string | null)[];
  /** Every root the entry names, in the order the builder lists them. */
  readonly accounts: readonly string[];
}

/** What one present file must contribute. */
export interface TlExpectedFile {
  /** Account files holding it: one presence fact each. */
  readonly files: number;
  /** Rows the allowlist stored, summed over accounts (an email-dropped cell still leaves its row). */
  readonly storedRows: number;
  /** Stored rows the merge removed. */
  readonly mergedAway: number;
}

/**
 * Hand-derived literals for all five files (only the present ones reach TL_EXPECTED).
 *
 * Stored rows and presence facts, counted from the row functions above:
 *   name:            A 2 + B 2 = 4 rows, 2 files, nothing merges.
 *   service:         A 2 + B 2 + C 2 = 6 rows, 3 files. The LINK steam row of
 *                    A, B and C is one row three times (IP and UID are not
 *                    stored), so it shows once and 2 rows are merged away.
 *   languageCountry: B 4 + C 2 = 6 rows, 2 files. B's language and country rows
 *                    equal C's, so 2 rows are merged away.
 *   bans:            A 1 + B 2 + C 1 = 4 rows, 3 files. Never merged.
 *   thirdParties:    A 1 + B 2 = 3 rows, 2 files. Never merged.
 */
const ALL_FILES: Readonly<Record<TlFileId, TlExpectedFile>> = {
  name: { files: 2, storedRows: 4, mergedAway: 0 },
  service: { files: 3, storedRows: 6, mergedAway: 2 },
  languageCountry: { files: 2, storedRows: 6, mergedAway: 2 },
  bans: { files: 3, storedRows: 4, mergedAway: 0 },
  thirdParties: { files: 2, storedRows: 3, mergedAway: 0 },
};

/**
 * The whole chronology, newest first, 17 entries when all five files are present.
 * Ties at one instant break by kind, then file, then the account order A, B, C.
 *
 *    1. thirdParty 2024-06-01 10:00 A      \ same instant, kind and file:
 *    2. thirdParty 2024-06-01 10:00 B      / account order
 *    3. service    2024-05-01 08:30 A
 *    4. service    2024-04-20 17:45 B
 *    5. service    2024-04-02 09:00 C   (primary dropped: the email guard)
 *    6. service    2024-04-01 12:00 A,B,C  (the merged LINK steam row)
 *    7. ban        2024-03-05 20:00 A      \ same instant, kind and file
 *    8. ban        2024-03-05 20:00 C      /
 *    9. name       2024-02-10 09:00 A      \ same instant, kind and file
 *   10. name       2024-02-10 09:00 B      /
 *   11. language   2024-01-15 07:00 B,C    \ same instant: kind order puts
 *   12. country    2024-01-15 07:00 B,C    / language before country
 *   13. name       2023-11-01 10:00 B   (primary dropped)
 *   14. ban        2022-08-01 00:00 B   (status dropped)
 *   15. ban        2022-07-01 00:00 B
 *   16. thirdParty 2021-05-05 05:05 B   (site dropped)
 *   17. name       undated          A
 *
 * B's timezone row and its email-valued language row are stored and yield no entry.
 */
const ALL_ENTRIES: readonly TlExpectedEntry[] = [
  {
    file: 'thirdParties',
    kind: 'thirdParty',
    date: T.site,
    parts: ['ExampleSite'],
    accounts: [TL_ROOT_A],
  },
  {
    file: 'thirdParties',
    kind: 'thirdParty',
    date: T.site,
    parts: ['ExampleSite'],
    accounts: [TL_ROOT_B],
  },
  {
    file: 'service',
    kind: 'service',
    date: T.svcUnlink,
    parts: ['UNLINK', 'steam'],
    accounts: [TL_ROOT_A],
  },
  {
    file: 'service',
    kind: 'service',
    date: T.svcDiscord,
    parts: ['LINK', 'discord'],
    accounts: [TL_ROOT_B],
  },
  {
    file: 'service',
    kind: 'service',
    date: T.svcEmailOp,
    parts: [null, 'steam'],
    accounts: [TL_ROOT_C],
  },
  {
    file: 'service',
    kind: 'service',
    date: T.svcLink,
    parts: ['LINK', 'steam'],
    accounts: [TL_ROOT_A, TL_ROOT_B, TL_ROOT_C],
  },
  { file: 'bans', kind: 'ban', date: T.banActive, parts: ['ACTIVE'], accounts: [TL_ROOT_A] },
  { file: 'bans', kind: 'ban', date: T.banActive, parts: ['ACTIVE'], accounts: [TL_ROOT_C] },
  {
    file: 'name',
    kind: 'name',
    date: T.nameA,
    parts: ['AlphaOld', 'AlphaNew'],
    accounts: [TL_ROOT_A],
  },
  {
    file: 'name',
    kind: 'name',
    date: T.nameA,
    parts: ['BravoOld', 'BravoNew'],
    accounts: [TL_ROOT_B],
  },
  {
    file: 'languageCountry',
    kind: 'language',
    date: T.lang,
    parts: ['uk', 'SET'],
    accounts: [TL_ROOT_B, TL_ROOT_C],
  },
  {
    file: 'languageCountry',
    kind: 'country',
    date: T.lang,
    parts: ['UA', 'SET'],
    accounts: [TL_ROOT_B, TL_ROOT_C],
  },
  {
    file: 'name',
    kind: 'name',
    date: T.nameB2,
    parts: [null, 'BravoSecond'],
    accounts: [TL_ROOT_B],
  },
  { file: 'bans', kind: 'ban', date: T.banSecond, parts: [null], accounts: [TL_ROOT_B] },
  { file: 'bans', kind: 'ban', date: T.banOldStart, parts: ['EXPIRED'], accounts: [TL_ROOT_B] },
  {
    file: 'thirdParties',
    kind: 'thirdParty',
    date: T.siteOld,
    parts: [null],
    accounts: [TL_ROOT_B],
  },
  {
    file: 'name',
    kind: 'name',
    date: null,
    parts: ['AlphaUndated', 'AlphaUndated2'],
    accounts: [TL_ROOT_A],
  },
];

/** The kinds in the pane's fixed chip order. */
const KIND_ORDER = ['name', 'service', 'language', 'country', 'ban', 'thirdParty'] as const;

const ENTRIES_PRESENT = ALL_ENTRIES.filter((entry) => FILES_PRESENT.includes(entry.file));

const sum = (pick: (file: TlExpectedFile) => number): number =>
  FILES_PRESENT.reduce((total, file) => total + pick(ALL_FILES[file]), 0);

/** The oracle for the archive, for the files PANE_MAPPING marks mapped only. */
export const TL_EXPECTED: {
  /** Ordered mapped file ids. */
  readonly filesPresent: readonly TlFileId[];
  /** The ordered entries of the chronology. */
  readonly entries: readonly TlExpectedEntry[];
  /** The kinds that have at least one entry, in chip order; the chip count is this plus one. */
  readonly kindsPresent: readonly string[];
  /** Per present file: presence facts, stored rows and rows merged away. */
  readonly perFile: Readonly<Partial<Record<TlFileId, TlExpectedFile>>>;
  /** The view's `storedRows` and `mergedAway`. */
  readonly storedRows: number;
  readonly mergedAway: number;
  /** The pane fact: presence facts and stored rows summed over the present files. */
  readonly pane: { readonly fileCount: number; readonly rowCount: number };
} = {
  filesPresent: FILES_PRESENT,
  entries: ENTRIES_PRESENT,
  kindsPresent: KIND_ORDER.filter((kind) => ENTRIES_PRESENT.some((entry) => entry.kind === kind)),
  perFile: Object.fromEntries(FILES_PRESENT.map((file) => [file, ALL_FILES[file]])),
  storedRows: sum((file) => file.storedRows),
  mergedAway: sum((file) => file.mergedAway),
  pane: { fileCount: sum((file) => file.files), rowCount: sum((file) => file.storedRows) },
};
