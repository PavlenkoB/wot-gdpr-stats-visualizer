import { describe, expect, test } from 'vitest';
import {
  extractIdentity,
  isUserInfoCategory,
  sanitizeUserInfoRow,
} from '../../../src/lib/worker/identity.ts';

// =============================================================================
// identity.ts — the D-18 strip and the D-17/D-20 identity pick
// =============================================================================
//
// Why this file exists (03-01-PLAN Task 2, IDENTITY-01, threat T-03-01/04/05):
//   The privacy guarantee that the account email and birth data never rest
//   in IndexedDB is enforced in exactly one function — `sanitizeUserInfoRow`
//   — and the guarantee that only three safe fields reach the main thread
//   is enforced in exactly one other — `extractIdentity`.
//
//   Both take their input from a REAL untrusted export, whose column names
//   are whatever the CSV says. RESEARCH Q3 probed what PapaParse does with
//   that input, and the three answers that matter are all ways a naive
//   `row.LOGIN = undefined` strip leaks:
//
//     - it does NOT trim header names   →  ' LOGIN' survives
//     - it does NOT upper-case them     →  'login' survives
//     - it renames a duplicate column   →  'LOGIN_1' survives
//     - cells beyond the header land in `__parsed_extra`, an array the
//       worker never inspects
//
//   Those are what this file pins, as pure functions with no worker
//   globals, so the guarantee is testable without a zip or a database.
// =============================================================================

type Row = Record<string, string | undefined>;

/** A realistic sanitised Account_Info row, as identity.ts would produce. */
const SAMPLE_ROW: Row = {
  ID: '123456789',
  NAME: 'Synthetic Player',
  CREATED_AT: '2020-01-01 00:00:00',
  ACTIVATED_AT: '2020-01-02 00:00:00',
  IP: '192.0.2.10',
  COUNTRY_CODE: 'US',
  REGION: 'CA',
  CITY: 'Testville',
  USER_LANGUAGE: 'en',
  USER_STATED_COUNTRY: 'US',
};

describe('sanitizeUserInfoRow — the D-18 drop list', () => {
  test('drops every casing and padding of LOGIN, BIRTH_DATE and BIRTH_DATE_SRC', () => {
    const input: Row = {
      LOGIN: 'a@example.invalid',
      login: 'b@example.invalid',
      ' LOGIN': 'c@example.invalid',
      'LOGIN ': 'd@example.invalid',
      LogIn: 'e@example.invalid',
      BIRTH_DATE: '1990-01-01',
      'BIRTH_DATE ': '1991-02-02',
      ' birth_date': '1992-03-03',
      BIRTH_DATE_SRC: 'self',
      'birth_date_src ': 'passport',
    };
    expect(Object.keys(sanitizeUserInfoRow(input))).toEqual([]);
  });

  test('drops Papa’s duplicate-header rename (LOGIN_1) but keeps a non-sensitive _N column', () => {
    const out = sanitizeUserInfoRow({
      LOGIN: 'a@example.invalid',
      LOGIN_1: 'b@example.invalid',
      BIRTH_DATE_2: '1990-01-01',
      BIRTH_DATE_SRC_3: 'self',
      IP_1: '192.0.2.10',
    });
    expect(Object.keys(out)).toEqual(['IP_1']);
  });

  test('drops the __parsed_extra overflow bucket and keeps the safe cells around it', () => {
    // PapaParse puts overflow CELLS in an ARRAY under this key. The `Row`
    // type models the ordinary all-string row and does not spell that
    // array out, so the literal is cast: the runtime shape is exactly what
    // the strip has to survive, and it is the one shape a column-name
    // deny-list cannot see into.
    const input = {
      ID: '123456789',
      NAME: 'Synthetic Player',
      __parsed_extra: ['canary@example.invalid', '1990-01-01'],
    } as unknown as Row;
    const out = sanitizeUserInfoRow(input);
    expect(Object.keys(out)).toEqual(['ID', 'NAME']);
    expect(out['NAME']).toBe('Synthetic Player');
  });

  test('keeps IP, COUNTRY_CODE and CITY — D-18 narrows User_Info to three columns only', () => {
    const out = sanitizeUserInfoRow({ ...SAMPLE_ROW, LOGIN: 'a@example.invalid' });
    expect(out['IP']).toBe('192.0.2.10');
    expect(out['COUNTRY_CODE']).toBe('US');
    expect(out['CITY']).toBe('Testville');
    expect(out['NAME']).toBe('Synthetic Player');
  });

  test('does not mutate its input', () => {
    const input: Row = { ...SAMPLE_ROW, LOGIN: 'a@example.invalid' };
    const before = Object.keys(input);
    sanitizeUserInfoRow(input);
    expect(Object.keys(input)).toEqual(before);
    expect(input['LOGIN']).toBe('a@example.invalid');
  });

  test('a __proto__ header becomes an own data property and leaves the prototype alone (T-03-04)', () => {
    // Object.fromEntries (rather than copy-then-delete) is what makes this
    // hold: it creates own properties, so a key literally spelled
    // `__proto__` cannot reach the prototype chain.
    const hostile = Object.create(null) as Row;
    hostile['__proto__'] = 'polluted';
    hostile['NAME'] = 'Synthetic Player';

    const out = sanitizeUserInfoRow(hostile);
    expect(Object.prototype.hasOwnProperty.call(out, '__proto__')).toBe(true);
    expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
    expect(out['NAME']).toBe('Synthetic Player');
  });
});

