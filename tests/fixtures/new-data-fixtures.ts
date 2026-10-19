// =============================================================================
// new-data-fixtures.ts — the HEAT / WoT Console / Warplanes / WoWS data
// =============================================================================
//
// A data module, importing NOTHING that builds an archive out of other data:
// `tests/fixtures/README.md`'s leaf-module rule is that a data module never
// imports the shared sample builder — that is what lets `export-fixtures.ts`
// import the data modules safely — so the CSV bodies below are spelled out here
// and `multi-account-fixtures.ts` renders them into an archive through its own
// private `assemble`.
//
// Plan 11-03 adds the per-headered fixture set beside the 11-01 session bodies,
// which stay exactly as they were.
//
// ## What is planted, and why it is planted
//
// Every row carries three canary columns that no spec names: an EMAIL, a
// NICKNAME and an ACCOUNT_ID. They exist so the worker-level test can FAIL.
// Without a canary in the input, "no canary in `db.rows`" would be true of any
// build, and the assertion would prove nothing. Every canary is on an
// `.example.invalid` host (RFC 6761), so a committed fixture can never be
// mistaken for a real account (tests/fixtures/README.md, policy 1).
//
// The address in `IP` is from TEST-NET-1 (RFC 5737) and is deliberately
// present on every row: the spec NAMES the IP column, so it is stored and read
// by the login pane — the point is that it is the three columns the spec does
// not name that must be absent, and a fixture that only planted a canary in a
// named column could not tell those two cases apart.
//
// ## Why every expected number is a LITERAL
//
// `NG_EXPECTED` is typed in by hand from the interval arithmetic in the
// comment below and is never produced by the aggregator. A key computed by the
// code under test asserts only that the code agrees with itself.
// =============================================================================

import { NEW_DATA_SPEC_FILES } from '../../src/lib/worker/new-data-specs.ts';
import { CAPTURED_FILES, headersOf } from './new-data-headers.ts';
import { zipSync } from './pinned-zip.ts';

/** The two account roots this fixture's archive holds. */
export const NG_ROOT_A = '610000001';
export const NG_ROOT_B = '610000002';

/** A synthetic address on the reserved `.example.invalid` host. */
export const NG_CANARY_EMAIL = 'ng-canary@heat.example.invalid';

/** A nickname no real account could hold, planted in every HEAT/WOTC row. */
export const NG_CANARY_NICKNAME = 'CANARY-NICKNAME-HEAT';

/** An account id distinct from both roots, so it cannot be a root by accident. */
export const NG_CANARY_ACCOUNT_ID = 'CANARY-ACCOUNT-ID-9001';

/** The header every HEAT and WOTC session file in this module carries. */
export const NG_SESSION_HEADER = 'STARTED_AT;FINISHED_AT;IP;EMAIL;NICKNAME;ACCOUNT_ID';

const CRLF = '\r\n';

/** One row: the three planted columns after the three spec columns. */
type NgRow = readonly [started: string, finished: string, ip: string];

/** Render one HEAT/WOTC session file body (header, then one CRLF line per row). */
function ngCsv(rows: readonly NgRow[]): string {
  let out = NG_SESSION_HEADER + CRLF;
  for (const [started, finished, ip] of rows) {
    out +=
      `${started};${finished};${ip};${NG_CANARY_EMAIL};${NG_CANARY_NICKNAME};${NG_CANARY_ACCOUNT_ID}` +
      CRLF;
  }
  return out;
}

/**
 * Root A's HEAT sessions — the overlap case.
 *
 *   05.03 20:00 -> 21:30   5,400 s
 *   06.03 20:00 -> 20:30   1,800 s
 */
export const NG_HEAT_SESSIONS_A = ngCsv([
  ['05.03.2024 20:00', '05.03.2024 21:30', '192.0.2.10'],
  ['06.03.2024 20:00', '06.03.2024 20:30', '192.0.2.10'],
]);

/**
 * Root B's HEAT sessions — a second account that OVERLAPS A's first row.
 *
 *   05.03 21:00 -> 22:00   3,600 s
 *
 * It begins while A's 20:00-21:30 row is still running, so the HEAT scope's
 * union for 05.03 is 20:00-22:00 = 7,200 s from two intervals — the number a
 * sum-of-lengths would get wrong.
 */
