import { describe, expect, it } from 'vitest';
import type {
  CapturedFile,
  CapturedHeaders,
  ColumnRisk,
  DateShapeRow,
  PaneMappingRow,
} from '../../fixtures/new-data-headers.ts';

// =============================================================================
// Phase 11 captured-header constants guard (plan 11-02 Task 3, T-11-06).
// =============================================================================
//
// WHAT THIS FILE IS
// A names-only lint over `tests/fixtures/new-data-headers.ts`, the module that
// transcribes `.planning/phases/11-new-game-data/11-HEADERS.txt` — the header
// capture the USER produced by running `header_capture.py` on their own export
// zip. Every later plan (11-03, 11-07, 11-08, 11-10, 11-11) builds its
// allowlist specs, label maps and fixtures from those constants, so a value that
// leaked into them would be committed and would reach a shipped bundle.
//
// WHY A LINT RATHER THAN A SNAPSHOT
// A snapshot would only prove the file has not changed; it would happily accept a
// file that had an email address in it from the start. These assertions are
// properties of every token rather than of one expected list, so they also hold
// for a future capture that gains new columns.
//
// THE FOUR SHAPES A LEAK TAKES (T-11-06)
//   1. an at-sign — an email address or a login, the one personal value the
//      capture script's token pattern is designed to keep out;
//   2. an all-digit token — an account number or a numeric data row;
//   3. a run of four or more digits — a real Wargaming account id, which is
//      longer than any column name and never contains a letter;
//   4. a token that is not identifier-shaped at all — a nickname, a city name,
//      a free-text answer, or the `HDR [suppressed]` marker.
//
// The account-folder relabel is asserted separately for the same reason: the
// capture prints `ACCT-A`/`ACCT-B`, and a real numeric root must never appear.
//
// WHY THE IMPORT IS PROBED RATHER THAN STATIC
// This module is the artifact the task creates, so before it exists a static
// import would fail the whole FILE at load time — which is a collection fault,
// not a test failure, and says nothing about the lint. Probing the import turns
// "the names-only module is missing" into the first ordinary failing assertion
// and lets the shape assertions below run and fail on their own terms. Once the
// module exists the probe is a plain `await import` and the two paths are the
// same, so nothing about the GREEN behaviour is special-cased here.
//
// WHY THIS TEST NEVER READS `.planning/`
// The raw capture is the one file in the phase that came out of the user's real
// export, and it lives outside the test tree on purpose. This guard lints the
// TRANSCRIPTION, which is the thing every plan imports; making it re-read the
// raw file would couple a unit test to a planning artifact and would put the
// real-data path back on the unit-test read path it was kept off.

/** The capture's own refusal marker, which must never be stored as a column. */
const SUPPRESSED = '[suppressed]';

/** A column name, as `header_capture.py` defines identifier-like. */
const IDENTIFIER_TOKEN = /^[A-Za-z][A-Za-z0-9_]*$/;

/** Four or more consecutive digits: an account number, never a column name. */
const DIGIT_RUN = /\d{4,}/;

/** The one account label shape the capture may print (T-11-06). */
const ACCOUNT_LABEL = /^ACCT-[A-Z]$/;

const loaded = await import('../../fixtures/new-data-headers.ts').catch(() => null);

/** Empty before GREEN, the real capture after it. Every shape test reads this. */
const files: readonly CapturedFile[] = loaded?.CAPTURED_FILES ?? [];

/** Null before GREEN; the real helper after it. */
const headersOf: (key: string) => CapturedHeaders | null = loaded?.headersOf ?? (() => null);

const keysOf = (list: readonly CapturedFile[]): string[] => list.map((file) => file.key);

/**
 * Every file key plan 11-02's interface block names, except the Surveys file.
 *
 * `HEAT_Surveys.csv` is absent from THIS list because Phase 11 captured it only
 * as an unknown-folder file; since Phase 12 (PERKS-03, plan 12-02) it has a spec
 * and is asserted by PHASE_12_KEYS below. `HEAT_Device_Info.csv` IS required — it
 * is a target file with a deliberate "no spec, stores nothing (D-15)" decision,
 * so its absence would mean the capture silently missed a target file rather
 * than that it was out of scope.
 */
const REQUIRED_KEYS: readonly string[] = [
  'heat_game_sessions.csv',
  'heat_session_geolocation.csv',
  'wotc_game_sessions.csv',
  'heat_device_info.csv',
  'heat_account_statistics.csv',
  'heat_account_storage.csv',
  'heat_battle_types_statistics.csv',
  'wowp_19_account_statistics.csv',
  'wowp_19_plane_statistics.csv',
  'wowp_20_account_statistics.csv',
  'wowp_20_plane_statistics.csv',
  'wows_crews.csv',
  'wows_account_storage.csv',
];