describe('isUserInfoCategory', () => {
  test('is true for every casing of the folder name and false for anything else', () => {
    // classifyFolder is case-insensitive and PRESERVES the raw name, so
    // `user_info` classifies as the same supported category. A literal
    // comparison against 'User_Info' would let that export's email
    // straight into IndexedDB.
    expect(isUserInfoCategory('User_Info')).toBe(true);
    expect(isUserInfoCategory('user_info')).toBe(true);
    expect(isUserInfoCategory('USER_INFO')).toBe(true);
    expect(isUserInfoCategory('User_Info_extra')).toBe(false);
    expect(isUserInfoCategory('Chat_history')).toBe(false);
    expect(isUserInfoCategory('')).toBe(false);
  });
});

describe('extractIdentity — the D-17 row choice', () => {
  test('returns null for zero rows (the D-16 fallback trigger)', () => {
    expect(extractIdentity([], '123456789')).toBeNull();
  });

  test('a single row yields the three fields and nothing else (T-03-05)', () => {
    const identity = extractIdentity([SAMPLE_ROW], '123456789');
    expect(identity).toEqual({
      nickname: 'Synthetic Player',
      region: 'CA',
      createdAt: '2020-01-01 00:00:00',
    });
    expect(Object.keys(identity!).sort()).toEqual(['createdAt', 'nickname', 'region']);
  });

  test('picks the row whose ID equals the account root over a decoy first row', () => {
    const decoy: Row = { ID: '999999999', NAME: 'Decoy Player', REGION: 'NA', CREATED_AT: 'x' };
    const match: Row = {
      ID: '123456789',
      NAME: 'Matched Player',
      REGION: 'EU',
      CREATED_AT: 'y',
    };
    expect(extractIdentity([decoy, match], '123456789')).toEqual({
      nickname: 'Matched Player',
      region: 'EU',
      createdAt: 'y',
    });
  });

  test('falls back to the first row when no ID matches', () => {
    const first: Row = { ID: '999999999', NAME: 'Decoy Player', REGION: 'NA' };
    const second: Row = { ID: '888888888', NAME: 'Other Player', REGION: 'EU' };
    expect(extractIdentity([first, second], '123456789')?.nickname).toBe('Decoy Player');
  });

  test('an empty account root (a re-zipped export with no ID folder) falls back to row 1', () => {
    const rows: Row[] = [
      { ID: '999999999', NAME: 'Decoy Player', REGION: 'NA' },
      { ID: '123456789', NAME: 'Matched Player', REGION: 'EU' },
    ];
    expect(extractIdentity(rows, '')?.nickname).toBe('Decoy Player');
  });

  test('two rows sharing the account-root ID pick the FIRST, so the choice is stable', () => {
    const first: Row = { ID: '123456789', NAME: 'First Match', REGION: 'EU' };
    const second: Row = { ID: '123456789', NAME: 'Second Match', REGION: 'NA' };
    expect(extractIdentity([first, second], '123456789')?.nickname).toBe('First Match');
  });
});

describe('extractIdentity — hostile header shapes', () => {
  test('padded, lower-case and duplicate-suffixed column names all resolve', () => {
    const variant: Row = {
      ID: '123456789',
      ' NAME ': '  Variant Player  ',
      CREATED_AT: '2021-02-03 04:05:06',
      region: 'EU',
    };
    expect(extractIdentity([variant], '123456789')).toEqual({
      nickname: 'Variant Player',
      region: 'EU',
      createdAt: '2021-02-03 04:05:06',
    });

    const lower: Row = {
      id: '123456789',
      name: 'Lower Player',
      created_at: '2022-03-04 05:06:07',
      region: 'EU',
    };
    expect(extractIdentity([lower], '123456789')).toEqual({
      nickname: 'Lower Player',
      region: 'EU',
      createdAt: '2022-03-04 05:06:07',
    });
  });

  test('a missing REGION column yields a null slot, not a dropped identity', () => {
    const identity = extractIdentity(
      [{ ID: '123456789', NAME: 'No Region Player', CREATED_AT: '2020-01-01 00:00:00' }],
      '123456789',
    );
    expect(identity).toEqual({
      nickname: 'No Region Player',
      region: null,
      createdAt: '2020-01-01 00:00:00',
    });
  });

  test('blank and whitespace-only values become null, and real values are trimmed', () => {
    const identity = extractIdentity(
      [{ ID: '123456789', NAME: '   ', REGION: '', CREATED_AT: ' 2020-01-01 00:00:00 ' }],
      '123456789',
    );
    expect(identity).toEqual({ nickname: null, region: null, createdAt: '2020-01-01 00:00:00' });
  });

  test('a non-string cell (Papa’s undefined for a short row) is treated as absent', () => {
    const identity = extractIdentity(
      [{ ID: '123456789', NAME: undefined, REGION: 'CA', CREATED_AT: undefined }],
      '123456789',
    );
    expect(identity).toEqual({ nickname: null, region: 'CA', createdAt: null });
  });
});