export const NG_HEAT_SESSIONS_B = ngCsv([['05.03.2024 21:00', '05.03.2024 22:00', '192.0.2.11']]);

/** Root A's WoT Console session: 07.03 18:00 -> 19:00, one hour. */
export const NG_WOTC_SESSIONS_A = ngCsv([['07.03.2024 18:00', '07.03.2024 19:00', '192.0.2.12']]);

/** The plain three-column header an already-supported game file carries. */
export const NG_PLAIN_HEADER = 'STARTED_AT;FINISHED_AT;IP';

/** Render a NON-family session file: the real three columns and no canaries. */
function ngPlainCsv(rows: readonly NgRow[]): string {
  let out = NG_PLAIN_HEADER + CRLF;
  for (const [started, finished, ip] of rows) out += `${started};${finished};${ip}` + CRLF;
  return out;
}

/**
 * Root A's WoT session: 04.03 10:00 -> 11:00, one hour.
 *
 * Rendered WITHOUT the planted canaries, and that is load-bearing rather than
 * incidental: WoT is not a new-game family file, so it is stored exactly as it
 * always was. A canary here would sit in `db.rows` by design, and the
 * worker-level assertion "no canary string anywhere in `db.rows`" would then be
 * asserting something false about a correct build.
 */
export const NG_WOT_SESSIONS_A = ngPlainCsv([
  ['04.03.2024 10:00', '04.03.2024 11:00', '192.0.2.13'],
]);

/** Root B's WoT session: 08.03 09:00 -> 10:00, one hour, on its own day. */
export const NG_WOT_SESSIONS_B = ngPlainCsv([
  ['08.03.2024 09:00', '08.03.2024 10:00', '192.0.2.14'],
]);

/**
 * A HEAT file whose header matches NOTHING in the spec.
 *
 * Two columns, neither named by the spec: the file is a family file with a
 * spec, so it reaches the projection and every row projects to `{}`. The import
 * still succeeds and the session aggregators still see the rows — they are what
 * make the file's sessions count as EXCLUDED rather than making the file
 * disappear.
 */
export const NG_HEAT_DRIFTED =
  'SESSION_BEGIN;SESSION_STOP;NOTE' +
  CRLF +
  '05.03.2024 20:00;05.03.2024 21:30;drifted-header-canary' +
  CRLF;

/** A HEAT file that is a header and nothing else: a game the account never played. */
export const NG_HEAT_HEADER_ONLY = NG_SESSION_HEADER + CRLF;

/**
 * A family file with NO spec, in a supported folder.
 *
 * `HEAT_Device_Info.csv` is the worked example in D-15: the name is in the
 * family, the folder is supported, and there is no entry in the spec table — so
 * it stores NOTHING. The body carries a canary so the test can prove the rows
 * were never written rather than merely never read.
 */
export const NG_UNLISTED_BODY =
  NG_SESSION_HEADER +
  CRLF +
  `05.03.2024 20:00;05.03.2024 21:30;192.0.2.90;${NG_CANARY_EMAIL};${NG_CANARY_NICKNAME};${NG_CANARY_ACCOUNT_ID}` +
  CRLF;

/**
 * The answer key, computed BY HAND from the rows above.
 *
 * ## HEAT — 9,000 s, 3 sessions, 2 active days
 *
 *   - 05.03: A 20:00-21:30 (5,400) and B 21:00-22:00 (3,600) OVERLAP. The
 *     union is 20:00-22:00 = 7,200 s — 1,200 s less than the two lengths added.
 *   - 06.03: 20:00-20:30 = 1,800 s.
 *   - 7,200 + 1,800 = 9,000 s over 3 sessions on 2 days.
 *
 * ## WOTC — 3,600 s, 1 session, 1 day
 *
 *   - 07.03 18:00-19:00.
 *
 * ## WOT — 7,200 s, 2 sessions, 2 days
 *
 *   - 04.03 10:00-11:00 (3,600) and 08.03 09:00-10:00 (3,600). Disjoint days,
 *     so no merge.
 *
 * ## All games — 19,800 s, 6 sessions, 5 active days
 *
 *   - 04.03 3,600 · 05.03 7,200 (the HEAT union) · 06.03 1,800 ·
 *     07.03 3,600 (WOTC) · 08.03 3,600 = 19,800 s, 6 sessions, 5 days.
 *   - The per-game sum is 9,000 + 3,600 + 7,200 = 19,800 — EQUAL here, because
 *     no two games in this fixture overlap in time. That is deliberate: it
 *     makes the All figure checkable by addition as well as by union, and the
 *     cross-game overlap case is proved by `MA_OVERLAP_EXPECTED` instead.
 */