/**
 * Every file key plan 12-01's capture holds and a pane can use (the Pane mapping
 * of `12-HEADERS.md`). `heat_surveys.csv` was already captured in Phase 11 and is
 * not entered twice.
 */
const PHASE_12_KEYS: readonly string[] = [
  'authorized_third_parties.csv',
  'bans.csv',
  'bonus_code_usage.csv',
  'personal_coupons.csv',
  'subscriptions.csv',
  'heat_surveys.csv',
  'account_name_history.csv',
  'external_services_history.csv',
  'language_and_country_history.csv',
];

const NEW_PHASE_12_KEYS = PHASE_12_KEYS.filter((key) => key !== 'heat_surveys.csv');

/** The Phase 12 constants; empty before GREEN so each lint fails on its own terms. */
const riskAnswers: Readonly<Record<string, Readonly<Record<string, ColumnRisk>>>> =
  loaded?.COLUMN_RISK_ANSWERS ?? {};
const paneMapping: readonly PaneMappingRow[] = loaded?.PANE_MAPPING ?? [];
const dateShapes: readonly DateShapeRow[] = loaded?.DATE_SHAPES ?? [];

describe('the names-only capture module', () => {
  it('exists and is importable', () => {
    expect(loaded, 'tests/fixtures/new-data-headers.ts').not.toBeNull();
  });

  it('holds one entry per FILE group of the capture', () => {
    expect(files.length).toBeGreaterThanOrEqual(10);
  });
});