export const NG_EXPECTED = {
  HEAT: { seconds: 9000, sessions: 3, days: 2 },
  WOTC: { seconds: 3600, sessions: 1, days: 1 },
  WOT: { seconds: 7200, sessions: 2, days: 2 },
  ALL: { seconds: 19800, sessions: 6, days: 5 },
  /** The stored `games` list, in the worker's own sorted order. */
  games: ['HEAT', 'WOT', 'WOTC'],
  /** Usable sessions across the whole archive; nothing here is excluded. */
  excluded: 0,
} as const;

// =============================================================================
// Plan 11-03 — one synthetic CSV per CAPTURED file header, and its variants
// =============================================================================
//
// Everything below is generated FROM THE CAPTURE (`new-data-headers.ts`), never
// from the shape of a legacy file. Every one of the eighteen captured files is
// COMMA-delimited (11-HEADERS.md Notes 4), which is the single most load-bearing
// fact about them: a semicolon fixture would parse to one column per row, the
// allowlist would match nothing, and the file would store nothing — a silent,
// fail-closed WRONG answer rather than a visible failure.
//
// Three values are deliberate:
//
//   - addresses are drawn from 203.0.113.0/24 (TEST-NET-3), NOT the
//     192.0.2.0/24 the session fixtures above use, so a later test can tell a
//     HEAT geolocation address from a login address;
//   - line endings MIX (CRLF, bare CR, LF), because the capture counts all
//     three and prints no terminator, so the mixed-ending half of the Phase 5
//     note is still unverified for these files (Pitfall 10);
//   - every cell is a function of the column index and the row index, so two
//     builds of the same fixture are byte-identical and a value can be traced
//     back to the column it came from.
// =============================================================================

/** Every spec file key, in the order the spec table lists them. */
export const NEW_DATA_SPEC_KEYS: readonly string[] = NEW_DATA_SPEC_FILES.map((spec) => spec.key);

/** The captured header list of one spec file, or an empty list. */
function headersFor(key: string): readonly string[] {
  return headersOf(key)?.headers ?? [];
}

/** The spec's `header -> kind` map for one file; absent for a column it excludes. */
function kindsFor(key: string): ReadonlyMap<string, string> {
  const spec = NEW_DATA_SPEC_FILES.find((candidate) => candidate.key === key);
  return new Map((spec?.columns ?? []).map((column) => [column.header, column.kind]));
}

/** The folder the capture filed one file in, exactly as the archive spells it. */
function folderFor(key: string): string {
  const file = CAPTURED_FILES.find((entry) => entry.key === key);
  if (file === undefined) throw new Error(`no capture for ${key}`);
  return file.folder;
}

/** The file name the capture printed, e.g. `WOWP_19_Plane_Statistics.csv`. */
function fileNameFor(key: string): string {
  const file = CAPTURED_FILES.find((entry) => entry.key === key);
  if (file === undefined) throw new Error(`no capture for ${key}`);
  return file.fileName;
}

/** How many body rows the per-file fixture carries. */
const FIXTURE_ROWS = 3;

/**
 * `DD.MM.YYYY HH:MM` of row `index` — the export's own stamp shape (D-01), and
 * a shape a reader can really parse, so a date column is never a free-text cell
 * that happens to look like a date.
 */
function stampFor(index: number): string {
  const day = String((index % 28) + 1).padStart(2, '0');
  const hour = String(index % 24).padStart(2, '0');
  const minute = String((index * 7) % 60).padStart(2, '0');
  return `${day}.03.2024 ${hour}:${minute}`;
}

/** One deterministic cell for a column of a given kind. */
function cellFor(header: string, kind: string, row: number, column: number): string {
  switch (kind) {
    case 'number':
      return String((row + 1) * 10 + column);
    case 'date':
      return stampFor(row);
    case 'address':
      // TEST-NET-3 (RFC 5737), deliberately not the session fixtures' range.
      return `203.0.113.${((row * 8 + column) % 200) + 1}`;
    default:
      return `Synthetic ${header} ${row + 1}`;
  }
}

/** The delimiter every captured file uses, quoted here so a reader cannot miss it. */
const DELIMITER = ',';

/**
 * One body row's cells, by column KIND where the spec names the column and as
 * synthetic text where it does not.
 *
 * A column the spec EXCLUDES still gets a plausible cell: a fixture whose
 * excluded columns were blank would prove nothing about the allowlist, because
 * a dropped column and an empty one look the same at rest.
 */
function rowCells(key: string, row: number): string[] {
  const kinds = kindsFor(key);
  return headersFor(key).map((header, column) =>
    cellFor(header, kinds.get(header) ?? 'text', row, column),
  );
}

/** The three body rows of one file, unquoted and comma-joined. */
function bodyRows(key: string): string[] {
  return Array.from({ length: FIXTURE_ROWS }, (_, row) => rowCells(key, row).join(DELIMITER));
}

/**
 * Mix the three terminators across a file's lines.
 *
 * `csv-parse` splits a mixed file on LF after rewriting CR and CRLF, so this is
 * the shape that proves the wrapper rather than PapaParse's single guess (W-2).
 */
function withMixedTerminators(header: string, rows: readonly string[]): string {
  const terminators = ['\r\n', '\r', '\n'];
  return header + '\r\n' + rows.map((row, index) => row + terminators[index % 3]!).join('');
}

/** ONE synthetic CSV per spec file: its captured header and three body rows. */
export interface NewDataFixtureFile {
  /** The folder the capture filed it in, spelled as the archive spells it. */
  readonly folder: string;
  /** The file name the capture printed, extension included. */
  readonly fileName: string;
  /** The plain CSV: captured header, three rows, mixed terminators. */
  readonly csv: string;
}

/** Every spec file's plain fixture, keyed by the spec's lower-cased file key. */
export const NEW_DATA_FIXTURE_FILES: Readonly<Record<string, NewDataFixtureFile>> =
  Object.fromEntries(
    NEW_DATA_SPEC_KEYS.map((key) => [
      key,
      {
        folder: folderFor(key),
        fileName: fileNameFor(key),
        csv: withMixedTerminators(headersFor(key).join(DELIMITER), bodyRows(key)),
      },
    ]),
  );

// -----------------------------------------------------------------------------
// The canaries
// -----------------------------------------------------------------------------

/**
 * The personal column names planted beside every captured header.
 *
 * Fourteen names across the four families rule (a) of the decision table reads
 * (a person, an account, an identity), rule (b) (sub-country location) and the
 * unverified-coordinate hazard. Every value is synthetic: an `.example.invalid`
 * host (RFC 6761), a made-up digit string, or a `CANARY-…` token.
 */
export const NEW_DATA_CANARY_HEADERS: readonly string[] = [
  'NAME',
  'NICKNAME',
  'LOGIN',
  'EMAIL',
  'E_MAIL',
  'BIRTH_DATE',
  'ACCOUNT_ID',
  'SPA_ID',
  'USER_ID',
  'IP_ADDRESS',
  'PHONE',
  'LATITUDE',
  'LONGITUDE',
  'CITY',
];

/** ONE planted column and the value that would prove a leak. */
export interface CanaryColumn {
  /** The header the fixture plants. */
  readonly header: string;
  /** A value that appears NOWHERE else, so finding it names the column. */
  readonly value: string;
}

/** The canary value for one header of one file: unique per FILE and per HEADER. */
function canaryValue(key: string, header: string, index: number): string {
  const slug = `${key.replace(/[^a-z0-9]+/gi, '-').toUpperCase()}-${index}`;
  if (header === 'EMAIL' || header === 'E_MAIL') return `canary-${slug}@new-data.example.invalid`;
  if (header === 'IP_ADDRESS') return `203.0.113.250`;
  if (header === 'PHONE') return `+1000000${String(index).padStart(3, '0')}`;
  if (header === 'LATITUDE') return `+41.0${index}`;
  if (header === 'LONGITUDE') return `+006.0${index}`;
  return `CANARY-${header}-${slug}`;
}