describe('CAPTURED_FILES', () => {
  it('records only identifier-shaped header tokens', () => {
    for (const file of files) {
      for (const token of file.headers ?? []) {
        expect(token, `${file.key} header`).toMatch(IDENTIFIER_TOKEN);
      }
    }
  });

  it('records no token that is all digits', () => {
    for (const file of files) {
      for (const token of file.headers ?? []) {
        expect(token, `${file.key} header`).not.toMatch(/^\d+$/);
      }
    }
  });

  it('records no at-sign anywhere, which is the shape of an email or a login', () => {
    for (const file of files) {
      for (const token of file.headers ?? []) {
        expect(token, `${file.key} header`).not.toContain('@');
      }
      expect(file.key).not.toContain('@');
      expect(file.folder).not.toContain('@');
    }
  });

  it('records no run of four or more digits in a key, a folder or a header', () => {
    for (const file of files) {
      expect(file.key, 'key').not.toMatch(DIGIT_RUN);
      expect(file.folder, `${file.key} folder`).not.toMatch(DIGIT_RUN);
      for (const token of file.headers ?? []) {
        expect(token, `${file.key} header`).not.toMatch(DIGIT_RUN);
      }
    }
  });

  it('records the suppressed marker only as a whole header list, never as a token', () => {
    for (const file of files) {
      for (const token of file.headers ?? []) {
        expect(token).not.toBe(SUPPRESSED);
      }
    }
  });

  it('relabels every account folder as ACCT-X', () => {
    for (const file of files) {
      expect(file.account, `${file.key} account`).toMatch(ACCOUNT_LABEL);
    }
  });

  it('carries a comma, a semicolon or nothing — never another delimiter', () => {
    for (const file of files) {
      expect([null, ';', ','], `${file.key} delimiter`).toContain(file.delimiter);
    }
  });

  it('records positive sizes and line counts for every captured file', () => {
    for (const file of files) {
      expect(file.bytes, `${file.key} bytes`).toBeGreaterThan(0);
      expect(file.nonEmptyLines, `${file.key} nonEmptyLines`).toBeGreaterThan(0);
    }
  });

  it('keys every entry by its lower-cased file name', () => {
    for (const file of files) {
      expect(file.key).toBe(file.fileName.toLowerCase());
    }
  });

  it('carries a header list for every captured file in this capture', () => {
    for (const file of files) {
      expect(file.headers, `${file.key} headers`).not.toBeNull();
      expect(file.headers?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it('holds every file key the plan interface block expects', () => {
    const seen = keysOf(files);
    for (const key of REQUIRED_KEYS) {
      expect(seen, `captured key ${key}`).toContain(key);
    }
  });

  it('repeats a key once per account that holds it, and never otherwise', () => {
    const seen = keysOf(files);
    for (const key of new Set(seen)) {
      const accounts = files.filter((file) => file.key === key).map((file) => file.account);
      expect(new Set(accounts).size, `${key} accounts`).toBe(accounts.length);
    }
  });
});

describe('headersOf', () => {
  it('returns the header list of a captured file key', () => {
    const found = headersOf('heat_game_sessions.csv');
    expect(found).not.toBeNull();
    expect(found?.headers).toContain('STARTED_AT');
  });

  it('reports no divergence for every key in this capture', () => {
    for (const key of new Set(keysOf(files))) {
      expect(headersOf(key)?.divergent, `${key} divergent`).toBe(false);
    }
  });

  it('returns null for a file key the capture does not hold', () => {
    expect(headersOf('not_a_captured_file.csv')).toBeNull();
  });

  it('never returns an empty or suppressed header list', () => {
    for (const key of new Set(keysOf(files))) {
      const found = headersOf(key);
      expect(found?.headers.length ?? 0).toBeGreaterThan(0);
      expect(found?.headers ?? []).not.toContain(SUPPRESSED);
    }
  });
});

// =============================================================================
// Phase 12 additions (plan 12-01 Task 3): files, risk answers, mapping, shapes.
// =============================================================================

const ANSWERS = ['yes', 'no', 'unsure'];
const RISK_FIELDS = ['email', 'personName', 'freeText', 'ip', 'code'] as const;

/** Files whose IP column rule (d) admits. */
const IP_FILES = ['bans.csv', 'authorized_third_parties.csv', 'bonus_code_usage.csv'];
/** Files whose code column rule (e) admits. */
const CODE_FILES = ['personal_coupons.csv', 'bonus_code_usage.csv'];

const EXPECTED_CARDS: readonly (readonly [string, string])[] = [
  ['timeline', 'Name'],
  ['timeline', 'Service'],
  ['timeline', 'Language and country'],
  ['timeline', 'Ban'],
  ['timeline', 'Third party'],
  ['perks', 'Subscriptions'],
  ['perks', 'Personal coupons'],
  ['perks', 'Bonus codes'],
  ['perks', 'Surveys'],
];

const mappedColumns = (row: PaneMappingRow): string[] =>
  [row.primary, row.language, row.country, row.date, ...row.secondary].filter(
    (column): column is string => column !== null,
  );

describe('Phase 12 captured files', () => {
  it('holds every file key the Pane mapping can use', () => {
    const seen = keysOf(files);
    for (const key of PHASE_12_KEYS) {
      expect(seen, `captured key ${key}`).toContain(key);
    }
  });

  it('enters HEAT_Surveys once, not once per capture', () => {
    expect(keysOf(files).filter((key) => key === 'heat_surveys.csv')).toHaveLength(1);
  });

  it('adds only the new Phase 12 keys with a folder inside the six promoted ones or User_Info', () => {
    const allowed = [
      'Authorized_Third_Parties',
      'Bans',
      'Bonus_Codes',
      'Personal_Coupons',
      'Subscriptions',
      'Surveys',
      'User_Info',
    ];
    for (const file of files.filter((f) => NEW_PHASE_12_KEYS.includes(f.key))) {
      expect(allowed, `${file.key} folder`).toContain(file.folder);
    }
  });

  it('never captures Account_Info.csv or anything from Game_Forums (D-02, D-04)', () => {
    for (const file of files) {
      expect(file.key).not.toBe('account_info.csv');
      expect(file.folder.toLowerCase()).not.toBe('game_forums');
    }
  });
});

describe('COLUMN_RISK_ANSWERS', () => {
  it('answers yes, no or unsure on all five fields for every column of every Phase 12 file', () => {
    for (const key of PHASE_12_KEYS) {
      const headers = headersOf(key)?.headers ?? [];
      const answered = riskAnswers[key] ?? {};
      expect(headers.length, `${key} captured`).toBeGreaterThan(0);
      for (const header of headers) {
        const row = answered[header];
        expect(row, `${key}.${header} has an answer`).toBeDefined();
        for (const field of RISK_FIELDS) {
          expect(ANSWERS, `${key}.${header}.${field}`).toContain(row?.[field]);
        }
      }
    }
  });

  it('answers only for columns the capture holds', () => {
    for (const [key, columns] of Object.entries(riskAnswers)) {
      expect(PHASE_12_KEYS, `${key} is a Phase 12 key`).toContain(key);
      for (const column of Object.keys(columns)) {
        expect(headersOf(key)?.headers ?? [], `${key}.${column}`).toContain(column);
      }
    }
  });
});

describe('PANE_MAPPING', () => {
  it('has exactly one row per timeline kind and Perks card', () => {
    expect(paneMapping.map((row) => [row.pane, row.cardOrKind])).toEqual(EXPECTED_CARDS);
  });

  it('points every mapped row at a captured file in its own folder, using captured columns', () => {
    for (const row of paneMapping.filter((r) => r.status === 'mapped')) {
      expect(row.fileKey, `${row.cardOrKind} file`).not.toBeNull();
      const captured = files.find((file) => file.key === row.fileKey);
      expect(captured, `${row.cardOrKind} captured`).toBeDefined();
      expect(captured?.folder, `${row.cardOrKind} folder`).toBe(row.folder);
      const headers = headersOf(row.fileKey ?? '')?.headers ?? [];
      for (const column of mappedColumns(row)) {
        expect(headers, `${row.cardOrKind} column ${column}`).toContain(column);
      }
    }
  });

  it('gives every mapped Perks row a primary and every mapped timeline row a primary or a language or country column', () => {
    for (const row of paneMapping.filter((r) => r.status === 'mapped')) {
      if (row.pane === 'perks') {
        expect(row.primary, `${row.cardOrKind} primary`).not.toBeNull();
      } else if (row.cardOrKind === 'Language and country') {
        expect(row.language !== null || row.country !== null, `${row.cardOrKind}`).toBe(true);
      } else {
        expect(row.primary, `${row.cardOrKind} primary`).not.toBeNull();
      }
    }
  });

  it('leaves a removed row with no file key and no columns', () => {
    for (const row of paneMapping.filter((r) => r.status === 'removed')) {
      expect(row.fileKey, `${row.cardOrKind} file`).toBeNull();
      expect(mappedColumns(row), `${row.cardOrKind} columns`).toEqual([]);
    }
  });

  it('never maps a column the risk answers mark yes or unsure for email, a person name or free text (rule g)', () => {
    for (const row of paneMapping.filter((r) => r.status === 'mapped')) {
      for (const column of mappedColumns(row)) {
        const risk = riskAnswers[row.fileKey ?? '']?.[column];
        expect(risk, `${row.cardOrKind}.${column} answered`).toBeDefined();
        expect(risk?.email, `${row.cardOrKind}.${column} email`).toBe('no');
        expect(risk?.personName, `${row.cardOrKind}.${column} personName`).toBe('no');
        expect(risk?.freeText, `${row.cardOrKind}.${column} freeText`).toBe('no');
      }
    }
  });

  it('admits an address column only in Bans, Authorized_Third_Parties and Bonus_Code_Usage, a code column only in Personal_Coupons and Bonus_Code_Usage (rules d, e)', () => {
    for (const row of paneMapping.filter((r) => r.status === 'mapped')) {
      for (const column of mappedColumns(row)) {
        const risk = riskAnswers[row.fileKey ?? '']?.[column];
        if (risk?.ip !== 'no')
          expect(IP_FILES, `${row.cardOrKind}.${column} ip`).toContain(row.fileKey);
        if (risk?.code !== 'no')
          expect(CODE_FILES, `${row.cardOrKind}.${column} code`).toContain(row.fileKey);
      }
    }
  });
});

describe('DATE_SHAPES', () => {
  it('names a captured file and column, and its file is a mapped row', () => {
    for (const shape of dateShapes) {
      const headers = headersOf(shape.fileKey)?.headers ?? [];
      expect(headers, `${shape.fileKey}.${shape.column}`).toContain(shape.column);
      const mapped = paneMapping.find(
        (row) => row.status === 'mapped' && row.fileKey === shape.fileKey,
      );
      expect(mapped, `${shape.fileKey} is a mapped row`).toBeDefined();
      expect(shape.shape.length, `${shape.fileKey}.${shape.column} shape`).toBeGreaterThan(0);
    }
  });

  it('covers the date column of every mapped row that has one', () => {
    for (const row of paneMapping.filter((r) => r.status === 'mapped' && r.date !== null)) {
      const found = dateShapes.find((s) => s.fileKey === row.fileKey && s.column === row.date);
      expect(found, `${row.cardOrKind} date shape`).toBeDefined();
    }
  });

  it('holds a shape pattern, never a date value', () => {
    for (const shape of dateShapes) {
      expect(shape.shape, `${shape.fileKey}.${shape.column}`).not.toMatch(/\d/);
    }
  });
});