/**
 * The canary columns ONE file's fixture plants.
 *
 * A name the file's own allowlist already names is never planted: the geolocation
 * file's `IP` is a legitimate stored address, and planting a second column called
 * `IP` would make "the canary is absent" and "the allowlisted column is absent"
 * the same assertion. A name the file's CAPTURE already carries is dropped for
 * the same reason — the capture column is already an excluded column, and
 * planting a duplicate of it would test PapaParse's duplicate handling instead
 * of the allowlist.
 */
export function canaryColumnsFor(key: string): readonly CanaryColumn[] {
  const allowed = new Set(
    (NEW_DATA_SPEC_FILES.find((s) => s.key === key)?.columns ?? []).map((c) => c.header),
  );
  const captured = new Set(headersFor(key));
  return NEW_DATA_CANARY_HEADERS.filter(
    (header) => !allowed.has(header) && !captured.has(header),
  ).map((header, index) => ({ header, value: canaryValue(key, header, index) }));
}

/** The plain fixture plus every canary column, a duplicate header and one surplus cell. */
export function withCanaries(key: string): string {
  const canaries = canaryColumnsFor(key);
  const captured = headersFor(key);
  const firstAllowed = [...kindsFor(key).keys()][0] ?? captured[0] ?? 'COLUMN';
  // The duplicated header and the surplus cell are the two shapes a projection
  // must survive: PapaParse suffixes the repeat, and a cell past the header
  // lands in `__parsed_extra`, which no column list can see into.
  const header = [...captured, ...canaries.map((c) => c.header), firstAllowed].join(DELIMITER);
  const rows = bodyRows(key).map(
    (row, index) =>
      row +
      DELIMITER +
      canaries.map((c) => c.value).join(DELIMITER) +
      DELIMITER +
      `duplicate-${index}`,
  );
  rows[0] = `${rows[0]}${DELIMITER}surplus-beyond-the-header`;
  return withMixedTerminators(header, rows);
}

/** The same rows under a BOM, lower-case and space-padded headers. */
export function bomPaddedLowerCsv(key: string): string {
  const headers = headersFor(key).map((header) => `  ${header.toLowerCase()}  `);
  return '﻿' + withMixedTerminators(headers.join(DELIMITER), bodyRows(key));
}

/** Headers that match NOTHING in the spec, so the file must store nothing. */
export function driftedCsv(key: string): string {
  const header = ['DRIFTED_ALPHA', 'DRIFTED_BETA', 'DRIFTED_GAMMA'].join(DELIMITER);
  const rows = Array.from(
    { length: FIXTURE_ROWS },
    (_, index) =>
      `CANARY-DRIFT-${key.toUpperCase()}-${index}` +
      DELIMITER +
      index +
      DELIMITER +
      stampFor(index),
  );
  return withMixedTerminators(header, rows);
}

/** A header and no body rows: a file the account has no records of. */
export function headerOnlyCsv(key: string): string {
  return headersFor(key).join(DELIMITER) + '\r\n';
}

/** A 100 KB header name, beside a real header so the file still matches. */
const HOSTILE_HEADER = `H${'X'.repeat(99_999)}`;

/** The captured header plus `__proto__` and a 100 KB name, with a value for each. */
export function hostileHeaderCsv(key: string): string {
  const captured = headersFor(key);
  const header = [...captured, '__proto__', HOSTILE_HEADER].join(DELIMITER);
  const rows = bodyRows(key).map(
    (row, index) => row + DELIMITER + `CANARY-PROTO-${index}` + DELIMITER + `CANARY-LONG-${index}`,
  );
  return withMixedTerminators(header, rows);
}

/** The same rows, every cell quoted, every record separated by a BARE CR. */
export function bareCrQuotedCsv(key: string): string {
  const quote = (cells: readonly string[]): string =>
    cells.map((cell) => `"${cell}"`).join(DELIMITER);
  const header = quote(headersFor(key));
  const rows = bodyRows(key).map((row) => quote(row.split(DELIMITER)));
  return header + '\r' + rows.join('\r') + '\r';
}

/**
 * `rowCount` deterministic body rows under one file's captured header.
 *
 * The scale fixture for plans 11-07, 11-10 and 11-11: windowing has to be proved
 * on a table with the width a real export's largest file has, and the only real
 * sample this repo has is small (11-HEADERS.md Notes 8). Values are a function of
 * the row index alone, so the output is byte-identical between runs.
 */
export function buildLargeTableCsv(key: string, rowCount: number): string {
  const header = headersFor(key).join(DELIMITER);
  const kinds = kindsFor(key);
  const columns = headersFor(key);
  const rows = Array.from({ length: rowCount }, (_, row) =>
    columns
      .map((name, column) => cellFor(name, kinds.get(name) ?? 'text', row, column))
      .join(DELIMITER),
  );
  return header + '\n' + rows.join('\n') + '\n';
}

/**
 * ONE single-root archive holding every spec file, with per-file overrides.
 *
 * `files` replaces a file's body by SPEC KEY; `folders` files that body under a
 * different category folder, which is what the misfiled variant needs (a spec's
 * category is an independent condition, so a copy under `Payment_History`
 * matches no spec and stores nothing).
 *
 * The root carries every file at once rather than one file per archive because
 * PRIV-01 asks for a test per HEADER, and a matrix of twelve files through one
 * import is one setup rather than twelve.
 */
export function buildNewDataFilesExport(
  files: Readonly<Record<string, string>> = {},
  options: { folders?: Readonly<Record<string, string>>; root?: string } = {},
): Uint8Array {
  const root = options.root ?? NG_ROOT_A;
  const entries: Record<string, Uint8Array> = {};
  const encode = (text: string): Uint8Array => new TextEncoder().encode(text);
  for (const key of NEW_DATA_SPEC_KEYS) {
    const fixture = NEW_DATA_FIXTURE_FILES[key]!;
    const folder = options.folders?.[key] ?? fixture.folder;
    entries[`${root}/${folder}/${fixture.fileName}`] = encode(files[key] ?? fixture.csv);
  }
  return zipSync(entries);
}

/** The single-root archive with every file MISFILED under `Payment_History`. */
export function buildMisfiledNewDataFilesExport(): Uint8Array {
  const folders: Record<string, string> = {};
  for (const key of NEW_DATA_SPEC_KEYS) folders[key] = 'Payment_History';
  return buildNewDataFilesExport({}, { folders });
}

/** The two Warships pane files, by spec key. */
export const NG_WOWS_PANE_KEYS: readonly string[] = ['wows_crews.csv', 'wows_account_storage.csv'];

/** The four HEAT pane files, by spec key. */
export const NG_HEAT_PANE_KEYS: readonly string[] = [
  'heat_account_statistics.csv',
  'heat_battle_types_statistics.csv',
  'heat_account_storage.csv',
  'heat_session_geolocation.csv',
];

/** Rows root B's Warships files carry, so the two accounts' rows can be told apart. */
export const NG_TWO_ACCOUNT_B_WOWS_ROWS = 2;

/**
 * A TWO-account archive for the pane views (plan 11-07, also used by 11-11).
 *
 * Root A holds the two Warships files with the plain three-row fixture. Root B
 * holds the same two files with {@link NG_TWO_ACCOUNT_B_WOWS_ROWS} rows each, so
 * a view's rows can be attributed by count as well as by root, and ALSO holds
 * the four HEAT pane files, so HEAT rows come from B alone. The file names and
 * folders are the capture's own; nothing else is in the archive.
 */
export function buildNewDataTwoAccountExport(): Uint8Array {
  const entries: Record<string, Uint8Array> = {};
  const encode = (text: string): Uint8Array => new TextEncoder().encode(text);
  const put = (root: string, key: string, csv: string): void => {
    const fixture = NEW_DATA_FIXTURE_FILES[key]!;
    entries[`${root}/${fixture.folder}/${fixture.fileName}`] = encode(csv);
  };
  for (const key of NG_WOWS_PANE_KEYS) {
    put(NG_ROOT_A, key, NEW_DATA_FIXTURE_FILES[key]!.csv);
    put(NG_ROOT_B, key, buildLargeTableCsv(key, NG_TWO_ACCOUNT_B_WOWS_ROWS));
  }
  for (const key of NG_HEAT_PANE_KEYS) put(NG_ROOT_B, key, NEW_DATA_FIXTURE_FILES[key]!.csv);
  return zipSync(entries);
}

/** The four Warplanes files, by spec key (plan 11-11). */
export const NG_WOWP_KEYS: readonly string[] = [
  'wowp_19_plane_statistics.csv',
  'wowp_20_plane_statistics.csv',
  'wowp_19_account_statistics.csv',
  'wowp_20_account_statistics.csv',
];

// =============================================================================
// Plan 11-11 — the answer key of the THREE-account new-games archive
// =============================================================================
//
// `buildNewGamesThreeAccountExport` (multi-account-fixtures.ts) puts the four
// HEAT pane files in the EU root, the two Warships files in the RU and NA roots
// and the four Warplanes files in the RU root. Every file is the plain
// three-row fixture with the canary columns of `withCanaries`, so every figure
// below is the rule "three rows per file" written out, never read back from the
// worker or the page:
//
//   HEAT       4 files x 3 rows (EU alone)                  = 12 rows
//   Warships   2 files x 3 rows x 2 accounts (RU and NA)    = 12 rows, 4 files
//              with a large RU storage file of N rows        = 12 - 3 + N rows
//   Geolocation addresses: the IP column is the second captured header (index
//              1), so row r holds `203.0.113.((r * 8 + 1) % 200 + 1)`:
//              r = 0, 1, 2  ->  .2, .10, .18
//
// The account roots are spelled out as strings because this data module cannot
// import `multi-account-fixtures.ts` (the leaf-module rule); the unit test
// pins them to the `MA_ROOT_*` constants.
// =============================================================================

/** The three roots the archive holds, in D-16 order (RU, EU, NA). */
export const NG3_ROOTS = ['2000002', '500000001', '1000000003'] as const;

/** The large Warships storage file's row count in the browser archive. */
export const NG3_LARGE_STORAGE_ROWS = 3000;

export const NG3_EXPECTED = {
  /** The root that holds each record. */
  roots: {
    heat: ['500000001'],
    warships: ['2000002', '1000000003'],
    warplanes: ['2000002'],
  },
  /** What the shell's two optional rows read as counts. */
  heat: { fileCount: 4, rowCount: 12 },
  warshipsStorage: { fileCount: 4, rowCount: 12 },
  /** The Warships row count when the RU storage file holds NG3_LARGE_STORAGE_ROWS rows. */
  warshipsStorageLarge: { fileCount: 4, rowCount: 12 - 3 + NG3_LARGE_STORAGE_ROWS },
  /**
   * The rows of the Account storage TABLE alone in the large archive: RU's
   * NG3_LARGE_STORAGE_ROWS plus NA's three. The table's `aria-rowcount` is this
   * plus the header row, and its last row's `aria-rowindex` is this plus one.
   */
  warshipsStorageTableRowsLarge: NG3_LARGE_STORAGE_ROWS + 3,
  /** The full addresses of the HEAT geolocation card, in row order (TEST-NET-3). */
  geolocationAddresses: ['203.0.113.2', '203.0.113.10', '203.0.113.18'],
  /** Accounts that hold a Warplanes account record. */
  warplanesAccountCount: 1,
} as const;

/**
 * Every canary VALUE planted in a pane or Warplanes file, across all keys.
 *
 * Built from the same `canaryColumnsFor` the fixtures plant with. The email,
 * nickname and login values are unique per file, so finding one names the file.
 * `203.0.113.250` (the `IP_ADDRESS` canary) is kept out: it is an address, and
 * the address assertion owns it.
 */
export function ng3PaneCanaryValues(): readonly string[] {
  const keys = [...NG_HEAT_PANE_KEYS, ...NG_WOWS_PANE_KEYS, ...NG_WOWP_KEYS];
  const values = new Set<string>();
  for (const key of keys) {
    for (const canary of canaryColumnsFor(key)) {
      if (canary.header !== 'IP_ADDRESS') values.add(canary.value);
    }
  }
  return [...values];
}
